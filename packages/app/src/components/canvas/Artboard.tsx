'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvas } from '@/store/canvas';
import { useViewport } from '@/store/viewport';
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
  const { selectedArtboardId, selectArtboard, workspaceId, projectId, setArtboardLive, selectComponent } = useCanvas();
  const selected = selectedArtboardId === id;
  const queryClient = useQueryClient();

  // ── Fiber tree (from LiveArtboard) ─────────────────────────────────────────
  const [fiberRoot, setFiberRoot] = useState<FiberNode | undefined>(undefined);

  const handleFiberUpdate = useCallback((root: FiberNode) => {
    setFiberRoot(root);
    setArtboardLive(id, true);
  }, [id, setArtboardLive]);

  const handleComponentSelected = useCallback((nodeId: string) => {
    if (!fiberRoot) return;
    // Walk fiber tree to find the selected node
    const node = findFiberNode(fiberRoot, nodeId);
    selectComponent(nodeId, node ?? null);
  }, [fiberRoot, selectComponent]);

  // ── Drag to reposition ─────────────────────────────────────────────────────
  const isDragging = useRef(false);
  const dragStart  = useRef({ mouseX: 0, mouseY: 0, artX: 0, artY: 0 });
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  const onLabelMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag on left button; don't interfere with rename
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    isDragging.current = true;
    const { zoom, panX, panY } = useViewport.getState();
    dragStart.current = {
      mouseX: (e.clientX - panX) / zoom,
      mouseY: (e.clientY - panY) / zoom,
      artX: x,
      artY: y,
    };
    setDragOffset({ dx: 0, dy: 0 });

    const onMove = (mv: MouseEvent) => {
      if (!isDragging.current) return;
      const { zoom: z, panX: px, panY: py } = useViewport.getState();
      const curX = (mv.clientX - px) / z;
      const curY = (mv.clientY - py) / z;
      setDragOffset({
        dx: curX - dragStart.current.mouseX,
        dy: curY - dragStart.current.mouseY,
      });
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      const newX = Math.round(dragStart.current.artX + dragOffset.dx);
      const newY = Math.round(dragStart.current.artY + dragOffset.dy);

      // Persist position
      fetch(`/api/artboards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata_jsonb: { x: newX, y: newY, width, height, ...(renderUrl ? { renderUrl } : {}) },
        }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
        setDragOffset({ dx: 0, dy: 0 });
      }).catch(console.error);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, x, y, width, height, renderUrl, workspaceId, projectId, queryClient, dragOffset.dx, dragOffset.dy]);

  // ── Inline rename ──────────────────────────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(label);
  const renameRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRenameValue(label);
    setRenaming(true);
    setTimeout(() => renameRef.current?.select(), 0);
  }, [label]);

  const commitRename = useCallback(() => {
    setRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === label) return;
    fetch(`/api/artboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    }).catch(console.error);
  }, [id, renameValue, label, workspaceId, projectId, queryClient]);

  const effectiveX = x + (isDragging.current ? dragOffset.dx : 0);
  const effectiveY = y + (isDragging.current ? dragOffset.dy : 0);

  return (
    <div
      style={{ position: 'absolute', top: effectiveY, left: effectiveX }}
      onClick={(e) => { e.stopPropagation(); selectArtboard(id); }}
    >
      {/* Label / drag handle */}
      <div
        onMouseDown={onLabelMouseDown}
        onDoubleClick={startRename}
        style={{
          position: 'absolute',
          top: -26,
          left: 0,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          cursor: isDragging.current ? 'grabbing' : 'grab',
          userSelect: 'none',
          minWidth: 80,
        }}
      >
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
              fontWeight: 500,
              color: '#3385FF',
              background: 'rgba(51,133,255,0.12)',
              border: '1px solid rgba(51,133,255,0.4)',
              borderRadius: 3,
              padding: '1px 6px',
              outline: 'none',
              width: Math.max(80, label.length * 7),
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
              fontWeight: selected ? 500 : 400,
              color: selected ? '#3385FF' : 'rgba(255,255,255,0.35)',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </span>
        )}
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
        {/* Selection corner handles */}
        {selected && (
          <>
            <Handle pos={{ top: -4, left: -4 }} />
            <Handle pos={{ top: -4, right: -4 }} />
            <Handle pos={{ bottom: -4, left: -4 }} />
            <Handle pos={{ bottom: -4, right: -4 }} />
          </>
        )}

        {/* Content */}
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
          <EmptyArtboardContent id={id} label={label} width={width} height={height} workspaceId={workspaceId} projectId={projectId} queryClient={queryClient} />
        )}
      </div>
    </div>
  );
}

// ── Empty artboard (no renderUrl) ─────────────────────────────────────────────

