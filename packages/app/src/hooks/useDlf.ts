// ── useDlf hook ───────────────────────────────────────────────────────────────
// Fetches the active Design Language File for the current workspace and returns
// its parsed body as a typed DesignLanguageFileBody (tokens, component rules,
// screen rules, voice, accessibility). The raw DB row's schema_jsonb field is
// validated through the Zod schema at cache-write time so every consumer gets
// a fully typed result without re-parsing on each render.
//
// Stale time is 5 minutes — design systems change infrequently (deploy-time
// events) so we avoid redundant round-trips during normal editing sessions.

import { useQuery } from '@tanstack/react-query';
import type { DesignLanguageFile } from '@originmain/origin-graph';
import { DesignLanguageFileBodySchema, type DesignLanguageFileBody } from '@originmain/design-language';

// ── Fetch + parse ─────────────────────────────────────────────────────────────

async function fetchDlf(workspaceId: string): Promise<DesignLanguageFileBody | null> {
  const url = `/api/design-language?workspaceId=${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DLF fetch failed: ${res.status}`);

  // API returns the raw DB row or null when no DLF is uploaded yet.
  const file = (await res.json()) as DesignLanguageFile | null;
  if (!file) return null;

  // Validate schema_jsonb through the typed Zod schema.
  // We throw on failure so TanStack Query surfaces it via query.error —
  // callers can distinguish "no DLF" (null) from "malformed DLF" (error).
  const parsed = DesignLanguageFileBodySchema.safeParse(file.schema_jsonb);
  if (!parsed.success) {
    throw new Error(
      `Design language file schema is invalid: ${parsed.error.errors.map(e => e.message).join('; ')}`,
    );
  }
  return parsed.data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDlf(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['dlf', workspaceId] as const,
    queryFn: () => fetchDlf(workspaceId!),
    enabled: Boolean(workspaceId),
    // Design language files change at deploy-time, not interactively.
    // 5-minute staleness keeps the inspector snappy without burning requests.
    staleTime: 5 * 60_000,
    // Retry once on transient network errors, then surface the error.
    retry: 1,
  });

  return {
    /** Parsed DLF body, or null if no file is uploaded for this workspace. */
    dlf: query.data ?? null,
    isLoading: query.isLoading,
    /** Set when the DLF fetch succeeded but the schema failed Zod validation. */
    error: query.error,
  };
}
