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
        gridTemplateRows: '40px 1fr',
        gridTemplateColumns: '240px 1fr 320px',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <Toolbar />
      <ArtboardNavigator />
      <Canvas />
      <Inspector />
    </div>
  );
}
