export { getClient, MODEL } from './client.js';
export { AIGateway } from './gateway.js';
export type { GatewayRequest, GatewayResponse, RequestCost } from './gateway.js';

export { fillCompletionZone } from './features/completion-zone.js';
export type { CompletionZoneInput, CompletionZoneOutput } from './features/completion-zone.js';

export { generateDiffSummary } from './features/diff-summary.js';
export type { DiffSummaryInput, DiffSummaryOutput } from './features/diff-summary.js';

export { queryCrossArtboard } from './features/artboard-query.js';
export type { ArtboardQueryInput, ArtboardQueryOutput, ArtboardQueryResult } from './features/artboard-query.js';

export { generateDriftReport } from './features/drift-report.js';
export type { DriftReportInput, DriftReportOutput, DriftViolation } from './features/drift-report.js';

export { answerAgentQuestion } from './features/agent-qa.js';
export type { AgentQAInput, AgentQAOutput } from './features/agent-qa.js';
