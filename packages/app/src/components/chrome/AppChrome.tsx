'use client';

import { Toolbar } from './Toolbar';
import { ArtboardNavigator } from '../navigator/ArtboardNavigator';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';

export function AppChrome() {
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
