// ── useDlf hook ───────────────────────────────────────────────────────────────
// Fetches the active Design Language for the current workspace and returns its
// parsed body as a typed DesignLanguageFileBody (tokens, component rules,
// screen rules, voice, accessibility) when the raw_json matches the old DLF
// spec format (version "1.0").
//
// Phase 6 note: the route now returns a DesignLanguage row (migration 014)
// whose raw_json may be a W3C DTCG / Style Dictionary / flat-CSS-vars token
// file rather than the old DLF body. We attempt to validate raw_json through
// DesignLanguageFileBodySchema; on failure we return null so the inspector
// gracefully omits constraint checking rather than crashing.
//
// Stale time is 5 minutes — design systems change at deploy-time, not
// interactively, so we avoid redundant round-trips during normal editing.

import { useQuery } from '@tanstack/react-query';
import type { DesignLanguage } from '@originmain/origin-graph';
import { DesignLanguageFileBodySchema, type DesignLanguageFileBody } from '@originmain/design-language';

// ── Fetch + parse ─────────────────────────────────────────────────────────────

async function fetchDlf(workspaceId: string): Promise<DesignLanguageFileBody | null> {
  const url = `/api/design-language?workspaceId=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DLF fetch failed: ${res.status}`);

  // API returns the active DesignLanguage row or null when nothing is uploaded.
  const dl = (await res.json()) as DesignLanguage | null;
  if (!dl) return null;

  // Attempt to validate raw_json through the old DLF body schema.
  // Phase 6 token files (W3C DTCG etc.) will not match — we return null
  // rather than throwing so constraint checking simply goes quiet.
  const parsed = DesignLanguageFileBodySchema.safeParse(dl.raw_json);
  if (!parsed.success) return null;

  return parsed.data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDlf(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['dlf', workspaceId] as const,
    queryFn: () => fetchDlf(workspaceId!),
    enabled: Boolean(workspaceId),
    // Design language files change at deploy-time, not interactively.
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    /** Parsed DLF body, or null if no file is uploaded or it uses the new token format. */
    dlf: query.data ?? null,
    isLoading: query.isLoading,
    /** Set when the DLF fetch itself failed (network / server error). */
    error: query.error,
  };
}
