import { useMemo } from 'react';
import { diffComponents, type DiffResult } from '@originmain/diff-engine';
import { ARTBOARD_SNAPSHOTS } from '@/data/artboard-snapshots';

export function useDiff(artboardId: string | null): DiffResult | null {
  return useMemo(() => {
    if (!artboardId) return null;
    const snapshots = ARTBOARD_SNAPSHOTS[artboardId];
    if (!snapshots) return null;
    return diffComponents(snapshots.before, snapshots.after);
  }, [artboardId]);
}
