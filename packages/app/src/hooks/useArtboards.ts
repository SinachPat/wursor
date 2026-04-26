import { useQuery } from '@tanstack/react-query';
import type { Artboard } from '@originmain/origin-graph';

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

async function fetchArtboards(workspaceId: string): Promise<CanvasArtboard[]> {
  const res = await fetch(`/api/artboards?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) throw new Error(`Artboard fetch failed: ${res.status}`);
  const rows = (await res.json()) as Artboard[];
  return rows.map(toCanvasArtboard).filter((ab): ab is CanvasArtboard => ab !== null);
}

export function useArtboards(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: ['artboards', workspaceId],
    queryFn: () => fetchArtboards(workspaceId!),
    enabled: workspaceId !== undefined,
    staleTime: 30_000,
  });

  // Show demo artboards while loading or when workspace has no artboards yet.
  const artboards =
    !query.data || query.data.length === 0 ? DEMO_ARTBOARDS : query.data;

  return { artboards, isLoading: query.isLoading, error: query.error };
}
