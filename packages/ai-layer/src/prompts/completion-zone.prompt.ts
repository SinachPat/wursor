// ── Completion Zone Prompt ────────────────────────────────────────────────────
// Versioned prompt for filling AI Completion Zones.
//
// Version: 1.0
// Model:   claude-sonnet-4-6 (spec Layer 6: "Claude Sonnet 4 API is the only AI provider")
// Tokens:  max 4096 — output is a structured JSON tree
//
// Structure:
//   System: stable role (cached) + DLF as a hard constraint block (cached)
//   User:   component tree context + optional screenshot + zone intent string
//
// The DLF is placed first (before the component tree) so it is cached across
// all completion zone calls in the same workspace session. The model must treat
// the DLF as a hard constraint: any proposed component must exist in the DLF's
// component list, and all props must pass the DLF's allowedProps rules.

import type Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './system.js';

export const COMPLETION_ZONE_PROMPT_VERSION = '1.0';

export interface CompletionZonePromptInput {
  componentTreeJson: string;
  intent: string;
  dlfJson?: string;
  screenshotBase64?: string;
}

/**
 * Builds the full message array for a completion zone generation request.
 * Returns a multi-part user message that includes an optional image block.
 */
export function buildCompletionZoneMessages(input: CompletionZonePromptInput): {
  system: Anthropic.Messages.TextBlockParam[];
  userContent: Anthropic.Messages.ContentBlockParam[];
  maxTokens: number;
} {
  const system = buildSystemPrompt({
    role: 'a Completion Zone design agent that generates UI component trees to fill empty design regions',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const textBlock: Anthropic.Messages.TextBlockParam = {
    type: 'text',
    text:
      `<component_tree>\n${input.componentTreeJson}\n</component_tree>\n\n` +
      `<intent>\n${input.intent}\n</intent>\n\n` +
      (input.dlfJson
        ? `The DLF in the system prompt is a HARD CONSTRAINT. Only use components and prop values defined there.\n\n`
        : '') +
      `Return a JSON object with exactly two fields:\n` +
      `- "proposedTree": the updated component tree matching the intent (same shape as the input tree)\n` +
      `- "description": one sentence describing what was generated and why\n\n` +
      `Respond ONLY with valid JSON. No markdown, no prose outside the JSON.`,
  };

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];

  // Screenshot goes first if provided (visual context before textual context).
  if (input.screenshotBase64) {
    const base64Data = input.screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: base64Data },
    } as Anthropic.Messages.ImageBlockParam);
  }

  userContent.push(textBlock);

  return { system, userContent, maxTokens: 4096 };
}
