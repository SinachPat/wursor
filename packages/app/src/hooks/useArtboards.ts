import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Artboard, InsertArtboard } from '@originmain/origin-graph';

export interface CanvasArtboard {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  renderUrl?: string;
}

const DEMO_ARTBOARDS: CanvasArtboard[] = [
  { id: 'dashboard-card', label: 'DashboardCard', x: 120,  y: 100, width: 280, height: 200 },
  { id: 'user-profile',   label: 'UserProfile',   x: 460,  y: 100, width: 200, height: 260 },
  { id: 'nav-sidebar',    label: 'NavSidebar',    x: 120,  y: 360, width: 200, height: 340 },
  { id: 'data-table',     label: 'DataTable',     x: 380,  y: 380, width: 420, height: 280 },
];

function toCanvasArtboard(ab: Artboard): CanvasArtboard | null {
  const meta = ab.metadata_jsonb;
  const x = typeof meta['x'] === 'number' ? meta['x'] : null;
  const y = typeof meta['y'] === 'number' ? meta['y'] : null;
  const width = typeof meta['width'] === 'number' ? meta['width'] : null;
  const height = typeof meta['height'] === 'number' ? meta['height'] : null;
  if (x === null || y === null || width === null || height === null) return null;
  const base: CanvasArtboard = { id: ab.id, label: ab.name, x, y, width, height };
  if (typeof meta['renderUrl'] === 'string') base.renderUrl = meta['renderUrl'];
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
  // Show demo artboards while loading or when workspace/project has no artboards yet.
  const artboards = canvasArtboards.length === 0 ? DEMO_ARTBOARDS : canvasArtboards;

  return {
    artboards,
    rawArtboards: query.data?.rows ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
