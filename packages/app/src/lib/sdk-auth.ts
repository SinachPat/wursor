// ── SDK token auth ────────────────────────────────────────────────────────────
// Format: base64url(projectId:workspaceId:issuedAt:hmac)
// HMAC-SHA256 signed with AGENT_BRIDGE_SECRET (same key as workspace tokens).
// Tokens expire after 90 days (SDK tokens are long-lived; rotate via UI).
//
// Separate from @originmain/agent-bridge WorkspaceToken because SDK tokens are
// scoped to a project (not just a workspace) and use a different agent type.

import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface SdkToken {
  projectId:   string;
  workspaceId: string;
  issuedAt:    number;
}

function getSecret(): string {
  const secret = process.env.AGENT_BRIDGE_SECRET;
  if (!secret) throw new Error('AGENT_BRIDGE_SECRET is not set');
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Issue an SDK token scoped to a specific project. Called from the canvas
 *  when the user generates a token in project settings. */
export function issueSdkToken(projectId: string, workspaceId: string): string {
  const issuedAt = Date.now();
  const payload  = `sdk:${projectId}:${workspaceId}:${issuedAt}`;
  const hmac     = sign(payload, getSecret());
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

/** Verify and decode an SDK token from a Bearer header.
 *  Returns null if invalid, expired, or the secret is mismatched. */
export function verifySdkToken(token: string): SdkToken | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf-8');
  } catch {
    return null;
  }

  // Format: "sdk:<projectId>:<workspaceId>:<issuedAt>:<hmac>"
  // Split by ':' but only the first 5 segments — projectId/workspaceId can't
  // contain ':' (they're UUIDs), so 5 parts is always correct.
  const parts = decoded.split(':');
  if (parts.length !== 5 || parts[0] !== 'sdk') return null;

  const [, projectId, workspaceId, issuedAtStr, providedHmac] = parts;
  if (!projectId || !workspaceId || !issuedAtStr || !providedHmac) return null;

  const issuedAt = parseInt(issuedAtStr, 10);
  if (isNaN(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return null;

  const payload      = `sdk:${projectId}:${workspaceId}:${issuedAtStr}`;
  const expectedHmac = sign(payload, getSecret());

  const expected = Buffer.from(expectedHmac, 'hex');
  const provided  = Buffer.from(providedHmac, 'hex');
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  return { projectId, workspaceId, issuedAt };
}

/** Extract and verify the Bearer token from an Authorization header string. */
export function extractSdkToken(authHeader: string | null): SdkToken | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifySdkToken(authHeader.slice(7));
}
