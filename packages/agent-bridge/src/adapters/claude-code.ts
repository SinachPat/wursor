import { TOOLS } from '../tools.js';

// ── Claude Code adapter ───────────────────────────────────────────────────────
// Generates two artifacts for Claude Code MCP integration:
//   1. CLAUDE.md section  — tool reference injected into the project memory
//   2. MCP server declaration — JSON block for .claude/settings.json
//
// Claude Code discovers MCP servers from .claude/settings.json and injects
// CLAUDE.md into every session's system context automatically.

export interface ClaudeCodeAdapterOptions {
  /** MCP WebSocket endpoint URL */
  mcpServerUrl: string;
  /** Signed workspace token (from issueWorkspaceToken) */
  workspaceToken: string;
  workspaceName: string;
  /** Optional project name shown in CLAUDE.md header */
  projectName?: string;
}

export interface ClaudeCodeAdapterOutput {
  claudeMdSection: string;
  mcpServerDeclaration: ClaudeCodeMcpServer;
}

export interface ClaudeCodeMcpServer {
  name: string;
  type: 'sse' | 'stdio';
  url: string;
  headers: Record<string, string>;
}

export function generateClaudeCodeConfig(opts: ClaudeCodeAdapterOptions): ClaudeCodeAdapterOutput {
  const projectLabel = opts.projectName ?? opts.workspaceName;
  const toolLines = TOOLS.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');

  const claudeMdSection = `## Origin Design Agent Bridge — ${projectLabel}

This project is connected to an Origin MCP server that exposes design-to-code tools.
The server is pre-configured in \`.claude/settings.json\`.

### Available MCP Tools
${toolLines}

### How intents arrive
The Origin canvas pushes design intent diffs in two ways:

1. **SSE push (primary):** The MCP server sends an \`INTENT_RECEIVED\` event over the SSE
   connection automatically when the designer exports a change. You do not need to poll.

2. **Poll (fallback):** Call \`push_intent\` with \`{ workspace_id }\` to drain any pending
   intents. Use this at session start or when you suspect a missed push.

### Implementation Workflow
1. Wait for an \`INTENT_RECEIVED\` SSE event, or call \`push_intent\` to fetch pending intents.
2. Each intent includes a \`component.name\` — call \`resolve_component\` with that name to locate
   the source file and line number (e.g. \`{ component_name: "DashboardCard" }\`).
3. Apply the change to the source file. When \`codeDiff\` is present and \`confidence\` is
   \`"exact"\`, apply it verbatim. When \`"approximate"\`, use it as a guide and refine as needed.
4. After applying, call \`update_diff_status\` with \`status: "IMPLEMENTED"\` and the \`intentId\`.
5. If the diff cannot be applied for any reason, call \`update_diff_status\` with \`status: "BLOCKED"\`
   and a \`reason\` string describing why (e.g. "Component not found in file", "File is read-only",
   "Diff conflicts with current file state"). The designer will see this reason in the Origin canvas.

### Important: Always close the loop with update_diff_status
Every intent received — whether via SSE push or \`push_intent\` poll — MUST be closed with
\`update_diff_status\` using either \`IMPLEMENTED\` or \`BLOCKED\`. An intent left in \`EXPORTED\`
state will be retried on the next session.

### Design Language
When token keys are present in the intent changes (\`tokenKey\` field), write \`var(--token-name)\`
instead of the raw value so the component stays in sync with the design system.

### Rate Limit
100 diff exports/hour per workspace. If you hit the limit, wait before retrying.
`;

  const mcpServerDeclaration: ClaudeCodeMcpServer = {
    name: 'origin',
    type: 'sse',
    url: opts.mcpServerUrl,
    headers: {
      Authorization: `Bearer ${opts.workspaceToken}`,
    },
  };

  return { claudeMdSection, mcpServerDeclaration };
}
