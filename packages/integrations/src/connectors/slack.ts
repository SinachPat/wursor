import { z } from 'zod';
import type { OriginIngester, IngestionResult } from '../types.js';

// ── Slack Event API payload ───────────────────────────────────────────────────
// Sent when a message is posted to a channel the app is subscribed to.
// Ref: https://api.slack.com/events/message

const SlackFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimetype: z.string().optional(),
  url_private: z.string().optional(),
  permalink: z.string().optional(),
});

const SlackMessageEventSchema = z.object({
  type: z.literal('event_callback'),
  event_id: z.string(),
  team_id: z.string(),
  event: z.object({
    type: z.literal('message'),
    channel: z.string(),
    channel_name: z.string().optional(),
    user: z.string(),
    text: z.string(),
    ts: z.string(),
    thread_ts: z.string().optional(),
    files: z.array(SlackFileSchema).optional(),
  }),
  authorizations: z.array(z.object({ user_id: z.string() })).optional(),
});

export type SlackMessagePayload = z.infer<typeof SlackMessageEventSchema>;

// ── Connector ─────────────────────────────────────────────────────────────────

export const slackIngester: OriginIngester<SlackMessagePayload> = {
  parsePayload(raw) {
    return SlackMessageEventSchema.parse(raw);
  },

  ingest(payload): IngestionResult {
    const { event, team_id } = payload;

    // Extract first image attachment as the render target
    const imageFile = event.files?.find(f =>
      f.mimetype?.startsWith('image/') && f.url_private !== undefined
    );
    const renderUrl = imageFile?.url_private ?? imageFile?.permalink;

    const channelLabel = event.channel_name ?? event.channel;
    const unixTs = parseFloat(event.ts);
    const date = new Date(unixTs * 1000).toISOString().slice(0, 10);

    return {
      origin: {
        type: 'SLACK_MESSAGE',
        source_ref: `${event.channel}:${event.ts}`,
        source_metadata_jsonb: {
          team_id,
          channel: event.channel,
          channel_name: channelLabel,
          user: event.user,
          text: event.text,
          ts: event.ts,
          ...(event.thread_ts !== undefined ? { thread_ts: event.thread_ts } : {}),
          ...(imageFile !== undefined ? { image_file_id: imageFile.id } : {}),
        },
      },
      artboardTitle: `Slack: #${channelLabel} (${date})`,
      ...(renderUrl !== undefined ? { renderUrl } : {}),
    };
  },
};
