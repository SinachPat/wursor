import { z } from 'zod';
import { checkRateLimit } from './rate-limiter.js';
import { jsonResult, textResult, MCP_ERROR } from './protocol.js';
import type { ToolResult, JsonRpcError } from './protocol.js';
import type { DiffStatus } from '@originmain/origin-graph';

// ── Tool context (injected per-connection) ────────────────────────────────────

export interface ToolContext {
  workspaceId: string;
  /** Adapter to the Origin Graph data layer */
  db: {
    getDiffsByStatus(workspaceId: string, status: DiffStatus): Promise<unknown[]>;
    getDiff(id: string): Promise<unknown>;
    getArtboard(id: string): Promise<unknown>;
    getDesignLanguageFile(workspaceId: string): Promise<unknown | null>;
    updateDiffStatus(id: string, status: DiffStatus, notes?: string): Promise<void>;
  };
  /** Adapter to the AI layer (for ask_design_agent) */
  ai: {
    answerAgentQuestion(diffId: string, question: string, artboardContext: unknown): Promise<string>;
  };
}

// ── Tool definition ───────────────────────────────────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute(params: unknown, ctx: ToolContext): Promise<ToolResult<unknown> | JsonRpcError>;
}

// ── Rate-limited wrapper ──────────────────────────────────────────────────────

function rateGuard(workspaceId: string): JsonRpcError | null {
  const { allowed } = checkRateLimit(workspaceId);
  if (!allowed) {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: MCP_ERROR.RATE_LIMITED, message: 'Rate limit exceeded: 100 diff exports per hour per workspace' },
    };
  }
  return null;
}

function notFound(id: string, type: string): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id: null,
    error: { code: MCP_ERROR.NOT_FOUND, message: `${type} ${id} not found` },
  };
}

// ── Tool: get_pending_diffs ───────────────────────────────────────────────────

const GetPendingDiffsInput = z.object({
  workspace_id: z.string().uuid(),
  artboard_id: z.string().uuid().optional(),
});

const getPendingDiffs: McpTool = {
  name: 'get_pending_diffs',
  description: 'Returns all IntentDiff objects with EXPORTED status for the workspace.',
  inputSchema: GetPendingDiffsInput,
  async execute(params, ctx) {
    const guard = rateGuard(ctx.workspaceId);
    if (guard) return guard;

    const { artboard_id } = GetPendingDiffsInput.parse(params);
    const diffs = await ctx.db.getDiffsByStatus(ctx.workspaceId, 'EXPORTED');

    const filtered = artboard_id
      ? (diffs as Array<{ artboard_id: string }>).filter(d => d.artboard_id === artboard_id)
      : diffs;

    return jsonResult(filtered);
  },
};

// ── Tool: get_artboard_context ────────────────────────────────────────────────

const GetArtboardContextInput = z.object({
  artboard_id: z.string().uuid(),
});

const getArtboardContext: McpTool = {
  name: 'get_artboard_context',
  description: 'Returns full artboard metadata, component tree, design language file, and before/after screenshots.',
  inputSchema: GetArtboardContextInput,
  async execute(params, ctx) {
    const { artboard_id } = GetArtboardContextInput.parse(params);
    const artboard = await ctx.db.getArtboard(artboard_id);
    if (artboard == null) return notFound(artboard_id, 'Artboard');
    const dlf = await ctx.db.getDesignLanguageFile(ctx.workspaceId);
    return jsonResult({ artboard, designLanguageFile: dlf });
  },
};

// ── Tool: ask_design_agent ────────────────────────────────────────────────────