function EmptyArtboardContent({
  id, label, width, height, workspaceId, projectId, queryClient,
}: {
  id: string; label: string; width: number; height: number;
  workspaceId: string | null; projectId: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [editing, setEditing] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const url = urlValue.trim();
    if (!url) return;
    setSaving(true);
    await fetch(`/api/artboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata_jsonb: { renderUrl: url, width, height, x: 0, y: 0 },
      }),
    }).catch(console.error);
    queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div
      style={{
        width, height, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F8F8FA', gap: 12, padding: 20,
      }}
    >
      {/* Artboard name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B', letterSpacing: '-0.02em', textAlign: 'center' }}>
        {label}
      </div>

      {editing ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            autoFocus
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="http://localhost:3000"
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
            style={{
              padding: '7px 10px', borderRadius: 6, border: '1.5px solid #0066FF',
              fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%',
              boxSizing: 'border-box' as const,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => void save()} disabled={saving}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 5, border: 'none',
                background: '#0066FF', color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Connect'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 10px', borderRadius: 5, border: '1px solid #E4E4E7',
                background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(0,102,255,0.07)', border: '1px solid rgba(0,102,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="3" width="16" height="12" rx="2" stroke="#0066FF" strokeWidth="1.3"/>
              <path d="M6 8l2.5 2.5L12 6" stroke="#0066FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#71717A', textAlign: 'center', lineHeight: 1.5, maxWidth: 180 }}>
            Connect a running app URL to enable live rendering
          </p>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)',
              background: '#fff', fontSize: 11, fontWeight: 600, color: '#0A0A0A',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Connect app →
          </button>
        </>
      )}
    </div>
  );
}

// ── Demo content (only for hardcoded demo IDs) ────────────────────────────────

function ArtboardContent({ id }: { id: string }) {
  switch (id) {
    case 'dashboard-card': return <DashboardCard />;
    case 'user-profile':   return <UserProfile />;
    case 'nav-sidebar':    return <NavSidebar />;
    case 'data-table':     return <DataTable />;
    default:               return null; // shouldn't reach here for real artboards
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findFiberNode(root: FiberNode, nodeId: string): FiberNode | null {
  if (root.id === nodeId) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findFiberNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function Handle({ pos }: { pos: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 8, height: 8,
      background: '#fff', border: '2px solid #3385FF',
      borderRadius: 2, zIndex: 10, ...pos,
    }} />
  );
}

// ── Demo card components ──────────────────────────────────────────────────────

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
        {['Q4 2024', 'MRR', 'SaaS'].map(t => (
          <span key={t} style={{ fontSize: 9, background: '#F4F4F5', color: '#71717A', padding: '3px 8px', borderRadius: 99, fontWeight: 500 }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

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
    </div>
  );
}

function NavSidebar() {
  const items = [
    { icon: '⊞', label: 'Dashboard',    active: true  },
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
        <div key={label} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', margin: '1px 6px', borderRadius: 5,
          background: active ? 'rgba(0,102,255,0.07)' : 'transparent',
          fontSize: 10, fontWeight: active ? 600 : 400,
          color: active ? '#0066FF' : '#52525B', cursor: 'default',
        }}>
          <span style={{ fontSize: 11 }}>{icon}</span>{label}
        </div>
      ))}
    </div>
  );
}

function DataTable() {
  const rows = [
    { name: 'DashboardCard', status: 'Live',   nodes: 12, tokens: 8  },
    { name: 'UserProfile',   status: 'Draft',  nodes: 7,  tokens: 3  },
    { name: 'NavSidebar',    status: 'Live',   nodes: 19, tokens: 11 },
    { name: 'DataTable',     status: 'Review', nodes: 24, tokens: 14 },
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
      {rows.map((row, i) => (
        <div key={row.name} style={{
          display: 'grid', gridTemplateColumns: '1fr 60px 50px 50px',
          padding: '8px 16px', gap: 4,
          background: i % 2 === 0 ? 'transparent' : '#FAFAFA', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, fontWeight: 500, color: '#0A0A0A' }}>{row.name}</span>
          <span style={{
            fontSize: 8, fontWeight: 600, fontFamily: 'monospace',
            color: row.status === 'Live' ? '#059669' : row.status === 'Draft' ? '#6B7280' : '#D97706',
            background: row.status === 'Live' ? '#ECFDF5' : row.status === 'Draft' ? '#F9FAFB' : '#FFFBEB',
            padding: '2px 6px', borderRadius: 99, width: 'fit-content',
          }}>{row.status}</span>
          <span style={{ fontSize: 10, color: '#52525B', fontFamily: 'monospace' }}>{row.nodes}</span>
          <span style={{ fontSize: 10, color: '#52525B', fontFamily: 'monospace' }}>{row.tokens}</span>
        </div>
      ))}
    </div>
  );
}

// Suppress unused warning — kept for demo IDs in ArtboardContent
void ArtboardContent;
