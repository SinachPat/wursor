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

### Implementation Workflow
1. Call \`push_intent\` to receive any pending design intent diffs from the Origin canvas.
2. Locate the component file using \`resolve_component\` (pass the \`nodeId\` from the intent).
3. Apply the change to the source file — the intent's \`codeDiff\` contains the expected before/after.
4. After applying, call \`update_diff_status\` with \`status: "IMPLEMENTED"\` and the \`intentId\`.
5. If the diff cannot be applied for any reason, call \`update_diff_status\` with \`status: "BLOCKED"\`
   and a \`reason\` string describing why (e.g. "Component not found in file", "File is read-only",
   "Diff conflicts with current file state"). The designer will see this reason in the Origin canvas.

### Important: Always close the loop with update_diff_status
Every intent received via \`push_intent\` MUST be closed with \`update_diff_status\` — either
IMPLEMENTED or BLOCKED. An intent left in EXPORTED state will be retried on the next session.

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
