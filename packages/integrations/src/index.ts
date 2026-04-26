export type { IngestionResult, OriginIngester, WebhookEnvelope } from './types.js';
export { WebhookEnvelopeSchema } from './types.js';

export type { LinearIssuePayload } from './connectors/linear.js';
export { linearIngester } from './connectors/linear.js';

export type { SlackMessagePayload } from './connectors/slack.js';
export { slackIngester } from './connectors/slack.js';

export type { GitHubPullRequestPayload } from './connectors/github.js';
export { githubIngester } from './connectors/github.js';

export type { IntercomWebhookPayload } from './connectors/intercom.js';
export { intercomIngester } from './connectors/intercom.js';
