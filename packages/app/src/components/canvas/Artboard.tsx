'use client';

import { useState, useCallback } from 'react';
import { useCanvas } from '@/store/canvas';
import { LiveArtboard } from './LiveArtboard';
import { SelectionOverlay } from './SelectionOverlay';
import type { FiberNode } from '@originmain/renderer';

interface ArtboardProps {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  renderUrl?: string;
}

export function Artboard({ id, label, x, y, width, height, renderUrl }: ArtboardProps) {
  const { selectedArtboardId, selectArtboard } = useCanvas();
  const selected = selectedArtboardId === id;
  const [fiberRoot, setFiberRoot] = useState<FiberNode | undefined>(undefined);

  const handleFiberUpdate = useCallback((root: FiberNode) => setFiberRoot(root), []);
  const handleComponentSelected = useCallback(
    (nodeId: string) => { void nodeId; /* future: highlight in inspector */ },
    []
  );

  return (
    <div
      style={{ position: 'absolute', top: y, left: x }}
      onClick={(e) => { e.stopPropagation(); selectArtboard(id); }}
    >
      {/* Label */}
      <div
        style={{
          position: 'absolute',
          top: -24,
          left: 0,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
          fontWeight: selected ? 500 : 400,
          color: selected ? '#3385FF' : 'rgba(255,255,255,0.35)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
          transition: 'color 0.15s',
        }}
      >
        {label}
      </div>

      {/* Frame */}
      <div
        style={{
          width,
          height,
          background: '#FFFFFF',
          borderRadius: 8,
          boxShadow: selected
            ? '0 0 0 2px #3385FF, 0 12px 48px rgba(0,0,0,0.65)'
            : '0 4px 28px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          position: 'relative',
          cursor: selected ? 'default' : 'pointer',
          transition: 'box-shadow 0.15s',
        }}
      >
        {/* Selection handles */}
        {selected && (
          <>
            <Handle pos={{ top: -4, left: -4 }} />
            <Handle pos={{ top: -4, right: -4 }} />
            <Handle pos={{ bottom: -4, left: -4 }} />
            <Handle pos={{ bottom: -4, right: -4 }} />
          </>
        )}

        {/* Per-artboard content */}
        {renderUrl ? (
          <>
            <LiveArtboard
              id={id}
              src={renderUrl}
              width={width}
              height={height}
              onFiberTreeUpdate={handleFiberUpdate}
              onComponentSelected={handleComponentSelected}
            />
            <SelectionOverlay
              artboardId={id}
              {...(fiberRoot !== undefined ? { fiberRoot } : {})}
              width={width}
              height={height}
            />
          </>
        ) : (
          <ArtboardContent id={id} />
        )}
      </div>
    </div>
  );
}

function ArtboardContent({ id }: { id: string }) {
  switch (id) {
    case 'dashboard-card': return <DashboardCard />;
    case 'user-profile':   return <UserProfile />;
    case 'nav-sidebar':    return <NavSidebar />;
    case 'data-table':     return <DataTable />;
    default:               return <Placeholder label={id} />;
  }
}

// ── DashboardCard ──────────────────────────────────────────
function DashboardCard() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>Revenue Overview</span>
        <span style={{ fontSize: 9, background: '#ECFDF5', color: '#059669', padding: '2px 7px', borderRadius: 99, fontWeight: 600, fontFamily: 'monospace' }}>Live</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.045em', lineHeight: 1, marginBottom: 4 }}>$12,450</div>
      <div style={{ fontSize: 10, color: '#059669', fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 3 }}>
        <span>↑</span> +2.4% vs last month
      </div>
      <div style={{ height: 3, background: '#F0F0F0', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: '68%', background: 'linear-gradient(90deg, #0066FF, #3385FF)', borderRadius: 99 }} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Tag>Q4 2024</Tag>
        <Tag>MRR</Tag>
        <Tag>SaaS</Tag>
      </div>
    </div>
  );
}

// ── UserProfile ────────────────────────────────────────────
function UserProfile() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #0066FF)', marginBottom: 12 }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.025em', marginBottom: 3 }}>Sarah Chen</div>
      <div style={{ fontSize: 10, color: '#A1A1AA', marginBottom: 16 }}>Design Engineer</div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[['Team', 'Acme Inc'], ['Role', 'Admin'], ['Plan', 'Team']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: '#A1A1AA' }}>{k}</span>
            <span style={{ fontWeight: 500, color: '#0A0A0A' }}>{v}</span>
          </div>
        ))}
      </div>
      <button style={{ marginTop: 16, width: '100%', padding: '7px 0', borderRadius: 6, border: '1px solid #E4E4E7', background: '#FAFAFA', fontSize: 10, fontWeight: 600, color: '#3F3F46', cursor: 'default' }}>
        Edit profile
      </button>
    </div>
  );
}

