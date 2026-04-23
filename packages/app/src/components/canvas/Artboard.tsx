'use client';

import { useCanvas } from '@/store/canvas';

interface ArtboardProps {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function Artboard({ id, label, x, y, width, height }: ArtboardProps) {
  const { selectedArtboardId, selectArtboard } = useCanvas();
  const selected = selectedArtboardId === id;

  return (
    <div
      style={{ position: 'absolute', top: y, left: x }}
      onClick={(e) => { e.stopPropagation(); selectArtboard(id); }}
    >
      {/* Label above artboard */}
      <div
        style={{
          position: 'absolute',
          top: -22,
          left: 0,
          fontSize: 11,
          fontFamily: 'monospace',
          color: selected ? '#0F52BA' : 'rgba(255,255,255,0.4)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>

      {/* Artboard frame */}
      <div
        style={{
          width,
          height,
          background: '#fff',
          borderRadius: 8,
          boxShadow: selected
            ? '0 0 0 2px #0F52BA, 0 8px 40px rgba(0,0,0,0.5)'
            : '0 4px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          position: 'relative',
          cursor: 'default',
        }}
      >
        {/* Selection handles */}
        {selected && (
          <>
            <Handle pos={{ top: -3, left: -3 }} />
            <Handle pos={{ top: -3, right: -3 }} />
            <Handle pos={{ bottom: -3, left: -3 }} />
            <Handle pos={{ bottom: -3, right: -3 }} />
          </>
        )}

        {/* Placeholder content */}
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
              Revenue Overview
            </div>
            <div style={{ fontSize: 9, background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 99, fontWeight: 600, fontFamily: 'monospace' }}>
              Live
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0c0c10', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 5 }}>
            $12,450
          </div>
          <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 500, marginBottom: 12 }}>
            ↑ +2.4% vs last month
          </div>
          <div style={{ height: 3, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: '68%', background: 'linear-gradient(90deg,#0F52BA,#4d84e0)', borderRadius: 99 }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Chip>Q4 2024</Chip>
            <Chip>MRR</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}

function Handle({ pos }: { pos: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 7,
        height: 7,
        background: '#fff',
        border: '2px solid #0F52BA',
        borderRadius: 2,
        zIndex: 10,
        ...pos,
      }}
    />
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 9, background: '#f5f5f5', color: '#666', padding: '3px 7px', borderRadius: 99 }}>
      {children}
    </span>
  );
}
