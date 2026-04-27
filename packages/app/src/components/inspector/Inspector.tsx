'use client';

import { useState, useCallback } from 'react';
import { useCanvas } from '@/store/canvas';
import { useHistory } from '@/store/history';
import { useArtboards, patchArtboard } from '@/hooks/useArtboards';
import { useDiffs } from '@/hooks/useDiffs';
import { useQueryClient } from '@tanstack/react-query';
import type { PropChange } from '@originmain/diff-engine';
import type { FiberNode } from '@originmain/renderer';
import type { Artboard, IntentDiff } from '@originmain/origin-graph';

const TYPE_COLORS: Record<string, string> = {
  s: '#7DD3A8',
  n: '#7EB8FF',
  b: '#FFBA7B',
};

type TabId = 'props' | 'diff' | 'graph';

// Dark panel tokens
const T = {
  bg:      '#111115',
  border:  'rgba(255,255,255,0.055)',
  sep:     'rgba(255,255,255,0.04)',
  label:   'rgba(255,255,255,0.22)',
  key:     'rgba(255,255,255,0.32)',
  dim:     'rgba(255,255,255,0.18)',
  accent:  '#3385FF',
  tabFg:   'rgba(255,255,255,0.28)',
  tabOn:   'rgba(255,255,255,0.88)',
};

