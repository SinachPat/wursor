// POST /api/agent-bridge
// JSON-RPC 2.0 endpoint consumed by the Cursor / Claude Code MCP adapters.
// Authentication: Bearer <workspace_token> (HMAC-SHA256, issued by issueWorkspaceToken).

import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkspaceToken, TOOL_MAP, getToolList, dispatchTool } from '@originmain/agent-bridge';
import type { JsonRpcRequest, ToolContext } from '@originmain/agent-bridge';
import { serverClient } from '@/lib/supabase';

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
