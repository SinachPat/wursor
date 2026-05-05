// POST /api/design-language/fetch
// Server-side CORS proxy for fetching user-supplied design token JSON files.
//
// The browser cannot directly fetch a token file hosted at an arbitrary URL due
// to CORS restrictions. This route performs the fetch server-side and returns
// the raw JSON text so the client can run the standard validation pipeline.
//
// Security mitigations:
//   1. Auth: requires a valid Clerk session — unauthenticated callers are rejected.
//   2. HTTPS only: rejects http:// URLs to prevent plaintext credential exposure.
//   3. Private-IP block: rejects requests to localhost, RFC-1918 ranges, and
//      link-local addresses to prevent SSRF (Server-Side Request Forgery).
//   4. Size cap: response bodies larger than 1 MB are rejected.
//   5. Content-Type guard: the upstream response must be JSON-like.
//
// spec: SOURCE-AWARE-CANVAS §3 Phase 6 — "Fetch from URL" token import flow

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Maximum allowed response body size (1 MB). Token files are never this large;
// the cap protects against slow-loris and accidental large-file fetches.
const MAX_BODY_BYTES = 1_048_576;

/**
 * Returns true when the URL hostname resolves to a private / loopback address
 * that should never be reachable from a proxied server-side request.
 * We guard against SSRF by rejecting hostnames that literally look private —
 * a full DNS-resolution check is not performed here because it would require
 * an extra async lookup and still be racy.
 */
function isPrivateHost(hostname: string): boolean {
  // Loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  // RFC-1918 private ranges (textual prefix match is sufficient for common cases)
  if (/^10\./.test(hostname))          return true; // 10.0.0.0/8
  if (/^192\.168\./.test(hostname))    return true; // 192.168.0.0/16
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true; // 172.16.0.0/12
  // Link-local
  if (/^169\.254\./.test(hostname))    return true;
  if (/^fe80:/i.test(hostname))        return true;
  return false;
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse request body ─────────────────────────────────────────────────────
  let body: { url?: string };
  try {
    body = await req.json() as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: '`url` field is required' }, { status: 400 });
  }

  // ── URL validation ─────────────────────────────────────────────────────────
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'Only HTTPS URLs are supported' },
      { status: 400 },
    );
  }

  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json(
      { error: 'Requests to private or loopback addresses are not allowed' },
      { status: 400 },
    );
  }

  // ── Proxy fetch ────────────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Originmain-DLF-Proxy/1.0',
      },
      // 10-second timeout via AbortSignal
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Fetch failed: ${msg}` }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status} ${upstream.statusText}` },
      { status: 502 },
    );
  }

  // ── Content-Type guard ────────────────────────────────────────────────────
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('json') && !contentType.includes('text')) {
    return NextResponse.json(
      { error: 'Upstream response is not JSON or plain text' },
      { status: 415 },
    );
  }

  // ── Size cap ──────────────────────────────────────────────────────────────
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Response too large (max ${MAX_BODY_BYTES / 1024} KB)` },
      { status: 413 },
    );
  }

  const text = new TextDecoder().decode(bytes);

  // Validate that the body parses as JSON before forwarding — the client
  // expects valid JSON, not a redirect page or HTML error body.
  try {
    JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: 'Upstream response is not valid JSON' },
      { status: 422 },
    );
  }

  return NextResponse.json({ json: text }, { status: 200 });
}
