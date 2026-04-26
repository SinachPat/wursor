'use client';

import { useEffect } from 'react';
import { Toolbar } from './Toolbar';
import { ArtboardNavigator } from '../navigator/ArtboardNavigator';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';
import { useHistory } from '@/store/history';
import { useCanvas } from '@/store/canvas';

export function AppChrome() {
  const selectedArtboardId = useCanvas((s) => s.selectedArtboardId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!selectedArtboardId) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistory.getState().undo(selectedArtboardId);
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        useHistory.getState().redo(selectedArtboardId);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedArtboardId]);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: '44px 1fr',
        gridTemplateColumns: '220px 1fr 272px',
        height: '100dvh',
        overflow: 'hidden',
        background: '#0C0C10',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <Toolbar />
      <ArtboardNavigator />
      <Canvas />
      <Inspector />
    </div>
  );
}
