import { z } from 'zod';
import type { OriginIngester, IngestionResult } from '../types.js';

// ── GitHub Webhook payload ────────────────────────────────────────────────────
// Handles pull_request events (opened, synchronize, reopened).
// Ref: https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request

const GitHubUserSchema = z.object({
  login: z.string(),
  html_url: z.string().url(),
});

const GitHubRepositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  html_url: z.string().url(),
  default_branch: z.string(),
});

const GitHubPullRequestPayloadSchema = z.object({
  action: z.enum(['opened', 'synchronize', 'reopened', 'closed']),
  number: z.number().int(),
  pull_request: z.object({
    id: z.number(),
    number: z.number().int(),
    title: z.string(),
    html_url: z.string().url(),
    state: z.enum(['open', 'closed']),
    head: z.object({
      sha: z.string().length(40),
      ref: z.string(),
      label: z.string(),
    }),
    base: z.object({
      sha: z.string().length(40),
      ref: z.string(),
    }),
    user: GitHubUserSchema,
    body: z.string().nullable().optional(),
    draft: z.boolean().optional(),
  }),
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
});

export type GitHubPullRequestPayload = z.infer<typeof GitHubPullRequestPayloadSchema>;

// ── Connector ─────────────────────────────────────────────────────────────────

export const githubIngester: OriginIngester<GitHubPullRequestPayload> = {
  parsePayload(raw) {
    return GitHubPullRequestPayloadSchema.parse(raw);
  },

  ingest(payload): IngestionResult {
    const { pull_request: pr, repository } = payload;

    // The render URL points to the head commit's deployed preview if available.
    // Conventionally: https://<pr-number>.<preview-domain> — caller overrides as needed.
    const renderUrl = pr.html_url;

    return {
      origin: {
        type: 'GIT_COMMIT',
        source_ref: pr.head.sha,
        source_metadata_jsonb: {
          pr_number: pr.number,
          pr_title: pr.title,
          pr_url: pr.html_url,
          head_sha: pr.head.sha,
          head_ref: pr.head.ref,
          base_sha: pr.base.sha,
          base_ref: pr.base.ref,
          repo: repository.full_name,
          author: pr.user.login,
          ...(pr.body !== undefined && pr.body !== null ? { body: pr.body } : {}),
          ...(pr.draft !== undefined ? { draft: pr.draft } : {}),
        },
      },
      artboardTitle: `PR #${pr.number}: ${pr.title}`,
      renderUrl,
    };
  },
};
