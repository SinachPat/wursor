// ── Per-workspace rate limiter ────────────────────────────────────────────────
// Enforces: 100 diff exports per hour per workspace.
// Uses a sliding window implemented with an in-process timestamp array.
// For multi-instance deployments, replace with a Redis-backed implementation.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 100;

const windows = new Map<string, number[]>();

export function checkRateLimit(workspaceId: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const prev = (windows.get(workspaceId) ?? []).filter(t => t > cutoff);
  const allowed = prev.length < MAX_REQUESTS;

  // Only persist the new timestamp when the request is allowed.
  // Read the allowed decision from `prev.length` (before push) so concurrent
  // synchronous callers in the same event-loop tick all see the same baseline.
  if (allowed) {
    windows.set(workspaceId, [...prev, now]);
  }

  const timestamps = allowed ? [...prev, now] : prev;
  const oldest = timestamps[0];
  const resetAt = oldest !== undefined ? oldest + WINDOW_MS : now + WINDOW_MS;

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - timestamps.length),
    resetAt,
  };
}

export function getRateLimitStatus(workspaceId: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (windows.get(workspaceId) ?? []).filter(t => t > cutoff);
  const oldest = timestamps[0];
  return {
    allowed: timestamps.length < MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - timestamps.length),
    resetAt: oldest !== undefined ? oldest + WINDOW_MS : now + WINDOW_MS,
  };
}
