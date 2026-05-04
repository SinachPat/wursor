// ── Artboard Query Prompt ─────────────────────────────────────────────────────
// Versioned prompt for cross-artboard design intent search.
//
// Version: 1.0
// Model:   claude-sonnet-4-6 (spec Layer 6: "Claude Sonnet 4 API is the only AI provider")
// Tokens:  max 1024 — output is a JSON results array ranked by relevance
//
// Structure:
//   System: stable role (cached) — no DLF needed for cross-artboard search
//   User:   artboard metadata array + query string (not cached — varies per call)

import type Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './system.js';

export const ARTBOARD_QUERY_PROMPT_VERSION = '1.0';

export interface ArtboardQueryPromptInput {
  /** Natural language query from the user */
  query: string;
  /** Array of artboard metadata objects serialized as JSON */
  artboardsJson: string;
}

/**
 * Builds the system + user message pair for a cross-artboard relevance search.
 * Only artboards with relevanceScore > 0.3 should be returned by the model.
 */
export function buildArtboardQueryMessages(input: ArtboardQueryPromptInput): {
  system: Anthropic.Messages.TextBlockParam[];
  userContent: string;
  maxTokens: number;
} {
  const system = buildSystemPrompt({ role: 'a search agent filtering artboards by design intent' });

  const userContent =
    `<artboards>\n${input.artboardsJson}\n</artboards>\n\n` +
    `<query>\n${input.query}\n</query>\n\n` +
    `Return a JSON object:\n` +
    `{\n` +
    `  "results": [{"artboardId": "...", "relevanceScore": 0-1, "reason": "..."}],\n` +
    `  "reasoning": "brief explanation"\n` +
    `}\n\n` +
    `Only include artboards with relevanceScore > 0.3. Respond ONLY with valid JSON.`;

  return { system, userContent, maxTokens: 1024 };
}
