/**
 * tools.ts — Phase 5
 *
 * Defines the MCP tools exposed by the Agent Bridge to connected IDE agents
 * (Cursor, Claude Code, etc.). Each tool is a JSON Schema descriptor plus a
 * handler that runs inside the MCP server request loop.
 *
 * Tools:
 *   push_intent       — Canvas pushes a style intent diff to the agent
 *   resolve_component — Agent queries the component source location by fiber ID
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 5 §9 "Agent Bridge"
 */

import { textResult, jsonResult } from './protocol.js';
import type { ToolResult, IntentMessage, IntentChange, IntentReceivedPush } from './protocol.js';

// ── Tool descriptor shape (MCP tools/list schema) ─────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ── Tool execution context (injected by the MCP server request loop) ──────────

export interface ToolContext {
  /** Verified workspace ID from the authenticated token. */
  workspaceId: string;
  /** The raw parsed params from the JSON-RPC request. */
  params: unknown;
  /**
   * Optional Supabase server-client for tools that need DB writes.
   * Only provided when the route handler calls createServerClient() — tools
   * that don't need it (push_intent, resolve_component) ignore it.
   */
  db?: {
    from: (table: string) => unknown;
  };
}

// ── In-process intent store ───────────────────────────────────────────────────
// Intents are pushed here by the /api/intent Next.js route (via push_intent),
// and drained by connected agents through polling or INTENT_RECEIVED push.
//
// For production multi-instance deployments, replace with a Redis pub/sub or
// Supabase Realtime channel.

interface IntentRecord {
  intentId: string;
  workspaceId: string;
  artboardId: string;
  componentName: string;
  patchJson: string;
  strategy: string;
  summary: string;
  createdAt: number;
}

const pendingIntents = new Map<string, IntentRecord[]>();

/**
 * Store an intent pushed by the canvas (called from the /api/intent route).
 *
 * @param supplyIntentId  Pass the Supabase UUID when you've already created the
 *                        DB row — the in-memory ID must match so that the agent's
 *                        `update_diff_status` tool can call `.eq('id', intentId)`.
 *                        If omitted, a local opaque ID is generated (dev/offline mode).
 * Returns the intentId actually stored.
 */
