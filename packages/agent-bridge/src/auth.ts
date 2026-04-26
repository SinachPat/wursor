import { createHmac, timingSafeEqual } from 'crypto';

// ── Workspace token ───────────────────────────────────────────────────────────
// Format: base64(workspaceId:agentType:timestamp:hmac)
// HMAC-SHA256 signed with AGENT_BRIDGE_SECRET (server-side env var).
// Tokens expire after 30 days.

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type AgentType = 'CURSOR' | 'CLAUDE_CODE' | 'GENERIC';

export interface WorkspaceToken {
  workspaceId: string;
  agentType: AgentType;
  issuedAt: number;
}

function getSecret(): string {
  const secret = process.env.AGENT_BRIDGE_SECRET;
  if (!secret) throw new Error('AGENT_BRIDGE_SECRET is not set');
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function issueWorkspaceToken(workspaceId: string, agentType: AgentType): string {
  const issuedAt = Date.now();
  const payload = `${workspaceId}:${agentType}:${issuedAt}`;
  const hmac = sign(payload, getSecret());
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function verifyWorkspaceToken(token: string): WorkspaceToken | null {
  // Decode base64url — this is the only step that can throw for reasons outside
  // our control (malformed input). All other failures are deterministic logic.
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf-8');
  } catch {
    return null;
  }

  const parts = decoded.split(':');
  if (parts.length !== 4) return null;

  const [workspaceId, agentType, issuedAtStr, providedHmac] = parts;
  if (!workspaceId || !agentType || !issuedAtStr || !providedHmac) return null;

  const issuedAt = parseInt(issuedAtStr, 10);
  if (isNaN(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return null;

  const payload = `${workspaceId}:${agentType}:${issuedAtStr}`;
  // getSecret() intentionally throws if AGENT_BRIDGE_SECRET is unset —
  // that's a server misconfiguration, not an invalid token.
  const expectedHmac = sign(payload, getSecret());

  const expected = Buffer.from(expectedHmac, 'hex');
  const provided = Buffer.from(providedHmac, 'hex');
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  const validAgentTypes: AgentType[] = ['CURSOR', 'CLAUDE_CODE', 'GENERIC'];
  if (!validAgentTypes.includes(agentType as AgentType)) return null;

  return { workspaceId, agentType: agentType as AgentType, issuedAt };
}
