import { TOOLS } from '../tools.js';

// ── Cursor adapter ────────────────────────────────────────────────────────────
// Generates the two files Cursor reads to discover MCP tools:
//   1. .cursorrules   — natural-language context injected into every prompt
//   2. cursor_settings.json — MCP server registration (added to .cursor/settings)
//
// Both are returned as strings; the caller writes them to the workspace root.

export interface CursorAdapterOptions {
  /** MCP WebSocket endpoint URL */
  mcpServerUrl: string;
  /** Signed workspace token (from issueWorkspaceToken) */
  workspaceToken: string;
  workspaceName: string;
}

export interface CursorAdapterOutput {
  cursorrules: string;
  cursorSettings: CursorSettings;
}

interface McpServerEntry {
  url: string;
  headers: Record<string, string>;
}

interface CursorSettings {
  mcpServers: Record<string, McpServerEntry>;
}

export function generateCursorConfig(opts: CursorAdapterOptions): CursorAdapterOutput {
  const toolDescriptions = TOOLS.map(t => `- **${t.name}**: ${t.description}`).join('\n');

  const cursorrules = `# Origin — Design-to-Code Agent Bridge
# Workspace: ${opts.workspaceName}
#
# You have access to the following Origin MCP tools via the connected MCP server.
# Use them to fetch design diffs, query artboard context, and report implementation status.
#
## Available Tools
${toolDescriptions}

## Workflow
1. Call \`get_pending_diffs\` to retrieve EXPORTED IntentDiffs awaiting implementation.
2. Call \`get_artboard_context\` to load component tree, design language, and screenshots.
3. Implement the diff. Use \`ask_design_agent\` if design intent is unclear.
4. Call \`update_diff_status\` with IMPLEMENTED or BLOCKED when done.

## Design Language
Always validate tokens/colors/spacing against the workspace Design Language File.
Call \`get_design_language\` once per session to cache the active DLF locally.

## Rate Limits
100 diff exports per hour per workspace. The server returns HTTP 429 when exceeded.
`;

  const cursorSettings: CursorSettings = {
    mcpServers: {
      origin: {
        url: opts.mcpServerUrl,
        headers: {
          Authorization: `Bearer ${opts.workspaceToken}`,
        },
      },
    },
  };

  return { cursorrules, cursorSettings };
}
