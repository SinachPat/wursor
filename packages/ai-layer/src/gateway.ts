import Anthropic from '@anthropic-ai/sdk';
import { getClient, MODEL } from './client.js';
import { generateDiffSummary, generateAggregateSummary } from './features/diff-summary.js';
import { fillCompletionZone } from './features/completion-zone.js';
import { queryCrossArtboard } from './features/artboard-query.js';
import { answerAgentQuestion } from './features/agent-qa.js';
import type { DiffSummaryInput, DiffSummaryOutput, AggregateSummaryInput, AggregateSummaryOutput } from './features/diff-summary.js';
import type { CompletionZoneInput, CompletionZoneOutput } from './features/completion-zone.js';
import type { ArtboardQueryInput, ArtboardQueryOutput } from './features/artboard-query.js';
import type { AgentQAInput, AgentQAOutput } from './features/agent-qa.js';

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

// Spec Layer 6: claude-sonnet-4-6 pricing (used for cost attribution logging)
const SONNET_4_INPUT_COST_PER_M  = 300;  // $3.00 / 1M input tokens
const SONNET_4_OUTPUT_COST_PER_M = 1500; // $15.00 / 1M output tokens
const SONNET_4_CACHE_READ_PER_M  = 30;   // $0.30 / 1M cache-read tokens

function computeCost(usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): RequestCost {
  const inputTokens     = usage.input_tokens;
  const outputTokens    = usage.output_tokens;
  const cacheReadTokens = usage.cache_read_input_tokens  ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  const billableInput = inputTokens - cacheReadTokens;
  const estimatedCentsCost = Math.round(
    (billableInput    / 1_000_000) * SONNET_4_INPUT_COST_PER_M +
    (outputTokens     / 1_000_000) * SONNET_4_OUTPUT_COST_PER_M +
    (cacheReadTokens  / 1_000_000) * SONNET_4_CACHE_READ_PER_M
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
  messages:    Anthropic.Messages.MessageParam[];
  system?:     Anthropic.Messages.TextBlockParam[];
  maxTokens?:  number;
  /**
   * Sampling temperature — spec Layer 6.3 per-prompt values:
   *   diff-summary:    0.2  (consistent, low-creativity summaries)
   *   completion-zone: 0.3  (slight creative latitude for UI generation)
   *   agent-query:     0.1  (factual/authoritative answers)
   * Defaults to 0.2 if omitted. Range [0, 1].
   */
  temperature?: number;
  /**
   * Workspace ID for per-workspace cost attribution (spec Layer 6.2-R2).
   * Logged on every request so cost can be aggregated per workspace.
   */
  workspaceId?: string;
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

    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const startMs   = Date.now();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model:       MODEL,
          max_tokens:  req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.2,
          ...(req.system !== undefined ? { system: req.system } : {}),
          messages:    req.messages,
        });

        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('');

        const cost      = computeCost(response.usage);
        const latencyMs = Date.now() - startMs;
        this.totalCost += cost.estimatedCentsCost;

        // ── Structured request log (spec Layer 6.2-R4) ──────────────────────
        // Every AI call is logged with: requestId, model, token counts, cost
        // estimate, latency, and workspace ID for per-workspace attribution.
        console.log(JSON.stringify({
          level:           'info',
          event:           'ai_request',
          requestId,
          model:           MODEL,
          workspaceId:     req.workspaceId ?? null,
          inputTokens:     cost.inputTokens,
          outputTokens:    cost.outputTokens,
          cacheReadTokens: cost.cacheReadTokens,
          cacheWriteTokens: cost.cacheWriteTokens,
          estimatedCents:  cost.estimatedCentsCost,
          latencyMs,
          attempt,
        }));

        return { content: response.content, text, cost };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const latencyMs = Date.now() - startMs;

        // Log every failed attempt for observability
        console.error(JSON.stringify({
          level:       'error',
          event:       'ai_request_error',
          requestId,
          model:       MODEL,
          workspaceId: req.workspaceId ?? null,
          attempt,
          latencyMs,
          error:       lastError.message,
        }));

        // Retry on 429, 529, 5xx, and network errors (no HTTP status).
        // Break immediately on client errors (4xx that aren't rate-limits).
        if (err instanceof Anthropic.APIError) {
          const { status } = err;
          if (status !== 429 && status !== 529 && status < 500) break;
        }
        // Non-APIError (network timeout, DNS failure, etc.) → always retry.
        // Cap at 30s so a long retry sequence doesn't wedge the server forever.
        const delayMs = Math.min(2 ** attempt * 1000, 30_000);
        await sleep(delayMs);
      }
    }

    throw lastError ?? new Error('AI gateway request failed');
  }

  /** Cumulative estimated cost in cents since this gateway was instantiated. */
  getCumulativeCost(): number {
    return this.totalCost;
  }

  // ── Spec Layer 5 convenience methods ─────────────────────────────────────────
  // Thin wrappers that delegate to the standalone feature functions, making the
  // gateway usable as a single dependency injection point across the app layer.

  generateDiffSummary(input: DiffSummaryInput): Promise<DiffSummaryOutput> {
    return generateDiffSummary(this, input);
  }

  generateAggregateSummary(input: AggregateSummaryInput): Promise<AggregateSummaryOutput> {
    return generateAggregateSummary(this, input);
  }

  fillCompletionZone(input: CompletionZoneInput): Promise<CompletionZoneOutput> {
    return fillCompletionZone(this, input);
  }

  queryArtboards(input: ArtboardQueryInput): Promise<ArtboardQueryOutput> {
    return queryCrossArtboard(this, input);
  }

  answerAgentQuery(input: AgentQAInput): Promise<AgentQAOutput> {
    return answerAgentQuestion(this, input);
  }
}