const AskDesignAgentInput = z.object({
  diff_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

const askDesignAgent: McpTool = {
  name: 'ask_design_agent',
  description: 'Ask the design AI agent a question about a specific diff. Returns a Claude-generated answer with visual reference.',
  inputSchema: AskDesignAgentInput,
  async execute(params, ctx) {
    const { diff_id, question } = AskDesignAgentInput.parse(params);

    // Fetch the diff first to resolve its artboard_id, then fetch the artboard.
    const diff = await ctx.db.getDiff(diff_id);
    if (diff == null) return notFound(diff_id, 'IntentDiff');
    const artboardId = (diff as { artboard_id: string }).artboard_id;
    const artboard = await ctx.db.getArtboard(artboardId);
    if (artboard == null) return notFound(artboardId, 'Artboard');

    const answer = await ctx.ai.answerAgentQuestion(diff_id, question, artboard);
    return textResult(answer);
  },
};

// ── Tool: update_diff_status ──────────────────────────────────────────────────

const UpdateDiffStatusInput = z.object({
  diff_id: z.string().uuid(),
  status: z.enum(['IMPLEMENTED', 'BLOCKED']),
  notes: z.string().max(1000).optional(),
});

const updateDiffStatus: McpTool = {
  name: 'update_diff_status',
  description: 'Acknowledges implementation or reports a block. Updates the diff status in the Origin Graph.',
  inputSchema: UpdateDiffStatusInput,
  async execute(params, ctx) {
    const { diff_id, status, notes } = UpdateDiffStatusInput.parse(params);
    await ctx.db.updateDiffStatus(diff_id, status, notes);
    return textResult(`Diff ${diff_id} status updated to ${status}`);
  },
};

// ── Tool: get_design_language ─────────────────────────────────────────────────

const GetDesignLanguageInput = z.object({
  workspace_id: z.string().uuid(),
});

const getDesignLanguage: McpTool = {
  name: 'get_design_language',
  description: 'Returns the team\'s active Design Language File for local validation by the coding agent.',
  inputSchema: GetDesignLanguageInput,
  async execute(params, ctx) {
    // Validate the input even though we use the connection-scoped workspaceId.
    // This ensures MCP clients send well-formed requests and the schema is enforced.
    GetDesignLanguageInput.parse(params);
    const dlf = await ctx.db.getDesignLanguageFile(ctx.workspaceId);
    if (!dlf) return textResult('No design language file configured for this workspace.');
    return jsonResult(dlf);
  },
};

// ── Tool registry ─────────────────────────────────────────────────────────────

export const TOOLS: McpTool[] = [
  getPendingDiffs,
  getArtboardContext,
  askDesignAgent,
  updateDiffStatus,
  getDesignLanguage,
];

export const TOOL_MAP = new Map(TOOLS.map(t => [t.name, t]));

/** Returns the MCP-spec JSON Schema listing for all tools. */
export function getToolList() {
  return TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: { type: 'object', ...zodToJsonSchema(t.inputSchema) },
  }));
}

// ── Minimal Zod → JSON Schema ─────────────────────────────────────────────────
// Handles the subset of Zod types used by the 5 tools above.
// Throws at startup if an unsupported type is encountered — fail loud, not silent.

function zodToJsonSchema(schema: z.ZodTypeAny): { properties?: Record<string, unknown>; required?: string[] } {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, field] of Object.entries(shape)) {
      properties[key] = zodFieldToSchema(field);
      if (!(field instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { properties, ...(required.length > 0 ? { required } : {}) };
  }
  throw new Error(`zodToJsonSchema: unsupported top-level type ${schema.constructor.name}`);
}

function zodFieldToSchema(field: z.ZodTypeAny): unknown {
  if (field instanceof z.ZodOptional) return zodFieldToSchema(field.unwrap());
  if (field instanceof z.ZodString) return { type: 'string' };
  if (field instanceof z.ZodEnum) return { type: 'string', enum: field.options as string[] };
  if (field instanceof z.ZodNumber) return { type: 'number' };
  if (field instanceof z.ZodBoolean) return { type: 'boolean' };
  throw new Error(`zodToJsonSchema: unsupported field type ${field.constructor.name}`);
}
