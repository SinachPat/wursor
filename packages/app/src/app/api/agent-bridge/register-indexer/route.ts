// POST /api/agent-bridge/register-indexer
// POST /api/agent-bridge/register-indexer/heartbeat   (same handler, path checked below)
//
// Called by the CLI's `originmain dev` command to register the local AST indexer
// so the Agent Bridge can proxy component-resolution requests to it.
//
// Security (spec Phase 5 §8.3):
//   • Bearer auth: same workspace-token mechanism as the main MCP endpoint.
//   • indexerUrl MUST be localhost / 127.0.0.1 — external URLs are rejected to
//     prevent the Agent Bridge from being used as an SSRF relay.
//   • TTL: 300 s default; heartbeat POST refreshes it every 120 s.
//   • Agent Bridge evicts registrations with no heartbeat after 360 s.
//
// Heartbeat endpoint: POST /api/agent-bridge/register-indexer/heartbeat
//   Body: { workspaceToken: string }
//   Returns 200 on success, 404 if the workspace has no active registration.

import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkspaceToken, registerIndexer, heartbeatIndexer } from '@originmain/agent-bridge';

const TTL_SECONDS = 300; // 5 minutes per spec

/**
 * Returns true when `url` resolves to the local machine (localhost / loopback).
 * We block any non-localhost indexerUrl to prevent SSRF.
 */
function isLocalhostUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  // Accept the workspace token either in the Authorization header (CLI standard)
  // or in the request body as `workspaceToken` (heartbeat convenience).
  let token: string | null = null;
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Body is optional for heartbeat (token may come from header only)
  }

  if (!token && typeof body['workspaceToken'] === 'string') {
    token = body['workspaceToken'];
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Missing Bearer token or workspaceToken in body' },
      { status: 401 },
    );
  }

  const workspaceToken = verifyWorkspaceToken(token);
  if (!workspaceToken) {
    return NextResponse.json(
      { error: 'Invalid or expired workspace token' },
      { status: 401 },
    );
  }

  // ── Heartbeat path ──────────────────────────────────────────────────────────
  // The CLI sends a heartbeat POST to the same URL with no indexerUrl in the body.
  // We detect this by the absence of indexerUrl and refresh the TTL instead.
  if (!body['indexerUrl']) {
    const refreshed = heartbeatIndexer(workspaceToken.workspaceId, TTL_SECONDS);
    if (!refreshed) {
      return NextResponse.json(
        { error: 'No active registration for this workspace — re-register first' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      action: 'heartbeat',
      workspaceId: workspaceToken.workspaceId,
      ttlSeconds: TTL_SECONDS,
    });
  }

  // ── Registration path ───────────────────────────────────────────────────────
  const indexerUrl = typeof body['indexerUrl'] === 'string' ? body['indexerUrl'] : null;

  if (!indexerUrl) {
    return NextResponse.json({ error: '`indexerUrl` is required' }, { status: 400 });
  }

  // Security: only localhost URLs are allowed — prevent SSRF
  if (!isLocalhostUrl(indexerUrl)) {
    return NextResponse.json(
      { error: 'indexerUrl must be a localhost URL (e.g. http://localhost:4171)' },
      { status: 400 },
    );
  }

  const ttl = typeof body['ttl'] === 'number' ? Math.min(body['ttl'], 600) : TTL_SECONDS;

  registerIndexer(workspaceToken.workspaceId, indexerUrl, ttl);

  return NextResponse.json({
    ok: true,
    action: 'registered',
    workspaceId: workspaceToken.workspaceId,
    indexerUrl,
    ttlSeconds: ttl,
    heartbeatIntervalSeconds: 120,
  });
}
