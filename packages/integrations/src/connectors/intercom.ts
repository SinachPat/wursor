import { z } from 'zod';
import type { OriginIngester, IngestionResult } from '../types.js';

// ── Intercom Webhook payload ──────────────────────────────────────────────────
// Handles conversation.user.created events where users report UI issues.
// Intercom sends annotated screenshots as file_url attachments.
// Ref: https://developers.intercom.com/docs/references/webhooks/conversation/

const IntercomAttachmentSchema = z.object({
  type: z.literal('upload'),
  name: z.string(),
  url: z.string().url(),
  content_type: z.string().optional(),
  filesize: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const IntercomUserSchema = z.object({
  type: z.enum(['user', 'lead']),
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

const IntercomConversationPartSchema = z.object({
  type: z.literal('conversation_part'),
  body: z.string().nullable().optional(),
  attachments: z.array(IntercomAttachmentSchema).optional(),
  author: z.object({
    type: z.string(),
    id: z.string(),
    email: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
});

const IntercomWebhookPayloadSchema = z.object({
  type: z.literal('notification_event'),
  topic: z.string(),
  data: z.object({
    type: z.literal('notification_event_data'),
    item: z.object({
      type: z.literal('conversation'),
      id: z.string(),
      created_at: z.number(),
      source: z.object({
        type: z.string(),
        subject: z.string().optional(),
        body: z.string().nullable().optional(),
        attachments: z.array(IntercomAttachmentSchema).optional(),
        author: IntercomUserSchema.optional(),
      }),
      conversation_parts: z.object({
        conversation_parts: z.array(IntercomConversationPartSchema).optional(),
      }).optional(),
    }),
  }),
});

export type IntercomWebhookPayload = z.infer<typeof IntercomWebhookPayloadSchema>;

// ── Connector ─────────────────────────────────────────────────────────────────

export const intercomIngester: OriginIngester<IntercomWebhookPayload> = {
  parsePayload(raw) {
    return IntercomWebhookPayloadSchema.parse(raw);
  },

  ingest(payload): IngestionResult {
    const { item } = payload.data;
    const { source } = item;

    // Prefer annotated screenshot from the source message
    const imageAttachment = source.attachments?.find(a =>
      a.content_type?.startsWith('image/')
    );

    const authorName = source.author?.name ?? source.author?.email ?? 'Unknown user';
    const subject = source.subject ?? `User report from ${authorName}`;

    return {
      origin: {
        type: 'URL',
        source_ref: item.id,
        source_metadata_jsonb: {
          conversation_id: item.id,
          topic: payload.topic,
          subject,
          body: source.body ?? '',
          created_at: item.created_at,
          author: {
            ...(source.author?.id !== undefined ? { id: source.author.id } : {}),
            ...(source.author?.email !== undefined ? { email: source.author.email } : {}),
            ...(source.author?.name !== undefined ? { name: source.author.name } : {}),
          },
          ...(imageAttachment !== undefined ? {
            screenshot_url: imageAttachment.url,
            screenshot_name: imageAttachment.name,
            ...(imageAttachment.width !== undefined ? { width: imageAttachment.width } : {}),
            ...(imageAttachment.height !== undefined ? { height: imageAttachment.height } : {}),
          } : {}),
        },
      },
      artboardTitle: `Intercom: ${subject}`,
      ...(imageAttachment !== undefined ? { renderUrl: imageAttachment.url } : {}),
    };
  },
};
