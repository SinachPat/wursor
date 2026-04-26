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
1. \`get_pending_diffs\` → list EXPORTED IntentDiffs that need code changes
2. \`get_artboard_context\` → load component tree, screenshots, and design language
3. Implement the required changes in the codebase
4. \`ask_design_agent\` → clarify design intent when the diff is ambiguous
5. \`update_diff_status\` → mark IMPLEMENTED or BLOCKED with an explanation

### Design Language Validation
Run \`get_design_language\` at session start to cache the team's active Design Language File.
All token references (colors, typography, spacing) must match the DLF.

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
