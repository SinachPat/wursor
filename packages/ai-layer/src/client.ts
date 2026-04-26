import Anthropic from '@anthropic-ai/sdk';

// ── Model constants ───────────────────────────────────────────────────────────

export const MODEL = 'claude-opus-4-7' as const;

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
