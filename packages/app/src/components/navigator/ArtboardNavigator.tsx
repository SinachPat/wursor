'use client';

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { useFileTree, FileTree } from '@pierre/trees/react';
import { themeToTreeStyles } from '@pierre/trees';
import { SquareRegular } from '@fluentui/react-icons';
import { useCanvas } from '@/store/canvas';
import { useArtboards, patchArtboard, createArtboardMutation } from '@/hooks/useArtboards';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvasTheme } from '@/store/canvasTheme';
import { useTheme } from '@/store/theme';

type NavTab = 'artboards' | 'routes';

export function ArtboardNavigator() {
  const T    = useCanvasTheme();
  const mode = useTheme((s) => s.mode);
  const [navTab, setNavTab] = useState<NavTab>('artboards');
  const { selectedArtboardId, selectArtboard, workspaceId, projectId, liveArtboardIds, artboardFiberRoots, discoveredRoutes } = useCanvas();
  const { artboards, rawArtboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const queryClient = useQueryClient();

  // Aggregate unique routes across all artboards, deduplicated by path
  const allRoutes = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ path: string; label: string; artboardId: string }> = [];
    for (const [artboardId, routes] of Object.entries(discoveredRoutes)) {
      for (const r of routes) {
        if (!seen.has(r.path)) {
          seen.add(r.path);
          result.push({ ...r, artboardId });
        }
      }
    }
    return result.sort((a, b) => a.path.localeCompare(b.path));
  }, [discoveredRoutes]);

  // Build a set of routes already covered by an artboard (for the "+" button logic)
  const coveredRoutes = useMemo(
    () => new Set(artboards.map((ab) => ab.route ?? '/')),
    [artboards],
  );

  // Map the panel theme into Trees' CSS custom properties — recomputed when mode changes
  const treeThemeStyles = themeToTreeStyles(mode === 'dark' ? {
    type: 'dark',
    bg: T.bg,
    fg: T.item,
    colors: {
      'editor.selectionBackground':       T.accentBg,
      'list.activeSelectionBackground':   T.accentBg,
      'list.inactiveSelectionBackground': T.selBg,
      'list.hoverBackground':             T.hoverBg,
      'list.activeSelectionForeground':   T.selFg,
      'editorIndentGuide.background':     T.sep,
    },
  } : {
    type: 'light',
    bg: T.bg,
    fg: T.item,
    colors: {
      'editor.selectionBackground':       T.accentBg,
      'list.activeSelectionBackground':   T.accentBg,
      'list.inactiveSelectionBackground': T.selBg,
      'list.hoverBackground':             T.hoverBg,
      'list.activeSelectionForeground':   T.selFg,
      'editorIndentGuide.background':     T.sep,
    },
  });

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
      data-tour="navigator-panel"
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
      {/* ── Tab switcher: Artboards | Routes ── */}
      <TabSwitcher T={T} active={navTab} onChange={setNavTab} routeCount={allRoutes.length} />

      {/* ── Artboards tab ── */}
      {navTab === 'artboards' && (
        <div style={{ padding: '2px 6px 0' }}>
          {artboards.map((ab) => {
            const sel = selectedArtboardId === ab.id;
            const live = liveArtboardIds.has(ab.id);
            return (
              <NavRow
                key={ab.id}
                T={T}
                selected={sel}
                live={live}
                onClick={() => selectArtboard(ab.id)}
                icon={
                  <SquareRegular
                    style={{ fontSize: 11, color: sel ? T.accent : T.dim, flexShrink: 0 }}
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
      )}

      {/* ── Routes tab ── */}
      {navTab === 'routes' && (
        <RoutesTab
          T={T}
          routes={allRoutes}
          coveredRoutes={coveredRoutes}
          artboards={artboards}
          workspaceId={workspaceId}
          projectId={projectId}
          queryClient={queryClient}
          selectArtboard={selectArtboard}
        />
      )}

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
        <GraphStat label="live"       value={liveCount > 0 ? String(liveCount) : '—'} color={liveCount > 0 ? T.live : T.fgDim} />
        <GraphStat label="components" value={totalComponents > 0 ? String(totalComponents) : '—'} color={T.fgMuted} />
      </div>

      {/* ── Cross-artboard query ── */}
      <CrossArtboardQuery workspaceId={workspaceId} />
    </div>
  );
}

/* ── Tab switcher ─────────────────────────────────────────── */
import type { CanvasTokens } from '@/store/canvasTheme';

function TabSwitcher({
  T,
  active,
  onChange,
  routeCount,
}: {
  T: CanvasTokens;
  active: NavTab;
  onChange: (tab: NavTab) => void;
  routeCount: number;
}) {
  const tabs: { key: NavTab; label: string }[] = [
    { key: 'artboards', label: 'Artboards' },
    { key: 'routes',    label: 'Routes' },
  ];
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      padding: '10px 10px 4px',
      flexShrink: 0,
    }}>
      {tabs.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              flex: 1,
              padding: '4px 0',
              background: isActive ? T.accentBg : 'transparent',
              border: `1px solid ${isActive ? T.accent + '55' : T.sep}`,
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '0.5625rem',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: isActive ? T.accent : T.dim,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'background 0.1s, color 0.1s, border-color 0.1s',
            }}
          >
            {label}
            {key === 'routes' && routeCount > 0 && (
              <span style={{
                background: isActive ? T.accent + '33' : T.sep,
                color: isActive ? T.accent : T.fgDim,
                borderRadius: 3,
                padding: '0 3px',
                fontSize: '0.5rem',
                fontWeight: 700,
                lineHeight: '14px',
                minWidth: 14,
                textAlign: 'center',
              }}>
                {routeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Routes tab ───────────────────────────────────────────── */
function RoutesTab({
  T,
  routes,
  coveredRoutes,
  artboards,
  workspaceId,
  projectId,
  queryClient,
  selectArtboard,
}: {
  T: CanvasTokens;
  routes: Array<{ path: string; label: string; artboardId: string }>;
  coveredRoutes: Set<string>;
  artboards: Array<{ id: string; label: string; route?: string; x: number; y: number; width: number; height: number; renderUrl?: string }>;
  workspaceId: string | null;
  projectId: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
  selectArtboard: (id: string | null) => void;
}) {
  const handleCreateArtboard = useCallback(async (route: { path: string; label: string; artboardId: string }) => {
    if (!workspaceId) return;
    const sourceAb = artboards.find((ab) => ab.id === route.artboardId);
    if (!sourceAb) return;
    const GAP = 80;
    const rightEdge = artboards.reduce(
      (max, ab) => Math.max(max, ab.x + ab.width),
      sourceAb.x + sourceAb.width,
    );
    try {
      await createArtboardMutation({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        name: route.label,
        origin_id: null,
        parent_artboard_id: null,
        metadata_jsonb: {
          x: rightEdge + GAP,
          y: sourceAb.y,
          width: sourceAb.width,
          height: sourceAb.height,
          renderUrl: sourceAb.renderUrl,
          route: route.path,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (err) {
      console.error('[Navigator] Failed to create artboard for route', err);
    }
  }, [artboards, workspaceId, projectId, queryClient]);

  if (routes.length === 0) {
    return (
      <div style={{
        padding: '16px 14px',
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.625rem',
        color: T.fgDim,
        lineHeight: 1.6,
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: 6, fontSize: '1rem', opacity: 0.4 }}>🔌</div>
        No routes discovered yet.
        <br />
        Connect a live artboard to auto-discover pages.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 6px 0', overflow: 'auto', flex: 1, minHeight: 0 }}>
      {routes.map((route) => {
        const isCovered = coveredRoutes.has(route.path);
        const existingAb = artboards.find((ab) => (ab.route ?? '/') === route.path);
        return (
          <RouteRow
            key={route.path}
            T={T}
            path={route.path}
            label={route.label}
            isCovered={isCovered}
            {...(existingAb ? { onOpen: () => selectArtboard(existingAb.id) } : {})}
            {...(!isCovered ? { onAdd: () => void handleCreateArtboard(route) } : {})}
          />
        );
      })}
    </div>
  );
}

function RouteRow({
  T,
  path,
  label,
  isCovered,
  onOpen,
  onAdd,
}: {
  T: CanvasTokens;
  path: string;
  label: string;
  isCovered: boolean;
  onOpen?: () => void;
  onAdd?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px 4px 10px',
        borderRadius: 5,
        cursor: onOpen ? 'pointer' : 'default',
        background: hov && onOpen ? T.hoverBg : 'transparent',
        marginBottom: 1,
        transition: 'background 0.1s',
      }}
    >
      {/* Route path icon */}
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 4.5h7M4.5 1.5l3 3-3 3" stroke={isCovered ? T.accent : T.dim} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.625rem',
          color: isCovered ? T.fg : T.fgMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {path}
        </div>
        {label !== path && (
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.5625rem',
            color: T.dim,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
        )}
      </div>

      {/* Status badge or add button */}
      {isCovered ? (
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.5rem',
          color: T.accent,
          background: T.accentBg,
          border: `1px solid ${T.accent}33`,
          borderRadius: 3,
          padding: '1px 4px',
          flexShrink: 0,
          letterSpacing: '0.05em',
        }}>
          ✓
        </span>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd?.(); }}
          title="Create artboard for this route"
          style={{
            background: hov ? T.accentBg : 'transparent',
            border: `1px solid ${hov ? T.accent + '55' : T.sep}`,
            borderRadius: 3,
            padding: '2px 5px',
            cursor: 'pointer',
            color: hov ? T.accent : T.dim,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: '0.5625rem',
            fontWeight: 700,
            flexShrink: 0,
            lineHeight: 1,
            transition: 'background 0.1s, color 0.1s, border-color 0.1s',
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

/* ── Artboard row ─────────────────────────────────────────── */

function NavRow({
  T,
  selected = false,
  live = false,
  onClick,
  icon,
  label,
  onRename,
  onFork,
  onDelete,
}: {
  T: CanvasTokens;
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
        background: selected ? T.selBg : hov ? T.hoverBg : 'transparent',
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
          background: T.live, flexShrink: 0, display: 'block',
          boxShadow: `0 0 4px ${T.liveBorder}`,
        }} />
      )}

      {/* Action buttons: rename + fork + delete — shown on hover */}
      {(hov || selected) && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {onRename && (
            <IconBtn T={T} title="Rename" onClick={onRename}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 7.5L7 1.5l1.5 1.5-6 6H1V7.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
          )}
          {onFork && (
            <IconBtn T={T} title="Fork" onClick={onFork}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="2" cy="2" r="1.2" stroke="currentColor" strokeWidth="1"/>
                <circle cx="8" cy="2" r="1.2" stroke="currentColor" strokeWidth="1"/>
                <circle cx="2" cy="8" r="1.2" stroke="currentColor" strokeWidth="1"/>
                <path d="M2 3.2v1.3C2 5.4 2.6 6 3.5 6H5M8 3.2V5a1 1 0 0 1-1 1H5m0 0v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </IconBtn>
          )}
          {onDelete && (
            <IconBtn T={T} title="Delete" onClick={onDelete} danger>
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

function IconBtn({ T, children, title, onClick, danger }: { T: CanvasTokens; children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? 'rgba(255,80,80,0.15)' : T.activeBg) : 'none',
        border: 'none', borderRadius: 3, padding: '2px 3px',
        cursor: 'pointer',
        color: hov ? (danger ? '#FF6060' : T.fg) : T.dim,
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
  const T = useCanvasTheme();
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
  const T = useCanvasTheme();
  return <div style={{ height: 1, background: T.sep, margin: '6px 0', flexShrink: 0 }} />;
}

function ActiveDot() {
  const T = useCanvasTheme();
  return (
    <span style={{
      marginLeft: 'auto',
      width: 5, height: 5,
      borderRadius: '50%',
      background: T.accent,
      flexShrink: 0, display: 'block',
    }} />
  );
}

function GraphStat({ label, value, color }: { label: string; value: string; color: string }) {
  const T = useCanvasTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: T.dim }}>
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
  const T = useCanvasTheme();
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
            flex: 1, background: T.bgDeep,
            border: `1px solid ${T.border}`,
            borderRadius: 5, padding: '5px 8px',
            fontSize: '0.5875rem', fontFamily: 'inherit',
            color: T.fg, outline: 'none',
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
          background: T.bgDeep,
          borderRadius: 5, fontSize: '0.5875rem',
          color: T.fgMuted, lineHeight: 1.55,
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
