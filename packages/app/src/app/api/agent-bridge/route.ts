// GET  /api/agent-bridge          — SSE stream; server pushes INTENT_RECEIVED events
// POST /api/agent-bridge          — JSON-RPC 2.0; agent calls tools (push_intent, resolve_component, …)
//
// Authentication: Bearer <workspace_token> (HMAC-SHA256, issued by issueWorkspaceToken).
// Both methods share the same auth scheme.

import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkspaceToken, TOOL_MAP, getToolList, dispatchTool, registerSseClient } from '@originmain/agent-bridge';
import type { JsonRpcRequest, ToolContext } from '@originmain/agent-bridge';
import { serverClient } from '@/lib/supabase';

// ── GET — SSE stream for real-time INTENT_RECEIVED push ─────────────────────
// The agent connects once and holds this connection open. When the canvas
// exports a style intent (via POST /api/intent), storePendingIntent() fires
// pushToSseClients() which delivers the event immediately over this stream.
//
// Deployment note: this is a long-lived streaming response. In serverless
// environments (Vercel Hobby / Functions) connections are cut at the platform
// timeout (~30 s). For persistent SSE, deploy with Vercel Fluid Compute,
// a Node.js server, or replace the in-process client registry with a
// Supabase Realtime / Redis pub-sub channel.

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return new NextResponse('Missing Bearer token', { status: 401 });
  }

  const workspaceToken = verifyWorkspaceToken(token);
  if (!workspaceToken) {
    return new NextResponse('Invalid or expired token', { status: 401 });
  }

  const { workspaceId } = workspaceToken;
  const enc = new TextEncoder();

  // ── SSE stream ────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    start(controller) {
      // Send the mandatory SSE preamble so the client knows the connection is live.
      controller.enqueue(enc.encode(': connected\n\n'));

      // Register callback — fires every time storePendingIntent() is called for
      // this workspace (i.e., the canvas exported a new style intent).
      const unsubscribe = registerSseClient(workspaceId, (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          // Controller may be closed if the client disconnected between the
          // callback being fired and the enqueue call.
        }
      });

      // Keep-alive comment every 25 s — prevents proxies from closing the
      // connection after a 30 s idle timeout while the agent waits for intents.
      const keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: keep-alive\n\n`));
        } catch {
          clearInterval(keepAliveTimer);
        }
      }, 25_000);

      // Clean up when the client disconnects (connection abort or close).
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAliveTimer);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx: disable response buffering
    },
  });
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing Bearer token' } },
      { status: 401 },
    );
  }

  const workspaceToken = verifyWorkspaceToken(token);
  if (!workspaceToken) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid or expired token' } },
      { status: 401 },
    );
  }

  // ── Parse JSON-RPC body ─────────────────────────────────────────────────────
  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 },
    );
  }

  // tools/list — meta-endpoint; return available tools without executing one.
  // MCP spec requires each entry to include inputSchema so clients can
  // construct valid tool calls without out-of-band documentation.
  if (body.method === 'tools/list') {
    return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { tools: getToolList() } });
  }

  // ── Dispatch ────────────────────────────────────────────────────────────────
  if (!TOOL_MAP[body.method]) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    });
  }

  const ctx: ToolContext = {
    workspaceId: workspaceToken.workspaceId,
    params: body.params ?? {},
    // Pass the server-side Supabase client for tools that need DB writes
    // (e.g. update_diff_status writes blocked_reason to intent_diffs).
    db: serverClient() as unknown as NonNullable<ToolContext['db']>,
  };

  try {
    const result = await dispatchTool(body.method, ctx);
    return NextResponse.json({ jsonrpc: '2.0', id: body.id, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32603, message },
    });
  }
}
