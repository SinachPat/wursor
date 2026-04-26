import { z } from 'zod';
import type { OriginIngester, IngestionResult } from '../types.js';

// ── Linear webhook payload ────────────────────────────────────────────────────
// Fired on Issue create/update events.

const LinearAttachmentSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
});

const LinearIssuePayloadSchema = z.object({
  action: z.enum(['create', 'update', 'remove']),
  type: z.literal('Issue'),
  data: z.object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().optional(),
    url: z.string().url(),
    priority: z.number().int().min(0).max(4).optional(),
    state: z.object({ name: z.string() }).optional(),
    assignee: z.object({ name: z.string(), email: z.string() }).optional(),
    attachments: z.array(LinearAttachmentSchema).optional(),
    team: z.object({ id: z.string(), name: z.string() }),
  }),
  updatedFrom: z.record(z.unknown()).optional(),
});

export type LinearIssuePayload = z.infer<typeof LinearIssuePayloadSchema>;

// ── Connector ─────────────────────────────────────────────────────────────────

export const linearIngester: OriginIngester<LinearIssuePayload> = {
  parsePayload(raw) {
    return LinearIssuePayloadSchema.parse(raw);
  },

  ingest(payload): IngestionResult {
    const { data } = payload;

    const attachment = data.attachments?.find(a => a.url !== undefined);
    const renderUrl = attachment?.url ?? data.url;

    return {
      origin: {
        type: 'LINEAR_ISSUE',
        source_ref: data.identifier,
        source_metadata_jsonb: {
          id: data.id,
          identifier: data.identifier,
          title: data.title,
          url: data.url,
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.state !== undefined ? { state: data.state.name } : {}),
          ...(data.assignee !== undefined ? { assignee: data.assignee.name } : {}),
          team: data.team.name,
        },
      },
      artboardTitle: `${data.identifier}: ${data.title}`,
      renderUrl,
    };
  },
};
