// ── MCP / JSON-RPC 2.0 protocol types ────────────────────────────────────────
// The Agent Bridge implements MCP over JSON-RPC 2.0, transported via WebSocket
// (long-running) or HTTP POST (polling-based agents).

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError;

// ── MCP error codes ───────────────────────────────────────────────────────────
export const MCP_ERROR = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
  // Application-level codes
  UNAUTHORIZED:     -32001,
  RATE_LIMITED:     -32002,
  NOT_FOUND:        -32003,
} as const;

// ── Origmain-specific envelope ────────────────────────────────────────────────
// Every connection must present a signed workspace token in the first message.

export interface AuthRequest {
  type: 'auth';
  workspaceToken: string;
}

export interface AuthAck {
  type: 'auth_ack';
  workspaceId: string;
  agentType: 'CURSOR' | 'CLAUDE_CODE' | 'GENERIC';
}

// ── Tool result types ─────────────────────────────────────────────────────────

export interface ToolResult<T> {
  content: { type: 'text'; text: string } | { type: 'json'; json: T };
}

export function textResult(text: string): ToolResult<never> {
  return { content: { type: 'text', text } };
}

export function jsonResult<T>(json: T): ToolResult<T> {
  return { content: { type: 'json', json } };
}