// ── NavSidebar ─────────────────────────────────────────────
function NavSidebar() {
  const items = [
    { icon: '⊞', label: 'Dashboard',   active: true  },
    { icon: '◉', label: 'Origin Graph', active: false },
    { icon: '⬜', label: 'Artboards',   active: false },
    { icon: '△',  label: 'Diffs',       active: false },
    { icon: '🔗', label: 'Integrations',active: false },
  ];
  return (
    <div style={{ height: '100%', background: '#FAFAFA', display: 'flex', flexDirection: 'column', padding: '12px 0' }}>
      <div style={{ padding: '0 12px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '-0.04em', color: '#0A0A0A' }}>
        Origin<span style={{ color: '#0066FF' }}>main</span>
      </div>
      <div style={{ height: 1, background: '#EBEBEB', margin: '0 0 8px' }} />
      {items.map(({ icon, label, active }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            margin: '1px 6px',
            borderRadius: 5,
            background: active ? 'rgba(0,102,255,0.07)' : 'transparent',
            fontSize: 10,
            fontWeight: active ? 600 : 400,
            color: active ? '#0066FF' : '#52525B',
            cursor: 'default',
          }}
        >
          <span style={{ fontSize: 11 }}>{icon}</span>
          {label}
        </div>
      ))}
      <div style={{ marginTop: 'auto', padding: '8px 12px 0', borderTop: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #0066FF)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#0A0A0A' }}>Sarah Chen</div>
            <div style={{ fontSize: 8, color: '#A1A1AA' }}>Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DataTable ──────────────────────────────────────────────
function DataTable() {
  const rows = [
    { name: 'DashboardCard', status: 'Live',    nodes: 12, tokens: 8  },
    { name: 'UserProfile',   status: 'Draft',   nodes: 7,  tokens: 3  },
    { name: 'NavSidebar',    status: 'Live',    nodes: 19, tokens: 11 },
    { name: 'DataTable',     status: 'Review',  nodes: 24, tokens: 14 },
  ];
  return (
    <div style={{ padding: '16px 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.02em' }}>
        Component Inventory
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 50px', padding: '0 16px 6px', gap: 4 }}>
        {['Name', 'Status', 'Nodes', 'Tokens'].map(h => (
          <span key={h} style={{ fontFamily: 'monospace', fontSize: 8, color: '#A1A1AA', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>
      <div style={{ height: 1, background: '#F0F0F0' }} />
      {rows.map((row, i) => (
        <div
          key={row.name}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 60px 50px 50px',
            padding: '8px 16px',
            gap: 4,
            background: i % 2 === 0 ? 'transparent' : '#FAFAFA',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 500, color: '#0A0A0A', letterSpacing: '-0.01em' }}>{row.name}</span>
          <span style={{
            fontSize: 8,
            fontWeight: 600,
            color: row.status === 'Live' ? '#059669' : row.status === 'Draft' ? '#6B7280' : '#D97706',
            background: row.status === 'Live' ? '#ECFDF5' : row.status === 'Draft' ? '#F9FAFB' : '#FFFBEB',
            padding: '2px 6px',
            borderRadius: 99,
            width: 'fit-content',
            fontFamily: 'monospace',
          }}>
            {row.status}
          </span>
          <span style={{ fontSize: 10, color: '#52525B', fontFamily: 'monospace' }}>{row.nodes}</span>
          <span style={{ fontSize: 10, color: '#52525B', fontFamily: 'monospace' }}>{row.tokens}</span>
        </div>
      ))}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#A1A1AA', fontSize: 11 }}>
      {label}
    </div>
  );
}

function Handle({ pos }: { pos: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 8,
        height: 8,
        background: '#fff',
        border: '2px solid #3385FF',
        borderRadius: 2,
        zIndex: 10,
        ...pos,
      }}
    />
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 9, background: '#F4F4F5', color: '#71717A', padding: '3px 8px', borderRadius: 99, fontWeight: 500 }}>
      {children}
    </span>
  );
}
