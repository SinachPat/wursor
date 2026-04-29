'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useFileTree, FileTree } from '@pierre/trees/react';
import { themeToTreeStyles } from '@pierre/trees';
import { SquareRegular } from '@fluentui/react-icons';
import { useCanvas } from '@/store/canvas';
import { useArtboards, patchArtboard, createArtboardMutation } from '@/hooks/useArtboards';
import { useQueryClient } from '@tanstack/react-query';

const T = {
  bg:      '#111115',
  border:  'rgba(255,255,255,0.055)',
  item:    'rgba(255,255,255,0.42)',
  itemHov: 'rgba(255,255,255,0.72)',
  selBg:   'rgba(51,133,255,0.12)',
  selFg:   'rgba(255,255,255,0.88)',
  accent:  '#3385FF',
  dim:     'rgba(255,255,255,0.22)',
  sep:     'rgba(255,255,255,0.04)',
};

// Map the panel's dark theme into Trees' CSS custom properties
const treeThemeStyles = themeToTreeStyles({
  type: 'dark',
  bg: '#111115',
  fg: 'rgba(255,255,255,0.42)',
  colors: {
    'editor.selectionBackground':       'rgba(51,133,255,0.14)',
    'list.activeSelectionBackground':   'rgba(51,133,255,0.14)',
    'list.inactiveSelectionBackground': 'rgba(51,133,255,0.08)',
    'list.hoverBackground':             'rgba(255,255,255,0.04)',
    'list.activeSelectionForeground':   'rgba(255,255,255,0.88)',
    'editorIndentGuide.background':     'rgba(255,255,255,0.04)',
  },
});

