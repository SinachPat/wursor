import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Artboard, InsertArtboard, ArtboardType } from '@originmain/origin-graph';

export interface CanvasArtboard {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  renderUrl?: string;
  /** Route path appended to renderUrl when rendering a specific screen, e.g. "/dashboard". */
  route?: string;
  /** Controls which renderer is used: route (default), isolation, or static. */
  artboard_type?: ArtboardType;
  /** Isolation artboard: exported component display name. */
  isolation_component?: string | null;
  /** Isolation artboard: workspace-relative source file path. */
  isolation_file?: string | null;
  /** Isolation artboard: live prop overrides forwarded to the isolation frame. */
  isolation_props?: Record<string, unknown> | null;
}


function toCanvasArtboard(ab: Artboard): CanvasArtboard | null {
  const meta = ab.metadata_jsonb;

  // x/y: prefer promoted top-level columns (migration 012), fall back to metadata_jsonb.
  const x = typeof ab.canvas_x === 'number' ? ab.canvas_x
    : typeof meta['x'] === 'number' ? meta['x'] : null;
  const y = typeof ab.canvas_y === 'number' ? ab.canvas_y
    : typeof meta['y'] === 'number' ? meta['y'] : null;
  // width/height come from metadata_jsonb (top-level DB columns default to 1440/900,
  // not from the user's intent — metadata_jsonb carries the actual artboard dimensions).
  const width  = typeof meta['width']  === 'number' ? meta['width']  : null;
  const height = typeof meta['height'] === 'number' ? meta['height'] : null;

  if (x === null || y === null || width === null || height === null) return null;

  const base: CanvasArtboard = { id: ab.id, label: ab.name, x, y, width, height };

  // renderUrl must be an absolute http/https URL — skip relative strings to
  // avoid loading the Originmain app inside itself when the iframe resolves
  // against the Originmain origin.
  if (typeof meta['renderUrl'] === 'string') {
    const raw = meta['renderUrl'] as string;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') base.renderUrl = raw;
    } catch { /* invalid URL stored in DB — ignore */ }
  }

  if (typeof meta['route'] === 'string' && meta['route']) base.route = meta['route'];

  // Phase 3 isolation artboard fields (top-level DB columns, migration 012).
  if (ab.artboard_type) base.artboard_type = ab.artboard_type;
  if (ab.isolation_component !== undefined) base.isolation_component = ab.isolation_component ?? null;
  if (ab.isolation_file !== undefined) base.isolation_file = ab.isolation_file ?? null;
  if (ab.isolation_props !== undefined) base.isolation_props = ab.isolation_props as Record<string, unknown> ?? null;

  return base;
}

interface ArtboardQueryResult {
  rows: Artboard[];
  canvas: CanvasArtboard[];
}

async function fetchArtboards(workspaceId: string, projectId?: string): Promise<ArtboardQueryResult> {
  const url = new URL('/api/artboards', window.location.origin);
  url.searchParams.set('workspaceId', workspaceId);
  if (projectId) url.searchParams.set('projectId', projectId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Artboard fetch failed: ${res.status}`);
  const rows = (await res.json()) as Artboard[];
  return { rows, canvas: rows.map(toCanvasArtboard).filter((ab): ab is CanvasArtboard => ab !== null) };
}

/** PATCH an artboard (name, metadata_jsonb, and/or isolation_props). */
export async function patchArtboard(
  id: string,
  patch: { name?: string; metadata_jsonb?: Record<string, unknown>; isolation_props?: Record<string, unknown> },
): Promise<Artboard> {
  const res = await fetch(`/api/artboards/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Patch failed: ${res.status}`);
  }
  return res.json() as Promise<Artboard>;
}

/** Create a new artboard via POST /api/artboards and invalidate the cache. */
export async function createArtboardMutation(
  body: InsertArtboard,
): Promise<Artboard> {
  const res = await fetch('/api/artboards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Create failed: ${res.status}`);
  }
  return res.json() as Promise<Artboard>;
}

export function useArtboards(workspaceId: string | undefined, projectId?: string) {
  const query = useQuery({
    queryKey: ['artboards', workspaceId, projectId],
    queryFn: () => fetchArtboards(workspaceId!, projectId),
    enabled: workspaceId !== undefined,
    staleTime: 30_000,
  });

  const canvasArtboards = query.data?.canvas ?? [];
  const artboards = canvasArtboards;

  return {
    artboards,
    rawArtboards: query.data?.rows ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
