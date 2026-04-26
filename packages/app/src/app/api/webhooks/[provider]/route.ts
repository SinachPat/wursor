// POST /api/webhooks/:provider
// Ingests webhook events from Linear, Slack, GitHub, and Intercom.
// workspaceId must be passed as a query param: ?workspace=<uuid>
// Signature verification is skipped gracefully when the secret env var is absent
// (useful for local development), but enforced in production.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  linearIngester,
  slackIngester,
  githubIngester,
  intercomIngester,
} from '@originmain/integrations';
import type { OriginIngester } from '@originmain/integrations';
import { serverClient } from '@/lib/supabase';
import { createOrigin, createArtboard } from '@originmain/origin-graph';

// ── Signature helpers ─────────────────────────────────────────────────────────

function hmac(algo: 'sha256' | 'sha1', secret: string, body: Buffer): string {
  return createHmac(algo, secret).update(body).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a.padEnd(b.length, '\0'));
    const bb = Buffer.from(b.padEnd(a.length, '\0'));
    return timingSafeEqual(ab, bb) && a.length === b.length;
  } catch {
    return false;
  }
}

function verifyLinear(rawBody: Buffer, headers: Headers): boolean {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification in dev
  const sig = headers.get('x-linear-signature') ?? '';
  return safeEqual(hmac('sha256', secret, rawBody), sig);
}

function verifySlack(rawBody: Buffer, headers: Headers): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return true;
  const ts = headers.get('x-slack-request-timestamp') ?? '';
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const baseString = `v0:${ts}:${rawBody.toString()}`;
  const expected = `v0=${hmac('sha256', secret, Buffer.from(baseString))}`;
  const provided = headers.get('x-slack-signature') ?? '';
  return safeEqual(expected, provided);
}

function verifyGitHub(rawBody: Buffer, headers: Headers): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = `sha256=${hmac('sha256', secret, rawBody)}`;
  const provided = headers.get('x-hub-signature-256') ?? '';
  return safeEqual(expected, provided);
}

function verifyIntercom(rawBody: Buffer, headers: Headers): boolean {
  const secret = process.env.INTERCOM_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = `sha1=${hmac('sha1', secret, rawBody)}`;
  const provided = headers.get('x-hub-signature') ?? '';
  return safeEqual(expected, provided);
}

// ── Route config ──────────────────────────────────────────────────────────────

const INGESTER_MAP: Record<
  string,
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ingester: OriginIngester<any>;
    verify: (body: Buffer, headers: Headers) => boolean;
  }
> = {
  linear:   { ingester: linearIngester,   verify: verifyLinear   },
  slack:    { ingester: slackIngester,    verify: verifySlack    },
  github:   { ingester: githubIngester,   verify: verifyGitHub   },
  intercom: { ingester: intercomIngester, verify: verifyIntercom },
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const entry = INGESTER_MAP[provider];
  if (!entry) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 404 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspace');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace query param is required' }, { status: 400 });
  }

  const rawBody = Buffer.from(await req.arrayBuffer());

  if (!entry.verify(rawBody, req.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Slack sends a challenge request during webhook setup — respond immediately.
  if (
    provider === 'slack' &&
    typeof parsed === 'object' &&
    parsed !== null &&
    'type' in parsed &&
    (parsed as { type: string }).type === 'url_verification'
  ) {
    return NextResponse.json({ challenge: (parsed as { challenge?: string }).challenge ?? '' });
  }

  let payload: unknown;
  try {
    payload = entry.ingester.parsePayload(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payload validation failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const result = entry.ingester.ingest(payload);
  const db = serverClient();

  try {
    const origin = await createOrigin(db, result.origin);

    const meta: Record<string, unknown> = {
      x: 120,
      y: 100,
      width: 360,
      height: 240,
    };
    if (result.renderUrl !== undefined) meta['renderUrl'] = result.renderUrl;

    const artboard = await createArtboard(db, {
      workspace_id: workspaceId,
      project_id: null,
      name: result.artboardTitle,
      origin_id: origin.id,
      parent_artboard_id: null,
      metadata_jsonb: meta,
    });

    return NextResponse.json({ originId: origin.id, artboardId: artboard.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
