// POST /api/agent-bridge
// JSON-RPC 2.0 endpoint consumed by the Cursor / Claude Code MCP adapters.
// Authentication: Bearer <workspace_token> (HMAC-SHA256, issued by issueWorkspaceToken).

import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkspaceToken, TOOL_MAP, getToolList } from '@originmain/agent-bridge';
import type { JsonRpcRequest, ToolContext } from '@originmain/agent-bridge';
import {
  getDiffsByStatus,
  getDiff,
  getArtboard,
  getActiveDesignLanguageFile,
  updateDiffStatus,
} from '@originmain/origin-graph';
import { AIGateway, answerAgentQuestion } from '@originmain/ai-layer';
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
  const tool = TOOL_MAP.get(body.method);
  if (!tool) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    });
  }

  const db = serverClient();
  const { workspaceId } = workspaceToken;

  const ctx: ToolContext = {
    workspaceId,
    db: {
      getDiffsByStatus: (wsId, status) => getDiffsByStatus(db, wsId, status),
      getDiff:          (id)            => getDiff(db, id),
      getArtboard:      (id)            => getArtboard(db, id),
      getDesignLanguageFile: (wsId)     => getActiveDesignLanguageFile(db, wsId),
      updateDiffStatus: (id, status, notes) =>
        updateDiffStatus(db, id, status, notes).then(() => undefined),
    },
    ai: {
      answerAgentQuestion: (diffId: string, question: string, artboardContext: unknown) =>
        answerAgentQuestion(new AIGateway(), {
          diffId,
          question,
          artboardContextJson: JSON.stringify(artboardContext),
        }).then(r => r.answer),
    },
  };

  try {
    const result = await tool.execute(body.params ?? {}, ctx);
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
