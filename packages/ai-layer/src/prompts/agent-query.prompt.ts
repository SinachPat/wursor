// ── Agent Query Prompt ────────────────────────────────────────────────────────
// Versioned prompt for answering coding-agent questions about design diffs.
//
// Version: 1.0
// Model:   claude-sonnet-4-6 (spec Layer 6: "Claude Sonnet 4 API is the only AI provider")
// Tokens:  max 1024 — JSON with answer + optional visual reference
//
// Structure:
//   System: stable role (cached) + optional DLF constraint block (cached)
//   User:   [before screenshot] + [after screenshot] + artboard context +
//           diff ID + agent question (spec Layer 6.3-R3: screenshots required)

import type Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './system.js';

export const AGENT_QUERY_PROMPT_VERSION = '1.0';

export interface AgentQueryPromptInput {
  /** Question from the coding agent (e.g. Cursor or Claude Code) */
  question: string;
  /** The diff ID this question is about */
  diffId: string;
  /** Full artboard context (IntentDiff + artboard metadata) as JSON */
  artboardContextJson: string;
  /** Active DLF as JSON string (optional — cached in system when present) */
  dlfJson?: string;
  /**
   * Before-state screenshot as base64 data URL (spec Layer 6.3-R3).
   * Gives the model visual ground truth of what the artboard looked like
   * before the diff was applied.
   */
  beforeScreenshotBase64?: string;
  /**
   * After-state screenshot as base64 data URL (spec Layer 6.3-R3).
   * Gives the model the proposed post-diff visual state.
   */
  afterScreenshotBase64?: string;
}

function stripDataUrl(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

/**
 * Builds the system + user content blocks for a coding-agent design question.
 * When screenshots are provided they precede the text context so the model can
 * visually ground its answer before reading the structured JSON.
 * Max 1024 tokens — the answer must be precise and actionable.
 */
export function buildAgentQueryMessages(input: AgentQueryPromptInput): {
  system: Anthropic.Messages.TextBlockParam[];
  userContent: Anthropic.Messages.ContentBlockParam[];
  maxTokens: number;
} {
  const system = buildSystemPrompt({
    role: 'a design agent answering questions from a coding agent implementing a design diff',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];

  // Screenshots first — visual context before text, per multimodal best practice.
  if (input.beforeScreenshotBase64) {
    userContent.push({
      type:   'text',
      text:   'Before state (artboard before this diff was applied):',
    });
    userContent.push({
      type:   'image',
      source: { type: 'base64', media_type: 'image/png', data: stripDataUrl(input.beforeScreenshotBase64) },
    } as Anthropic.Messages.ImageBlockParam);
  }

  if (input.afterScreenshotBase64) {
    userContent.push({
      type: 'text',
      text: 'After state (proposed artboard after this diff is applied):',
    });
    userContent.push({
      type:   'image',
      source: { type: 'base64', media_type: 'image/png', data: stripDataUrl(input.afterScreenshotBase64) },
    } as Anthropic.Messages.ImageBlockParam);
  }

  userContent.push({
    type: 'text',
    text:
      `<artboard_context>\n${input.artboardContextJson}\n</artboard_context>\n\n` +
      `<diff_id>${input.diffId}</diff_id>\n\n` +
      `<question>\n${input.question}\n</question>\n\n` +
      `Answer the coding agent's question concisely and precisely. ` +
      `If the answer references a specific design token, component, or visual region, ` +
      `include a "visualReference" field. Return JSON:\n` +
      `{\n  "answer": "...",\n  "visualReference": "..." (optional)\n}\n\n` +
      `Respond ONLY with valid JSON.`,
  });

  return { system, userContent, maxTokens: 1024 };
}
