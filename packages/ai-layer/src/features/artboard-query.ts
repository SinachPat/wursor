import type { AIGateway } from '../gateway.js';
import { buildSystemPrompt } from '../prompts/system.js';

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
  const system = buildSystemPrompt({ role: 'a search agent filtering artboards by design intent' });

  const response = await gateway.complete({
    system,
    messages: [
      {
        role: 'user',
        content: `<artboards>\n${input.artboardsJson}\n</artboards>\n\n<query>\n${input.query}\n</query>\n\nReturn a JSON object:\n{\n  "results": [{"artboardId": "...", "relevanceScore": 0-1, "reason": "..."}],\n  "reasoning": "brief explanation"\n}\n\nOnly include artboards with relevanceScore > 0.3. Respond ONLY with valid JSON.`,
      },
    ],
    maxTokens: 1024,
    temperature: 0.3,
  });

  // Returning empty results on parse failure is indistinguishable from "no match".
  // Throw so the UI can show an error rather than a misleading empty state.
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch (err) {
    throw new Error(
      `Artboard query returned unparseable JSON: ${String(err)}. ` +
      `Raw response (first 300 chars): ${response.text.slice(0, 300)}`
    );
  }

  return parsed as ArtboardQueryOutput;
}
