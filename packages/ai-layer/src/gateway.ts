import Anthropic from '@anthropic-ai/sdk';
import { getClient, MODEL } from './client.js';

// ── Gateway config ────────────────────────────────────────────────────────────

interface GatewayConfig {
  /** Max requests per minute (default: 60) */
  rpmLimit?: number;
  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;
}

// ── Cost tracking ─────────────────────────────────────────────────────────────

export interface RequestCost {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Estimated cost in USD cents */
  estimatedCentsCost: number;
}

const OPUS_4_INPUT_COST_PER_M = 500;    // $5.00 / 1M
const OPUS_4_OUTPUT_COST_PER_M = 2500;  // $25.00 / 1M
const OPUS_4_CACHE_READ_PER_M = 50;     // $0.50 / 1M (estimated)

function computeCost(usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): RequestCost {
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  const billableInput = inputTokens - cacheReadTokens;
  const estimatedCentsCost = Math.round(
    (billableInput / 1_000_000) * OPUS_4_INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * OPUS_4_OUTPUT_COST_PER_M +
    (cacheReadTokens / 1_000_000) * OPUS_4_CACHE_READ_PER_M
  );

  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, estimatedCentsCost };
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

class RateLimiter {
  private readonly rpm: number;
  private timestamps: number[] = [];

  constructor(rpm: number) { this.rpm = rpm; }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);
    if (this.timestamps.length >= this.rpm) {
      const oldest = this.timestamps[0];
      if (oldest !== undefined) {
        const wait = 60_000 - (now - oldest);
        if (wait > 0) await sleep(wait);
      }
    }
    this.timestamps.push(Date.now());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Gateway ───────────────────────────────────────────────────────────────────

export interface GatewayRequest {
  messages: Anthropic.Messages.MessageParam[];
  system?: Anthropic.Messages.TextBlockParam[];
  maxTokens?: number;
  // NOTE: temperature is intentionally omitted — claude-opus-4-7 with
  // adaptive thinking rejects temperature, top_p, and top_k with a 400 error.
}

export interface GatewayResponse {
  content: Anthropic.Messages.ContentBlock[];
  text: string;
  cost: RequestCost;
}

export class AIGateway {
  private readonly client: Anthropic;
  private readonly rateLimiter: RateLimiter;
  private readonly maxRetries: number;
  private totalCost = 0; // cumulative cents

  constructor(config: GatewayConfig = {}) {
    this.client = getClient();
    this.rateLimiter = new RateLimiter(config.rpmLimit ?? 60);
    this.maxRetries = config.maxRetries ?? 3;
  }

  async complete(req: GatewayRequest): Promise<GatewayResponse> {
    await this.rateLimiter.acquire();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: req.maxTokens ?? 4096,
          thinking: { type: 'adaptive' },
          ...(req.system !== undefined ? { system: req.system } : {}),
          messages: req.messages,
        });

        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('');

        const cost = computeCost(response.usage);
        this.totalCost += cost.estimatedCentsCost;

        return { content: response.content, text, cost };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Retry on 429, 529, 5xx, and network errors (no HTTP status).
        // Break immediately on client errors (4xx that aren't rate-limits).
        if (err instanceof Anthropic.APIError) {
          const { status } = err;
          if (status !== 429 && status !== 529 && status < 500) break;
        }
        // Non-APIError (network timeout, DNS failure, etc.) → always retry
        await sleep(2 ** attempt * 1000);
      }
    }

    throw lastError ?? new Error('AI gateway request failed');
  }

  /** Cumulative estimated cost in cents since this gateway was instantiated. */
  getCumulativeCost(): number {
    return this.totalCost;
  }
}
