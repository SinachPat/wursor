import type { AIGateway } from '../gateway.js';
import { buildArtboardQueryMessages } from '../prompts/artboard-query.prompt.js';

export interface ArtboardQueryInput {
  /** Natural language query from the user */
  query: string;
  /** Array of artboard metadata objects as JSON */
  artboardsJson: string;
}

export interface ArtboardQueryResult {
  artboardId: string;
  relevanceScore: number;
  reason: string;
}

export interface ArtboardQueryOutput {
  results: ArtboardQueryResult[];
  reasoning: string;
}

export async function queryCrossArtboard(
  gateway: AIGateway,
  input: ArtboardQueryInput
): Promise<ArtboardQueryOutput> {
  const { system, userContent, maxTokens } = buildArtboardQueryMessages(input);

  const response = await gateway.complete({
    system,
    messages:    [{ role: 'user', content: userContent }],
    maxTokens,
    temperature: 0.1,  // spec Layer 10.2: 0.1 for workspace queries (factual)
  });

  // Returning empty results on parse failure is indistinguishable from "no match".
  // Throw so the UI can show an error rather than a misleading empty state.
  // Strip markdown code fences that the model occasionally adds despite instructions.
  const rawText = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Artboard query returned unparseable JSON: ${String(err)}. ` +
      `Raw response (first 300 chars): ${response.text.slice(0, 300)}`
    );
  }

  // Runtime guard: ensure the parsed value has the expected shape before casting.
  // Without this, a malformed AI response (e.g. { results: null }) would let
  // callers hit a TypeError on `.results.map()` instead of a clear error message.
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>)['results'])
  ) {
    throw new Error(
      `Artboard query response missing "results" array. ` +
      `Raw response (first 300 chars): ${response.text.slice(0, 300)}`
    );
  }

  return parsed as ArtboardQueryOutput;
}
