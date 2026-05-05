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

// ── Intent types — Phase 5 §8.4 ──────────────────────────────────────────────
// These describe the design changes the canvas wants the agent to apply to source.

export interface IntentChange {
  type: 'style' | 'prop' | 'layout' | 'remove';
  cssProperty?: string;
  propName?: string;
  from?: unknown;
  to?: unknown;
  /** CSS custom property key when the value maps to a design token (Phase 6). */
  tokenKey?: string;
  confidence: 'exact' | 'approximate';
}

export interface IntentMessage {
  intentId: string;
  component: {
    name: string;
    /** Fiber path ID — used for diff correlation. */
    nodeId: string;
    /** Call-site location: "src/app/dashboard/page.tsx:34" */
    callSite?: string;
    definitionFile?: string;
    definitionLine?: number;
    /** Current runtime props — context for the agent. */
    props: Record<string, unknown>;
    /** From AST indexer (optional — indexer may not be running). */
    propsSchema?: Array<{ name: string; type: string; optional: boolean }>;
  };
  changes: IntentChange[];
  /**
   * Ready-to-apply code diff (when confidence is 'exact', apply verbatim;
   * when 'approximate', use as a guide and refine).
   */
  codeDiff?: {
    file: string;
    originalContent: string;
    patchedContent: string;
    confidence: 'exact' | 'approximate';
  };
  /** Before/after visual snapshots (base64 data URLs). */
  snapshot?: {
    before: string;
    after?: string;
  };
  /** Design language context when tokens are loaded (Phase 6). */
  designLanguage?: {
    tokensUsed: string[];
    palette: Record<string, string>;
  };
}

/**
 * Server → agent push (sent over WebSocket, no JSON-RPC id — not a request).
 * Emitted immediately after `push_intent` stores a new intent.
 */
export interface IntentReceivedPush {
  type: 'INTENT_RECEIVED';
  intent: IntentMessage;
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
