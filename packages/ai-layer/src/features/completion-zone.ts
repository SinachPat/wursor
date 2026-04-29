import type Anthropic from '@anthropic-ai/sdk';
import { AIGateway } from '../gateway.js';
import { buildSystemPrompt } from '../prompts/system.js';
import type { GatewayResponse } from '../gateway.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompletionZoneInput {
  /** JSON of the surrounding component tree */
  componentTreeJson: string;
  /** User intent / what the zone should be filled with */
  intent: string;
  /** Active Design Language File as JSON string */
  dlfJson?: string;
  /** Before screenshot as base64 data URL (optional) */
  screenshotBase64?: string;
}

export interface CompletionZoneOutput {
  /** Proposed component tree changes as structured JSON */
  proposedTree: unknown;
  /** Natural language description of the proposed change */
  description: string;
  raw: GatewayResponse;
}

// ── Feature ───────────────────────────────────────────────────────────────────

export async function fillCompletionZone(
  gateway: AIGateway,
  input: CompletionZoneInput,
  maxRetries = 3
): Promise<CompletionZoneOutput> {
  const system = buildSystemPrompt({
    role: 'a Completion Zone design agent',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: 'text',
      text: `<component_tree>\n${input.componentTreeJson}\n</component_tree>\n\n<intent>\n${input.intent}\n</intent>\n\nReturn a JSON object with two fields:\n- "proposedTree": the updated component tree matching the intent\n- "description": a one-sentence description of the change\n\nRespond ONLY with valid JSON.`,
    },
  ];

  if (input.screenshotBase64) {
    userContent.unshift({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: input.screenshotBase64.replace(/^data:image\/\w+;base64,/, '') },
    } as Anthropic.Messages.ImageBlockParam);
  }

  // Retry up to maxRetries times on invalid JSON output
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await gateway.complete({
      system,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 4096,
    });

    try {
      const parsed = JSON.parse(response.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim());
      return { proposedTree: parsed.proposedTree as unknown, description: String(parsed.description ?? ''), raw: response };
    } catch (parseErr) {
      lastError = new Error(
        `AI returned invalid JSON on attempt ${attempt + 1}: ${String(parseErr)}. ` +
        `Raw response (first 200 chars): ${response.text.slice(0, 200)}`
      );
    }
  }

  throw lastError ?? new Error('Completion zone fill failed after retries');
}

