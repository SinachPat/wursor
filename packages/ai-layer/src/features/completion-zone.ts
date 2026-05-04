import { z } from 'zod';
import { AIGateway } from '../gateway.js';
import { buildCompletionZoneMessages } from '../prompts/completion-zone.prompt.js';
import type { GatewayResponse } from '../gateway.js';

// ── Output schema (spec Layer 6.3-R2: validated with Zod before accepting) ────
// The model MUST return exactly these two fields. We validate the shape before
// returning to callers so a malformed AI response never reaches the canvas store.

const CompletionZoneResultSchema = z.object({
  proposedTree: z.unknown(),        // arbitrary component tree — shape validated downstream
  description:  z.string().min(1),  // non-empty natural-language summary
});

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
  /** Workspace ID for per-workspace cost attribution (spec Layer 6) */
  workspaceId?: string;
}

export interface CompletionZoneOutput {
  /** Proposed component tree changes as structured JSON — Zod-validated shape */
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
  const { system, userContent, maxTokens } = buildCompletionZoneMessages(input);

  // Retry up to maxRetries times on invalid JSON or Zod-invalid output
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await gateway.complete({
      system,
      messages:    [{ role: 'user', content: userContent }],
      maxTokens,
      temperature: 0.3,  // spec Layer 6.3: 0.3 for completion-zone (creative latitude)
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
    });

    // Strip markdown fences the model occasionally adds despite instructions
    const raw = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      lastError = new Error(
        `AI returned invalid JSON on attempt ${attempt + 1}: ${String(parseErr)}. ` +
        `Raw response (first 200 chars): ${response.text.slice(0, 200)}`
      );
      continue;
    }

    // Validate shape with Zod before accepting (spec Layer 6.3-R2)
    const validated = CompletionZoneResultSchema.safeParse(parsed);
    if (!validated.success) {
      lastError = new Error(
        `AI response failed schema validation on attempt ${attempt + 1}: ` +
        validated.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') +
        `. Raw response (first 200 chars): ${response.text.slice(0, 200)}`
      );
      continue;
    }

    return {
      proposedTree: validated.data.proposedTree,
      description:  validated.data.description,
      raw:          response,
    };
  }

  throw lastError ?? new Error('Completion zone fill failed after retries');
}
