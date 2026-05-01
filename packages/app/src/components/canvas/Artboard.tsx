'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvas } from '@/store/canvas';
import { useViewport } from '@/store/viewport';
import { useDiffs } from '@/hooks/useDiffs';
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
  /** Route path appended to renderUrl so each artboard can show a different screen. */
  route?: string;
  /** Called when the live app reports discoverable routes — Canvas handles creation. */
  onRoutesDiscovered?: (sourceId: string, routes: Array<{ path: string; label: string }>) => void;
}

/** Builds the iframe src from a base URL + optional route path.
 *  e.g. ("http://localhost:4170/", "/dashboard") → "http://localhost:4170/dashboard" */
function buildSrc(base: string, route?: string): string {
  if (!route || route === '/' || route === '') return base;
  const trimmed = base.replace(/\/$/, '');
  const path = route.startsWith('/') ? route : '/' + route;
  return trimmed + path;
}

// Status color map matching the inspector
const DIFF_STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT:    { color: '#FFBA7B', bg: 'rgba(255,186,123,0.15)', label: 'draft' },
  REVIEWED: { color: '#7EB8FF', bg: 'rgba(126,184,255,0.15)', label: 'reviewed' },
  APPLIED:  { color: '#10B981', bg: 'rgba(16,185,129,0.15)',  label: 'applied' },
  REJECTED: { color: '#FF8080', bg: 'rgba(255,128,128,0.15)', label: 'blocked' },
};