export function ArtboardNavigator() {
  const { selectedArtboardId, selectArtboard, workspaceId, projectId, liveArtboardIds, artboardFiberRoots } = useCanvas();
  const { artboards, rawArtboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const queryClient = useQueryClient();

  const deleteArtboard = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/artboards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
    } catch (err) {
      console.error('[Navigator] deleteArtboard failed:', err);
      window.alert(`Could not delete "${name}" — please try again.`);
      return;
    }
    if (selectedArtboardId === id) selectArtboard(null);
    queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
  }, [selectedArtboardId, selectArtboard, workspaceId, projectId, queryClient]);

  const renameArtboard = useCallback(async (id: string, currentName: string) => {
    const newName = window.prompt('Rename artboard:', currentName);
    if (!newName || newName.trim() === currentName) return;
    await patchArtboard(id, { name: newName.trim() }).catch(console.error);
    queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
  }, [workspaceId, projectId, queryClient]);

  const forkArtboard = useCallback(async (id: string, label: string) => {
    if (!workspaceId) return;
    const source = rawArtboards.find(ab => ab.id === id);
    if (!source) return;
    const meta = { ...(source.metadata_jsonb as Record<string, unknown>) };
    // Offset fork to the right of the original so it doesn't overlap
    const srcWidth = typeof meta['width'] === 'number' ? (meta['width'] as number) : 360;
    meta['x'] = typeof meta['x'] === 'number' ? (meta['x'] as number) + srcWidth + 40 : 40;
    try {
      await createArtboardMutation({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        name: `Fork of ${label}`,
        origin_id: source.origin_id,
        parent_artboard_id: id,
        metadata_jsonb: meta,
      });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (err) {
      console.error('[Navigator] forkArtboard failed:', err);
      window.alert('Could not fork artboard — please try again.');
    }
  }, [workspaceId, projectId, rawArtboards, queryClient]);

  // Real graph stats derived from live fiber trees
  const totalComponents = Object.values(artboardFiberRoots).reduce(
    (acc, root) => acc + countFiberNodes(root), 0,
  );
  const liveCount = liveArtboardIds.size;

  // Build file tree paths from artboard names (strip .tsx suffix if present, else use name as path)
  const filePaths = rawArtboards.length > 0
    ? rawArtboards.map((ab) => `artboards/${ab.name}`)
    : ['artboards/(no artboards yet)'];

  const { model } = useFileTree({
    paths: filePaths,
    initialExpansion: 2,
    density: 'compact',
    icons: 'minimal',
  });

  return (
    <div
      className="dark-panel"
      style={{
        gridColumn: 1,
        gridRow: 2,
        background: T.bg,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      {/* ── Artboards ── */}
      <SectionLabel>Artboards</SectionLabel>
      <div style={{ padding: '2px 6px 0' }}>
        {artboards.map((ab) => {
          const sel = selectedArtboardId === ab.id;
          const live = liveArtboardIds.has(ab.id);
          return (
            <NavRow
              key={ab.id}
              selected={sel}
              live={live}
              onClick={() => selectArtboard(ab.id)}
              icon={
                <SquareRegular
                  style={{ fontSize: 11, color: sel ? T.accent : 'rgba(255,255,255,0.2)', flexShrink: 0 }}
                />
              }
              label={ab.label}
              onRename={() => void renameArtboard(ab.id, ab.label)}
              onFork={() => void forkArtboard(ab.id, ab.label)}
              onDelete={() => void deleteArtboard(ab.id, ab.label)}
            />
          );
        })}
      </div>

      <HSep />

      {/* ── Files — @pierre/trees ── */}
      <SectionLabel>Files</SectionLabel>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <FileTree
          model={model}
          style={{
            ...treeThemeStyles,
            height: '100%',
            width: '100%',
            // Fine-tune item sizing to match our panel density
            '--trees-item-height': '26px',
            '--trees-indent-width': '14px',
          } as React.CSSProperties}
        />
      </div>

      <HSep />

      {/* ── Graph stats ── */}
      <SectionLabel>Graph</SectionLabel>
      <div style={{ padding: '4px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <GraphStat label="artboards"  value={String(rawArtboards.length)} color={T.accent} />
        <GraphStat label="live"       value={liveCount > 0 ? String(liveCount) : '—'} color={liveCount > 0 ? '#10B981' : 'rgba(255,255,255,0.25)'} />
        <GraphStat label="components" value={totalComponents > 0 ? String(totalComponents) : '—'} color="rgba(255,255,255,0.45)" />
      </div>

      {/* ── Cross-artboard query ── */}
      <CrossArtboardQuery workspaceId={workspaceId} />
    </div>
  );
}

/* ── Artboard row ─────────────────────────────────────────── */
function NavRow({
  selected = false,
  live = false,
  onClick,
  icon,
  label,
  onRename,
  onFork,
  onDelete,
}: {
  selected?: boolean;
  live?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  onRename?: () => void;
  onFork?: () => void;
  onDelete?: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '4px 6px 4px 10px',
        borderRadius: 5,
        cursor: 'pointer',
        background: selected ? T.selBg : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        color:      selected ? T.selFg : hov ? T.itemHov : T.item,
        fontSize: '0.75rem',
        letterSpacing: '-0.01em',
        fontWeight: selected ? 500 : 400,
        userSelect: 'none',
        marginBottom: 1,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {icon}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>

      {/* Live render indicator — pulsing green dot */}
      {live && !hov && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#10B981', flexShrink: 0, display: 'block',
          boxShadow: '0 0 4px rgba(16,185,129,0.8)',
        }} />
      )}

      {/* Action buttons: rename + fork + delete — shown on hover */}
      {(hov || selected) && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {onRename && (
            <IconBtn title="Rename" onClick={onRename}>
              {/* Pencil */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 7.5L7 1.5l1.5 1.5-6 6H1V7.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
          )}
          {onFork && (
            <IconBtn title="Fork" onClick={onFork}>
              {/* Branch / fork icon */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="2" cy="2" r="1.2" stroke="currentColor" strokeWidth="1"/>
                <circle cx="8" cy="2" r="1.2" stroke="currentColor" strokeWidth="1"/>
                <circle cx="2" cy="8" r="1.2" stroke="currentColor" strokeWidth="1"/>
                <path d="M2 3.2v1.3C2 5.4 2.6 6 3.5 6H5M8 3.2V5a1 1 0 0 1-1 1H5m0 0v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
          )}
          {onDelete && (
            <IconBtn title="Delete" onClick={onDelete} danger>
              {/* Trash */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2.5h6M4 2.5V1.5h2V2.5M3 2.5v6h4v-6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? 'rgba(255,80,80,0.15)' : 'rgba(255,255,255,0.08)') : 'none',
        border: 'none', borderRadius: 3, padding: '2px 3px',
        cursor: 'pointer',
        color: hov ? (danger ? '#FF6060' : 'rgba(255,255,255,0.8)') : 'rgba(255,255,255,0.3)',
        transition: 'background 0.1s, color 0.1s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      padding: '12px 12px 5px',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: '0.5625rem',
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: T.dim,
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function HSep() {
  return <div style={{ height: 1, background: T.sep, margin: '6px 0', flexShrink: 0 }} />;
}

function ActiveDot() {
  return (
    <span style={{
      marginLeft: 'auto',
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: T.accent,
      flexShrink: 0,
      display: 'block',
    }} />
  );
}

function GraphStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.28)' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function countFiberNodes(node: { children?: unknown[] }): number {
  return 1 + (node.children ?? []).reduce<number>(
    (acc, c) => acc + countFiberNodes(c as { children?: unknown[] }),
    0,
  );
}

/* ── Cross-artboard query ─────────────────────────────────── */
function CrossArtboardQuery({ workspaceId }: { workspaceId: string | null }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [answer, setAnswer] = useState('');

  const submit = useCallback(async () => {
    if (!query.trim() || !workspaceId) return;
    setStatus('loading');
    setAnswer('');
    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, question: query.trim() }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { answer?: string; result?: string };
      setAnswer(data.answer ?? data.result ?? '—');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [query, workspaceId]);

  return (
    <div style={{ padding: '0 10px 14px', flexShrink: 0 }}>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: '0.5rem', fontWeight: 500, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: T.dim, padding: '8px 4px 6px',
      }}>
        Query
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit();
            e.stopPropagation();
          }}
          placeholder="Ask across artboards…"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5, padding: '5px 8px',
            fontSize: '0.5875rem', fontFamily: 'inherit',
            color: 'rgba(255,255,255,0.75)', outline: 'none',
          }}
        />
        <button
          onClick={() => void submit()}
          disabled={status === 'loading' || !query.trim() || !workspaceId}
          style={{
            background: T.accent, border: 'none', borderRadius: 5,
            padding: '5px 8px', cursor: 'pointer',
            fontSize: '0.5875rem', color: '#fff', flexShrink: 0,
            opacity: (status === 'loading' || !query.trim()) ? 0.5 : 1,
          }}
        >
          {status === 'loading' ? '…' : '↵'}
        </button>
      </div>
      {status === 'done' && answer && (
        <div style={{
          marginTop: 6, padding: '6px 8px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 5, fontSize: '0.5875rem',
          color: 'rgba(255,255,255,0.6)', lineHeight: 1.55,
          fontFamily: "'Inter', sans-serif",
          maxHeight: 120, overflow: 'auto',
        }}>
          {answer}
        </div>
      )}
      {status === 'error' && (
        <div style={{ marginTop: 4, fontSize: '0.5rem', color: '#FF8080', fontFamily: 'monospace' }}>
          Query failed — try again
        </div>
      )}
    </div>
  );
}
