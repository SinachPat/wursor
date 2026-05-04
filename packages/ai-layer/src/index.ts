export { getClient, MODEL } from './client.js';
export { AIGateway } from './gateway.js';
export type { GatewayRequest, GatewayResponse, RequestCost } from './gateway.js';

// ── Versioned prompt builders ─────────────────────────────────────────────────
export { DIFF_SUMMARY_PROMPT_VERSION, buildDiffSummaryMessages, buildAggregateSummaryMessages } from './prompts/diff-summary.prompt.js';
export type { DiffSummaryPromptInput, AggregateSummaryPromptInput } from './prompts/diff-summary.prompt.js';

export { COMPLETION_ZONE_PROMPT_VERSION, buildCompletionZoneMessages } from './prompts/completion-zone.prompt.js';
export type { CompletionZonePromptInput } from './prompts/completion-zone.prompt.js';

export { ARTBOARD_QUERY_PROMPT_VERSION, buildArtboardQueryMessages } from './prompts/artboard-query.prompt.js';
export type { ArtboardQueryPromptInput } from './prompts/artboard-query.prompt.js';

export { AGENT_QUERY_PROMPT_VERSION, buildAgentQueryMessages } from './prompts/agent-query.prompt.js';
export type { AgentQueryPromptInput } from './prompts/agent-query.prompt.js';

export { fillCompletionZone } from './features/completion-zone.js';
export type { CompletionZoneInput, CompletionZoneOutput } from './features/completion-zone.js';

export { generateDiffSummary, generateAggregateSummary } from './features/diff-summary.js';
export type { DiffSummaryInput, DiffSummaryOutput, AggregateSummaryInput, AggregateSummaryOutput } from './features/diff-summary.js';

export { queryCrossArtboard } from './features/artboard-query.js';
export type { ArtboardQueryInput, ArtboardQueryOutput, ArtboardQueryResult } from './features/artboard-query.js';

export { generateDriftReport } from './features/drift-report.js';
export type { DriftReportInput, DriftReportOutput, DriftViolation } from './features/drift-report.js';

export { answerAgentQuestion } from './features/agent-qa.js';
export type { AgentQAInput, AgentQAOutput } from './features/agent-qa.js';
