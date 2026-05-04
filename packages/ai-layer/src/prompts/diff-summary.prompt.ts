// ── Diff Summary Prompt ───────────────────────────────────────────────────────
// Versioned prompt for generating human-readable summaries of ComponentChange
// records and aggregate IntentDiff records.
//
// Version: 1.0
// Model:   claude-sonnet-4-6 (spec Layer 6: "Claude Sonnet 4 API is the only AI provider")
// Tokens:  max 300 per change summary, 500 for aggregate summary
//
// Structure:
//   System: stable role (cached) + optional DLF constraint block (cached)
//   User:   component changes + output instruction (not cached — varies per call)

import type Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './system.js';

export const DIFF_SUMMARY_PROMPT_VERSION = '1.0';

export interface DiffSummaryPromptInput {
  changesJson: string;
  componentName: string;
  dlfJson?: string;
}

export interface AggregateSummaryPromptInput {
  changesJson: string;
  artboardName: string;
  dlfJson?: string;
}

/**
 * Builds the system + user message pair for a single-component change summary.
 * Max 300 tokens — one tight sentence for PR review readability.
 */
export function buildDiffSummaryMessages(
  input: DiffSummaryPromptInput,
): { system: Anthropic.Messages.TextBlockParam[]; userContent: string; maxTokens: number } {
  const system = buildSystemPrompt({
    role: 'a technical writer summarizing UI component changes for pull request reviewers',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const userContent =
    `Summarize the following changes to "${input.componentName}" in one concise sentence ` +
    `(max 20 words). Focus on the user-visible impact, not technical prop names. ` +
    `If the change violates a design system rule, note it.\n\n` +
    `<changes>\n${input.changesJson}\n</changes>\n\n` +
    `Respond with ONLY the summary sentence.`;

  return { system, userContent, maxTokens: 300 };
}

/**
 * Builds the system + user message pair for an aggregate IntentDiff summary.
 * Max 500 tokens — a short paragraph describing all changes together.
 */
export function buildAggregateSummaryMessages(
  input: AggregateSummaryPromptInput,
): { system: Anthropic.Messages.TextBlockParam[]; userContent: string; maxTokens: number } {
  const system = buildSystemPrompt({
    role: 'a technical writer summarizing a design session for engineering handoff',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const userContent =
    `Write a 2-3 sentence summary of the following design changes made to the "${input.artboardName}" artboard. ` +
    `Describe the combined intent — what changed and why — in terms a developer reading a PR can understand. ` +
    `Do not list individual prop changes; synthesize them.\n\n` +
    `<changes>\n${input.changesJson}\n</changes>\n\n` +
    `Respond with ONLY the summary paragraph.`;

  return { system, userContent, maxTokens: 500 };
}