export function storePendingIntent(
  workspaceId: string,
  intent: Omit<IntentRecord, 'intentId' | 'workspaceId' | 'createdAt'>,
  supplyIntentId?: string,
): string {
  const intentId = supplyIntentId ?? `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: IntentRecord = {
    intentId,
    workspaceId,
    ...intent,
    createdAt: Date.now(),
  };
  const queue = pendingIntents.get(workspaceId) ?? [];
  queue.push(record);
  pendingIntents.set(workspaceId, queue);

  // Push INTENT_RECEIVED to any SSE-connected agents for this workspace.
  const push: IntentReceivedPush = {
    type: 'INTENT_RECEIVED',
    intent: recordToIntentMessage(record),
  };
  pushToSseClients(workspaceId, `data: ${JSON.stringify(push)}\n\n`);

  return intentId;
}

// ── SSE client registry ───────────────────────────────────────────────────────
// Maps workspaceId → set of send callbacks registered by connected SSE clients.
//
// Same in-process design as pendingIntents / indexerRegistry — for production
// multi-instance deployments, replace with Redis pub/sub or Supabase Realtime.

type SseSendFn = (chunk: string) => void;

const sseClients = new Map<string, Set<SseSendFn>>();

/**
 * Register an SSE send callback for a workspace.
 * Returns an unsubscribe function — call it when the SSE connection closes.
 */
export function registerSseClient(workspaceId: string, send: SseSendFn): () => void {
  let set = sseClients.get(workspaceId);
  if (!set) { set = new Set(); sseClients.set(workspaceId, set); }
  set.add(send);
  return () => {
    set!.delete(send);
    if (set!.size === 0) sseClients.delete(workspaceId);
  };
}

/** Broadcast a raw SSE chunk to all connected clients for a workspace. */
function pushToSseClients(workspaceId: string, chunk: string): void {
  const clients = sseClients.get(workspaceId);
  if (!clients) return;
  for (const send of clients) {
    try { send(chunk); } catch { /* client disconnected — will be deregistered on abort */ }
  }
}

/** Convert an IntentRecord to the IntentMessage shape for SSE / push_intent JSON response. */
function recordToIntentMessage(record: IntentRecord): IntentMessage {
  let changes: IntentChange[] = [];
  try {
    const parsed = JSON.parse(record.patchJson) as unknown;
    const patches: Array<{ property?: string; value?: string; previousValue?: string }> =
      Array.isArray(parsed) ? parsed : ((parsed as { patches?: unknown[] }).patches ?? []);
    changes = patches.map((p) => ({
      type:        'style' as const,
      cssProperty: p.property ?? '',
      from:        p.previousValue,
      to:          p.value ?? '',
      confidence:  'approximate' as const,
    }));
  } catch { /* malformed patchJson — send empty changes list */ }

  return {
    intentId:  record.intentId,
    component: {
      name:   record.componentName,
      // nodeId not stored in IntentRecord — agent uses component_name with
      // resolve_component instead of a fiber-ID lookup.
      nodeId: '',
      props:  {},
    },
    changes,
  };
}

/**
 * Drain all pending intents for a workspace (called by push_intent tool handler
 * or by the agent when polling).
 */
export function drainPendingIntents(workspaceId: string): IntentRecord[] {
  const queue = pendingIntents.get(workspaceId) ?? [];
  pendingIntents.delete(workspaceId);
  return queue;
}

// ── CLI indexer registry ──────────────────────────────────────────────────────
// Maps workspaceId → { url, expiresAt } (registered via /register-indexer).
//
// TTL policy (spec Phase 5 §8.3):
//   • Default TTL: 300 s (5 min)
//   • CLI sends heartbeat POST every 120 s to refresh the TTL
//   • Registration is considered expired after 360 s (3× heartbeat interval)
//
// The GC sweep runs on every registration and lookup to avoid a timer leak
// in serverless/edge environments where setInterval may not fire.

interface IndexerEntry {
  url: string;
  expiresAt: number; // ms since epoch
}

const indexerRegistry = new Map<string, IndexerEntry>();

/** Evict all entries whose TTL has expired. */
function gcIndexerRegistry(): void {
  const now = Date.now();
  for (const [wid, entry] of indexerRegistry) {
    if (entry.expiresAt < now) indexerRegistry.delete(wid);
  }
}

/**
 * Register (or refresh) a CLI indexer for a workspace.
 * Security: the caller MUST validate that `url` is a localhost URL before
 * calling this function (enforced by the /register-indexer API route).
 *
 * @param workspaceId  Verified workspace ID
 * @param url          Indexer URL — must be localhost (caller-validated)
 * @param ttlSeconds   TTL in seconds (default: 300 s / 5 min)
 */
export function registerIndexer(workspaceId: string, url: string, ttlSeconds = 300): void {
  gcIndexerRegistry();
  indexerRegistry.set(workspaceId, { url, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Returns the registered indexer URL for a workspace, or undefined if not
 * registered or if the TTL has expired.
 */
export function getIndexerUrl(workspaceId: string): string | undefined {
  gcIndexerRegistry();
  const entry = indexerRegistry.get(workspaceId);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    indexerRegistry.delete(workspaceId);
    return undefined;
  }
  return entry.url;
}

/**
 * Refresh the TTL for an already-registered indexer (heartbeat endpoint).
 * Returns false if no entry exists for the workspace (caller should 404).
 */
export function heartbeatIndexer(workspaceId: string, ttlSeconds = 300): boolean {
  const entry = indexerRegistry.get(workspaceId);
  if (!entry || entry.expiresAt < Date.now()) return false;
  entry.expiresAt = Date.now() + ttlSeconds * 1000;
  return true;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const PUSH_INTENT_TOOL: McpTool = {
  name: 'push_intent',
  description:
    'Receive a design intent diff from the Origin canvas. The diff describes style or prop changes ' +
    'made by the designer that should be applied to the source code. Call this when Origin notifies ' +
    'you of pending changes. Returns the list of pending intents for this workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: {
        type: 'string',
        description: 'The workspace ID (must match the authenticated token).',
      },
    },
    required: ['workspace_id'],
  },
};

const RESOLVE_COMPONENT_TOOL: McpTool = {
  name: 'resolve_component',
  description:
    'Resolve the source file location for a React component by name. ' +
    'Proxies to the CLI indexer running in the workspace and returns the file path, ' +
    'line number, props schema, and design tokens used by the component.',
  inputSchema: {
    type: 'object',
    properties: {
      component_name: {
        type: 'string',
        description:
          'The display name of the component to look up (e.g. "DashboardCard"). ' +
          'Case-sensitive; use the name exactly as it appears in the INTENT_RECEIVED message.',
      },
    },
    required: ['component_name'],
  },
};

const UPDATE_DIFF_STATUS_TOOL: McpTool = {
  name: 'update_diff_status',
  description:
    'Update the status of a design intent diff after attempting to apply it. ' +
    'Call with status "IMPLEMENTED" after successfully applying the diff to the source code. ' +
    'Call with status "BLOCKED" and a reason string if the diff could not be applied — ' +
    'the reason is shown to the designer so they can resolve the conflict manually. ' +
    'Valid statuses: "IMPLEMENTED" | "BLOCKED".',
  inputSchema: {
    type: 'object',
    properties: {
      intent_id: {
        type: 'string',
        description: 'The intentId received in the INTENT_RECEIVED message or push_intent response.',
      },
      status: {
        type: 'string',
        enum: ['IMPLEMENTED', 'BLOCKED'],
        description: '"IMPLEMENTED" if the diff was applied successfully; "BLOCKED" if it could not be applied.',
      },
      reason: {
        type: 'string',
        description:
          'Required when status is "BLOCKED". Describe why the diff could not be applied — ' +
          'e.g. "Component not found in file", "File is read-only", "Diff conflicts with current state".',
      },
    },
    required: ['intent_id', 'status'],
  },
};

// ── Tool map (name → descriptor) ──────────────────────────────────────────────

export const TOOL_MAP: Record<string, McpTool> = {
  push_intent:         PUSH_INTENT_TOOL,
  resolve_component:   RESOLVE_COMPONENT_TOOL,
  update_diff_status:  UPDATE_DIFF_STATUS_TOOL,
};

export const TOOLS: McpTool[] = Object.values(TOOL_MAP);

export function getToolList(): McpTool[] {
  return TOOLS;
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

type Params = Record<string, unknown>;

async function handlePushIntent(ctx: ToolContext): Promise<ToolResult<unknown>> {
  const params = ctx.params as Params;
  const wid = typeof params['workspace_id'] === 'string' ? params['workspace_id'] : ctx.workspaceId;

  if (wid !== ctx.workspaceId) {
    return textResult('Error: workspace_id does not match authenticated workspace.');
  }

  const records = drainPendingIntents(wid);

  if (records.length === 0) {
    return jsonResult({ intents: [], message: 'No pending design intents for this workspace.' });
  }

  // Return the full IntentMessage array so the agent can act on each intent
  // without a separate round-trip. The same data is pushed proactively over
  // SSE as INTENT_RECEIVED — this poll path exists as a fallback and for
  // agents that do not maintain a persistent SSE connection.
  const intents = records.map(recordToIntentMessage);
  return jsonResult({ intents });
}

async function handleResolveComponent(ctx: ToolContext): Promise<ToolResult<unknown>> {
  const params = ctx.params as Params;
  const componentName = typeof params['component_name'] === 'string' ? params['component_name'] : null;

  if (!componentName) {
    return textResult('Error: component_name is required.');
  }

  // Check if a CLI indexer is registered for this workspace.
  const indexerUrl = getIndexerUrl(ctx.workspaceId);
  if (!indexerUrl) {
    return textResult(
      `No CLI indexer registered for workspace ${ctx.workspaceId}. ` +
      'Run "npx @originmain/cli dev" to enable component resolution.',
    );
  }

  // Proxy to GET /components?name=<componentName> on the CLI indexer.
  // The indexer returns ComponentEntry[] — we return the first exact or best match.
  try {
    const url = new URL('/components', indexerUrl);
    url.searchParams.set('name', componentName);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      return textResult(`Indexer returned ${res.status}: ${await res.text()}`);
    }

    const entries = (await res.json()) as Array<{
      name: string;
      definitionFile: string;
      relativeFile: string;
      lineNumber: number;
      props: Array<{ name: string; type: string; optional: boolean }>;
      tokensUsed: string[];
    }>;

    if (!entries.length) {
      return textResult(`Component "${componentName}" not found in index. Make sure the CLI indexer has indexed this file.`);
    }

    // Prefer exact name match; fall back to first fuzzy result.
    const match = entries.find((e) => e.name === componentName) ?? entries[0]!;

    return jsonResult({
      name:           match.name,
      definitionFile: match.definitionFile,
      relativeFile:   match.relativeFile,
      lineNumber:     match.lineNumber,
      props:          match.props,
      tokensUsed:     match.tokensUsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return textResult(`Failed to contact CLI indexer: ${msg}`);
  }
}

async function handleUpdateDiffStatus(ctx: ToolContext): Promise<ToolResult<unknown>> {
  const params = ctx.params as Params;
  const intentId = typeof params['intent_id'] === 'string' ? params['intent_id'] : null;
  const status   = typeof params['status']    === 'string' ? params['status']    : null;
  const reason   = typeof params['reason']    === 'string' ? params['reason']    : null;

  if (!intentId || !status) {
    return textResult('Error: intent_id and status are required.');
  }

  if (status !== 'IMPLEMENTED' && status !== 'BLOCKED') {
    return textResult('Error: status must be "IMPLEMENTED" or "BLOCKED".');
  }

  if (status === 'BLOCKED' && !reason) {
    return textResult('Error: reason is required when status is "BLOCKED".');
  }

  if (!ctx.db) {
    // Fallback: no DB client available — just acknowledge.
    return textResult(`update_diff_status acknowledged: ${intentId} → ${status}${reason ? ` (${reason})` : ''}`);
  }

  try {
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (reason) updatePayload['blocked_reason'] = reason;

    // db is typed minimally; cast to any so the Supabase query chain compiles.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await ((ctx.db.from('intent_diffs') as any)
      .update(updatePayload)
      .eq('id', intentId)
      .select()
      .single() as Promise<{ data: { id: string; status: string } | null; error: { message: string } | null }>);

    if (error) return textResult(`Error updating diff status: ${error.message}`);
    if (!data) return textResult(`Error: intent ${intentId} not found.`);

    return textResult(
      `Intent ${intentId} status updated to ${status}${reason ? `: ${reason}` : ''}.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return textResult(`Failed to update diff status: ${msg}`);
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export async function dispatchTool(name: string, ctx: ToolContext): Promise<ToolResult<unknown>> {
  switch (name) {
    case 'push_intent':
      return handlePushIntent(ctx);
    case 'resolve_component':
      return handleResolveComponent(ctx);
    case 'update_diff_status':
      return handleUpdateDiffStatus(ctx);
    default:
      return textResult(`Unknown tool: ${name}`);
  }
}
