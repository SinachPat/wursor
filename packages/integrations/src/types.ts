import { z } from 'zod';
import type { InsertOrigin } from '@originmain/origin-graph';

// ── Core ingester interface ───────────────────────────────────────────────────

export interface IngestionResult {
  origin: InsertOrigin;
  /** Human-readable label used as the artboard title */
  artboardTitle: string;
  /** URL that the Live Artboard renderer should load, if applicable */
  renderUrl?: string;
}

export interface OriginIngester<TPayload> {
  /** Validates and parses the raw webhook payload. Throws ZodError on invalid input. */
  parsePayload(raw: unknown): TPayload;
  /** Converts a validated payload into an IngestionResult.
   *  @param opts — Connector-specific options (e.g., deploymentUrl for GitHub). */
  ingest(payload: TPayload, opts?: Record<string, unknown>): IngestionResult;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export const WebhookEnvelopeSchema = z.object({
  timestamp: z.string().optional(),
  signature: z.string().optional(),
});

export type WebhookEnvelope = z.infer<typeof WebhookEnvelopeSchema>;
