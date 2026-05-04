import type { AIGateway } from '../gateway.js';
import { buildDiffSummaryMessages, buildAggregateSummaryMessages } from '../prompts/diff-summary.prompt.js';

export interface DiffSummaryInput {
  /** Serialized component-level changes (JSON) */
  changesJson: string;
  /** Component name */
  componentName: string;
  /** Active DLF as JSON string — passed through for rule-violation annotation */
  dlfJson?: string;
}

export interface DiffSummaryOutput {
  summary: string;
}

export async function generateDiffSummary(
  gateway: AIGateway,
  input: DiffSummaryInput
): Promise<DiffSummaryOutput> {
  const { system, userContent, maxTokens } = buildDiffSummaryMessages(input);

  const response = await gateway.complete({
    system,
    messages:    [{ role: 'user', content: userContent }],
    maxTokens,
    temperature: 0.2,  // spec Layer 6.3: 0.2 for diff-summary (consistent output)
  });

  return { summary: response.text.trim() };
}

// ── Aggregate summary ─────────────────────────────────────────────────────────

export interface AggregateSummaryInput {
  /** All changes in the diff as serialized JSON */
  changesJson: string;
  /** Human-readable artboard name, e.g. "Homepage Hero" */
  artboardName: string;
  /** Active DLF as JSON string — used to flag rule violations in the summary */
  dlfJson?: string;
}

export interface AggregateSummaryOutput {
  summary: string;
}

/**
 * Generates a 2-3 sentence summary of ALL changes across a single diff
 * (artboard-level granularity, suitable for the diff card header and PR body).
 * Uses buildAggregateSummaryMessages — the session-level counterpart of
 * buildDiffSummaryMessages (component-level).
 */
export async function generateAggregateSummary(
  gateway: AIGateway,
  input: AggregateSummaryInput,
): Promise<AggregateSummaryOutput> {
  const { system, userContent, maxTokens } = buildAggregateSummaryMessages({
    changesJson:  input.changesJson,
    artboardName: input.artboardName,
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const response = await gateway.complete({
    system,
    messages:    [{ role: 'user', content: userContent }],
    maxTokens,
    temperature: 0.2,  // same as per-component summary — deterministic aggregate
  });

  return { summary: response.text.trim() };
}