export function Inspector() {
  const { selectedArtboardId, liveArtboardIds, artboardFiberRoots, selectedComponentId, selectedComponentData, workspaceId, projectId } = useCanvas();
  const [tab, setTab] = useState<TabId>('props');
  const { rawArtboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const selectedArtboard = rawArtboards.find((ab) => ab.id === selectedArtboardId) ?? null;
  const isLive = selectedArtboardId ? liveArtboardIds.has(selectedArtboardId) : false;

  return (
    <div
      className="dark-panel"
      style={{
        gridColumn: 3,
        gridRow: 2,
        background: T.bg,
        borderLeft: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {(['props', 'diff', 'graph'] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '11px 0',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '0.5875rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: tab === t ? T.tabOn : T.tabFg,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${T.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.12s',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content — minHeight:0 is required so this flex child can actually shrink and scroll */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {!selectedArtboardId ? (
          <div
            style={{
              padding: '32px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '1.25rem', opacity: 0.3 }}>⬜</span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: '0.625rem',
                color: 'rgba(255,255,255,0.22)',
                letterSpacing: '0.06em',
              }}
            >
              Select an artboard
            </span>
          </div>
        ) : tab === 'props' ? (
          <PropsTab
            artboard={selectedArtboard}
            selectedComponentData={selectedComponentId ? selectedComponentData : null}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : tab === 'diff' ? (
          <DiffTab artboardId={selectedArtboardId} />
        ) : (
          <GraphTab fiberRoot={selectedArtboardId ? artboardFiberRoots[selectedArtboardId] : undefined} />
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          height: 27,
          background: '#0D0D11',
          borderTop: `1px solid ${T.sep}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isLive ? '#10B981' : 'rgba(255,255,255,0.15)',
          boxShadow: isLive ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
          transition: 'background 0.3s, box-shadow 0.3s',
        }} />
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.45)' }}>
          {isLive ? 'Live render connected' : selectedArtboardId ? 'No render — set URL in Props' : 'No artboard selected'}
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.22)' }}>
          {selectedArtboard
            ? `${selectedArtboard.metadata_jsonb['width'] ?? '?'} × ${selectedArtboard.metadata_jsonb['height'] ?? '?'}`
            : '—'}
        </span>
      </div>
    </div>
  );
}

/* ── Props tab ────────────────────────────────────────────── */
function PropsTab({
  artboard,
  selectedComponentData,
  workspaceId,
  projectId,
}: {
  artboard: Artboard | null;
  selectedComponentData: FiberNode | null;
  workspaceId: string | null;
  projectId: string | null;
}) {
  const queryClient = useQueryClient();
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  // Drift report state
  const [driftStatus, setDriftStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [driftReport, setDriftReport] = useState('');

  const generateDriftReport = useCallback(async () => {
    if (!artboard) return;
    setDriftStatus('loading');
    setDriftReport('');
    try {
      const res = await fetch('/api/ai/drift-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artboard_id: artboard.id }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { report?: string; result?: string };
      setDriftReport(data.report ?? data.result ?? '— No report returned');
      setDriftStatus('done');
    } catch {
      setDriftStatus('error');
    }
  }, [artboard]);

  const saveRenderUrl = useCallback(async () => {
    if (!artboard) return;
    const { renderUrl: _removed, ...rest } = artboard.metadata_jsonb;
    const meta: Record<string, unknown> = urlDraft.trim()
      ? { ...rest, renderUrl: urlDraft.trim() }
      : { ...rest };
    try {
      await patchArtboard(artboard.id, { metadata_jsonb: meta });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (e) {
      console.error('[Inspector] patch renderUrl failed', e);
    }
    setEditingUrl(false);
  }, [artboard, urlDraft, workspaceId, projectId, queryClient]);

  if (!artboard) return null;

  const meta = artboard.metadata_jsonb;
  const N = TYPE_COLORS['n']!;
  const B = TYPE_COLORS['b']!;
  const S = TYPE_COLORS['s']!;

  const canvasProps: Array<{ key: string; val: string; color: string }> = [
    { key: 'x',      val: String(meta['x']      ?? 0), color: N },
    { key: 'y',      val: String(meta['y']      ?? 0), color: N },
    { key: 'width',  val: String(meta['width']  ?? 0), color: N },
    { key: 'height', val: String(meta['height'] ?? 0), color: N },
  ];

  const reservedKeys = new Set(['x', 'y', 'width', 'height', 'renderUrl']);
  const extraProps = Object.entries(meta)
    .filter(([k]) => !reservedKeys.has(k))
    .map(([k, v]) => {
      const t = typeof v;
      const color = t === 'number' ? N : t === 'boolean' ? B : S;
      const val = t === 'string' ? `"${v}"` : String(v);
      return { key: k, val, color };
    });

  const renderUrl = typeof meta['renderUrl'] === 'string' ? meta['renderUrl'] as string : '';

  return (
    <>
      {/* Selected fiber component props — shown when a component is clicked in canvas */}
      {selectedComponentData && (
        <>
          <Section label={`↳ ${selectedComponentData.name}`}>
            {Object.entries(selectedComponentData.props ?? {}).map(([k, v]) => {
              const t = typeof v;
              const color = t === 'number' ? N : t === 'boolean' ? B : S;
              const display = t === 'string' ? `"${v as string}"` : String(v);
              return <PropRow key={k} label={k} value={display} color={color} />;
            })}
            {Object.keys(selectedComponentData.props ?? {}).length === 0 && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.22)' }}>
                No props
              </span>
            )}
          </Section>
          <HSep />
        </>
      )}

      {extraProps.length > 0 && (
        <>
          <Section label="Component Props">
            {extraProps.map(({ key, val, color }) => (
              <PropRow key={key} label={key} value={val} color={color} />
            ))}
          </Section>
          <HSep />
        </>
      )}

      <Section label="Canvas">
        {canvasProps.map(({ key, val, color }) => (
          <PropRow key={key} label={key} value={val} color={color} />
        ))}
      </Section>
      <HSep />

      <Section label="Render Target">
        <PropRow label="name" value={artboard.name} color="#7EB8FF" />
        <PropRow label="id"   value={artboard.id.slice(0, 8) + '…'} color="rgba(255,255,255,0.28)" />

        {/* renderUrl — inline editable */}

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingUrl ? 6 : 0 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.key }}>
              url
            </span>
            <button
              onClick={() => { setUrlDraft(renderUrl); setEditingUrl(true); }}
              style={{
                fontSize: '0.5rem', fontFamily: "'JetBrains Mono', monospace",
                background: 'none', border: 'none', color: T.accent,
                cursor: 'pointer', padding: 0, letterSpacing: '0.06em',
                display: editingUrl ? 'none' : 'block',
              }}
            >
              {renderUrl ? 'edit' : '+ set'}
            </button>
          </div>

          {editingUrl ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                autoFocus
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void saveRenderUrl();
                  if (e.key === 'Escape') setEditingUrl(false);
                }}
                placeholder="http://localhost:3000"
                style={{
                  flex: 1, fontSize: '0.5875rem', fontFamily: "'JetBrains Mono', monospace",
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 5, padding: '4px 8px', color: 'rgba(255,255,255,0.85)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => void saveRenderUrl()}
                style={{
                  fontSize: '0.5625rem', fontFamily: "'JetBrains Mono', monospace",
                  background: T.accent, border: 'none', borderRadius: 5,
                  color: '#fff', padding: '4px 8px', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✓
              </button>
            </div>
          ) : renderUrl ? (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem',
              color: '#7DD3A8', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', display: 'block', maxWidth: '100%',
            }}>
              {renderUrl}
            </span>
          ) : (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.18)' }}>
              not connected
            </span>
          )}
        </div>
      </Section>

      <HSep />

      {/* ── Drift Report ───────────────────────────────────── */}
      <Section label="Drift Report">
        <button
          onClick={() => void generateDriftReport()}
          disabled={driftStatus === 'loading'}
          style={{
            width: '100%',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5875rem',
            background: driftStatus === 'loading' ? 'rgba(255,255,255,0.06)' : 'rgba(51,133,255,0.12)',
            border: `1px solid ${driftStatus === 'loading' ? 'rgba(255,255,255,0.08)' : 'rgba(51,133,255,0.25)'}`,
            borderRadius: 6, padding: '6px 0',
            color: driftStatus === 'loading' ? 'rgba(255,255,255,0.35)' : T.accent,
            cursor: driftStatus === 'loading' ? 'wait' : 'pointer',
            letterSpacing: '0.04em',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          {driftStatus === 'loading' ? 'Analysing…' : '↻ Generate drift report'}
        </button>

        {driftStatus === 'error' && (
          <div style={{ marginTop: 6, fontSize: '0.5rem', color: '#FF8080', fontFamily: 'monospace' }}>
            Report failed — try again
          </div>
        )}

        {driftStatus === 'done' && driftReport && (
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            maxHeight: 220,
            overflowY: 'auto',
            fontSize: '0.5875rem',
            fontFamily: "'Inter', sans-serif",
            color: 'rgba(255,255,255,0.62)',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.18) transparent',
          } as React.CSSProperties}>
            {driftReport}
          </div>
        )}
      </Section>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px' }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.5rem',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: T.label,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
        gap: 8,
      }}
    >
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: T.key, flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.625rem',
          color,
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '60%',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function GraphNode({ label, depth, isRoot }: { label: string; depth: number; isRoot?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: depth * 14, marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isRoot ? T.accent : 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: isRoot ? T.accent : 'rgba(255,255,255,0.5)', letterSpacing: '-0.01em' }}>
        {label}
      </span>
    </div>
  );
}

/* ── Graph tab ────────────────────────────────────────────── */
function GraphTab({ fiberRoot }: { fiberRoot: FiberNode | undefined }) {
  if (!fiberRoot) {
    return (
      <Section label="Origin Graph">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.22)' }}>
          No live render — connect a URL in Props to see the fiber tree
        </span>
      </Section>
    );
  }

  const nodeCount = countFiberNodes(fiberRoot);
  const treeDepth = measureFiberDepth(fiberRoot);

  return (
    <Section label="Origin Graph">
      <FiberTreeView node={fiberRoot} depth={0} />
      <HSep />
      <div style={{ padding: '4px 0 8px' }}>
        <PropRow label="nodes" value={String(nodeCount)} color="#7EB8FF" />
        <PropRow label="depth" value={String(treeDepth)} color="#7EB8FF" />
      </div>
    </Section>
  );
}

function FiberTreeView({ node, depth }: { node: FiberNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          paddingLeft: depth * 12, marginBottom: 4,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && setCollapsed(c => !c)}
      >
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: depth === 0 ? T.accent : 'rgba(255,255,255,0.2)',
        }} />
        {hasChildren && (
          <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', marginRight: -2 }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.625rem',
          color: depth === 0 ? T.accent : 'rgba(255,255,255,0.55)',
          letterSpacing: '-0.01em',
        }}>
          {node.name}
        </span>
      </div>
      {!collapsed && hasChildren && node.children!.map((child, i) => (
        <FiberTreeView key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function countFiberNodes(node: FiberNode): number {
  return 1 + (node.children ?? []).reduce((acc, c) => acc + countFiberNodes(c), 0);
}

function measureFiberDepth(node: FiberNode, d = 0): number {
  if (!node.children?.length) return d;
  return Math.max(...node.children.map(c => measureFiberDepth(c, d + 1)));
}

function HSep() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />;
}

/* ── Diff tab ─────────────────────────────────────────────── */
function DiffTab({ artboardId }: { artboardId: string | null }) {
  const { stacks } = useHistory();
  const { diffs, createDiff, isLoading } = useDiffs(artboardId);

  const artboardHistory = artboardId ? (stacks[artboardId] ?? { past: [], future: [] }) : { past: [], future: [] };
  const pendingChanges: PropChange[] = artboardHistory.past.flatMap(e => e.changes);
  const hasChanges = pendingChanges.length > 0;

  const exportDiff = useCallback(() => {
    if (!artboardId || !hasChanges) return;
    createDiff.mutate({
      artboard_id: artboardId,
      changes_jsonb: { propChanges: pendingChanges, styleChanges: [] },
      summary: '',
      status: 'DRAFT',
    });
  }, [artboardId, pendingChanges, hasChanges, createDiff]);

  if (!artboardId) {
    return (
      <Section label="Intent Diff">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.22)' }}>
          No artboard selected
        </span>
      </Section>
    );
  }

  return (
    <>
      {/* Pending local changes */}
      <Section label={`Pending · ${hasChanges ? pendingChanges.filter(c => c.changeType !== 'unchanged').length : 0} changes`}>
        {hasChanges ? (
          <>
            {pendingChanges
              .filter(c => c.changeType !== 'unchanged')
              .map((change, i) => (
                <DiffChangeRow key={i} change={change} />
              ))}
            <button
              onClick={exportDiff}
              disabled={createDiff.isPending}
              style={{
                marginTop: 10, width: '100%',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5875rem',
                background: T.accent, border: 'none', borderRadius: 6,
                color: '#fff', padding: '7px 0', cursor: createDiff.isPending ? 'wait' : 'pointer',
                letterSpacing: '0.04em', opacity: createDiff.isPending ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {createDiff.isPending ? 'Exporting…' : 'Export diff →'}
            </button>
            {createDiff.isError && (
              <span style={{ fontSize: '0.5rem', color: '#FF8080', fontFamily: 'monospace', display: 'block', marginTop: 4 }}>
                Export failed — try again
              </span>
            )}
          </>
        ) : (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.22)' }}>
            No pending changes
          </span>
        )}
      </Section>

      <HSep />

      {/* Saved diffs from DB */}
      <Section label="Exported">
        {isLoading ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.22)' }}>
            Loading…
          </span>
        ) : diffs.length === 0 ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.22)' }}>
            No exported diffs yet
          </span>
        ) : (
          diffs.map(d => <SavedDiffRow key={d.id} diff={d} />)
        )}
      </Section>
    </>
  );
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    '#FFBA7B',
  REVIEWED: '#7EB8FF',
  APPLIED:  '#7DD3A8',
  REJECTED: '#FF8080',
};

function SavedDiffRow({ diff }: { diff: IntentDiff }) {
  const changes = diff.changes_jsonb as { propChanges?: PropChange[]; styleChanges?: PropChange[] } | null;
  const count = (changes?.propChanges?.length ?? 0) + (changes?.styleChanges?.length ?? 0);
  const color = STATUS_COLOR[diff.status] ?? T.dim;
  return (
    <div style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.025)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color }}>
          {diff.status}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.22)' }}>
          {count} change{count !== 1 ? 's' : ''}
        </span>
      </div>
      {diff.summary && (
        <span style={{ fontFamily: 'sans-serif', fontSize: '0.625rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, display: 'block' }}>
          {diff.summary}
        </span>
      )}
    </div>
  );
}

function DiffChangeRow({ change }: { change: PropChange }) {
  const isRemoved  = change.changeType === 'removed';
  const isAdded    = change.changeType === 'added';
  const isModified = change.changeType === 'modified';

  const rows: Array<{ op: 'del' | 'add'; text: string }> = [];
  if (isModified) {
    rows.push({ op: 'del', text: `− ${change.key}: ${change.before}` });
    rows.push({ op: 'add', text: `+ ${change.key}: ${change.after}` });
  } else if (isRemoved) {
    rows.push({ op: 'del', text: `− ${change.key}: ${change.before}` });
  } else if (isAdded) {
    rows.push({ op: 'add', text: `+ ${change.key}: ${change.after}` });
  }

  return (
    <>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: '0.625rem',
            padding: '4px 8px',
            borderRadius: 4,
            marginBottom: 3,
            lineHeight: 1.55,
            background: r.op === 'del' ? 'rgba(255,70,70,0.08)' : 'rgba(70,220,120,0.08)',
            color:      r.op === 'del' ? '#FF8080' : '#7DDBA0',
            borderLeft: `2px solid ${r.op === 'del' ? 'rgba(255,80,80,0.3)' : 'rgba(70,220,120,0.3)'}`,
          }}
        >
          {r.text}
        </div>
      ))}
    </>
  );
}