export function Artboard({ id, label, x, y, width, height, renderUrl, route, onRoutesDiscovered }: ArtboardProps) {
  const {
    selectedArtboardId, selectArtboard, workspaceId, projectId,
    setArtboardLive, setFiberRoot, selectComponent, setComponentStyles,
    selectedComponentId,
  } = useCanvas();
  const selected = selectedArtboardId === id;
  const queryClient = useQueryClient();

  // Diff status badges — fetch is cached by TanStack Query across all artboards
  const { diffs } = useDiffs(id);

  // ── Fiber tree (from LiveArtboard) ─────────────────────────────────────────
  const [localFiberRoot, setLocalFiberRoot] = useState<FiberNode | undefined>(undefined);

  const handleFiberUpdate = useCallback((root: FiberNode) => {
    setFiberRoot(id, root);
    setArtboardLive(id, true);
    setLocalFiberRoot(root);
  }, [id, setFiberRoot, setArtboardLive]);

  const handleComponentSelected = useCallback((nodeId: string) => {
    if (!nodeId) {
      // Empty nodeId = COMPONENT_DESELECTED — clear selection + styles
      selectComponent(null, null);
      setComponentStyles(null);
      return;
    }
    // If the fiber tree hasn't arrived yet, still commit the selection so
    // REQUEST_ELEMENT_STYLES fires — just pass null for the fiber data.
    if (!localFiberRoot) {
      selectComponent(nodeId, null);
      return;
    }
    const node = findFiberNode(localFiberRoot, nodeId);
    selectComponent(nodeId, node ?? null);
  }, [localFiberRoot, selectComponent, setComponentStyles]);

  const handleComponentStylesUpdate = useCallback((nodeId: string, styles: Record<string, string>) => {
    // Guard against stale responses arriving after the user has already clicked
    // a different component — only apply if artboard and node both still match.
    const { selectedComponentId: currentId, selectedArtboardId: currentArtboard } = useCanvas.getState();
    if (currentArtboard === id && currentId === nodeId) {
      setComponentStyles(styles);
    }
  }, [id, setComponentStyles]);

  // ── Drag to reposition ─────────────────────────────────────────────────────
  const isDragging    = useRef(false);
  const dragStart     = useRef({ mouseX: 0, mouseY: 0, artX: 0, artY: 0 });
  // dragOffsetRef carries the live offset into the onUp closure, avoiding the
  // stale-state problem that occurs when useCallback captures dragOffset before
  // any mousemove events have fired.
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  const onLabelMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag on left button; don't interfere with rename
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    isDragging.current = true;
    dragOffsetRef.current = { dx: 0, dy: 0 };
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
      const offset = {
        dx: curX - dragStart.current.mouseX,
        dy: curY - dragStart.current.mouseY,
      };
      // Update the ref first so onUp always reads the final position.
      dragOffsetRef.current = offset;
      setDragOffset(offset);
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      // Read the final offset from the ref — never stale regardless of when
      // useCallback last reconstructed onLabelMouseDown.
      const newX = Math.round(dragStart.current.artX + dragOffsetRef.current.dx);
      const newY = Math.round(dragStart.current.artY + dragOffsetRef.current.dy);

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
        dragOffsetRef.current = { dx: 0, dy: 0 };
      }).catch(console.error);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, x, y, width, height, renderUrl, workspaceId, projectId, queryClient]);

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

  // ── Delete artboard ────────────────────────────────────────────────────────
  const deleteArtboard = useCallback(() => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    fetch(`/api/artboards/${id}`, { method: 'DELETE' })
      .then(() => {
        selectArtboard(null);
        queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
      })
      .catch(console.error);
  }, [id, label, selectArtboard, workspaceId, projectId, queryClient]);

  const effectiveX = x + (isDragging.current ? dragOffset.dx : 0);
  const effectiveY = y + (isDragging.current ? dragOffset.dy : 0);

  return (
    <div
      style={{ position: 'absolute', top: effectiveY, left: effectiveX }}
      onMouseDown={(e) => e.stopPropagation()}
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
          <>
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
            {/* Delete button — only visible when selected */}
            {selected && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); deleteArtboard(); }}
                title="Delete artboard"
                style={{
                  marginLeft: 6,
                  background: 'none', border: 'none',
                  padding: '1px 3px', borderRadius: 3,
                  cursor: 'pointer', color: 'rgba(255,80,80,0.6)',
                  fontSize: 11, lineHeight: 1,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF5050'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,80,80,0.6)'; }}
              >
                ✕
              </button>
            )}
          </>
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

        {/* Diff status badge strip — bottom-right overlay, only visible when diffs exist */}
        {diffs.length > 0 && (() => {
          // Group by status and show compact chips
          const counts: Record<string, number> = {};
          for (const d of diffs) counts[d.status] = (counts[d.status] ?? 0) + 1;
          const entries = Object.entries(counts).filter(([s]) => s in DIFF_STATUS_BADGE);
          if (entries.length === 0) return null;
          return (
            <div
              style={{
                position: 'absolute', bottom: 6, right: 6, zIndex: 10,
                display: 'flex', gap: 4, pointerEvents: 'none',
              }}
            >
              {entries.map(([status, count]) => {
                const b = DIFF_STATUS_BADGE[status]!;
                return (
                  <span
                    key={status}
                    title={`${count} ${b.label} diff${count !== 1 ? 's' : ''}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 5px', borderRadius: 4,
                      background: b.bg, border: `1px solid ${b.color}33`,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: '0.5rem', fontWeight: 600,
                      color: b.color, letterSpacing: '0.03em',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                    {count}
                  </span>
                );
              })}
            </div>
          );
        })()}

        {/* Content */}
        {renderUrl ? (
          <>
            <LiveArtboard
              id={id}
              src={buildSrc(renderUrl, route)}
              width={width}
              height={height}
              selectedComponentId={selectedComponentId}
              onFiberTreeUpdate={handleFiberUpdate}
              onComponentSelected={handleComponentSelected}
              onComponentStylesUpdate={handleComponentStylesUpdate}
              onRoutesDiscovered={(routes) => onRoutesDiscovered?.(id, routes)}
            />
            <SelectionOverlay
              artboardId={id}
              {...(localFiberRoot !== undefined ? { fiberRoot: localFiberRoot } : {})}
              width={width}
              height={height}
              onSelectionChange={(sel) => {
                if (sel) selectArtboard(id);
                handleComponentSelected(sel?.nodeId ?? '');
              }}
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

  const hintStyle: React.CSSProperties = {
    margin: 0, fontSize: 10, color: '#A1A1AA', textAlign: 'center',
    lineHeight: 1.55, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    letterSpacing: '-0.01em',
  };

  return (
    <div
      data-tour="artboard-empty"
      style={{
        width, height, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F8F8FA', gap: 10, padding: 20,
      }}
    >
      {/* Artboard name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B', letterSpacing: '-0.02em', textAlign: 'center' }}>
        {label}
      </div>

      {editing ? (
        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            autoFocus
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="http://localhost:4170"
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
            style={{
              padding: '7px 10px', borderRadius: 6, border: '1.5px solid #0066FF',
              fontSize: 11, fontFamily: 'inherit', width: '100%',
              boxSizing: 'border-box' as const, color: '#0A0A0A', background: '#fff',
            }}
          />
          <p style={hintStyle}>
            Use the CLI proxy URL or a preview deployment URL with @originmain/live installed
          </p>
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
                color: '#3F3F46',
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
          <p style={{ margin: 0, fontSize: 11, color: '#52525B', textAlign: 'center', lineHeight: 1.5, maxWidth: 220 }}>
            Connect your running app to enable live component inspection
          </p>
          <p style={hintStyle}>
            npx @originmain/cli dev --target :3000
          </p>
          <button
            data-tour="artboard-url-btn"
            onClick={() => setEditing(true)}
            style={{
              padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)',
              background: '#fff', fontSize: 11, fontWeight: 600, color: '#0A0A0A',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Enter proxy URL
          </button>
        </>
      )}
    </div>
  );
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

