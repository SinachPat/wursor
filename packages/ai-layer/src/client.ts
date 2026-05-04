import Anthropic from '@anthropic-ai/sdk';

// ── Model constants ───────────────────────────────────────────────────────────

// Spec Layer 6: "Claude Sonnet 4 API is the only AI provider."
// claude-sonnet-4-6 supports per-call temperature (0.1 / 0.2 / 0.3 per prompt)
// which the spec requires for diff-summary, completion-zone, and agent-query.
export const MODEL = 'claude-sonnet-4-6' as const;

// ── Singleton client ──────────────────────────────────────────────────────────
// The client is created once and shared. API key is injected from the server
// environment — never exposed to the client bundle.

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
