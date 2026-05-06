'use client';

// ── Inspector panel ───────────────────────────────────────────────────────────
// Tab bar + routing to DesignTab / PropsTab / CodeTab / DiffTab / GraphTab.
// Heavy per-tab logic lives in the extracted tab files.

import { useState, useCallback } from 'react';
import { useCanvas } from '@/store/canvas';
import { useHistory } from '@/store/history';
import { useArtboards } from '@/hooks/useArtboards';
import { useDiffs } from '@/hooks/useDiffs';
import { useCanvasTheme } from '@/store/canvasTheme';
import { trpc } from '@/lib/trpc';
import { generatePatch } from '@originmain/diff-engine';
import type { PropChange } from '@originmain/diff-engine';
import type { FiberNode } from '@originmain/renderer';
import type { Artboard, IntentDiff } from '@originmain/origin-graph';
import { Section, PropRow, HSep } from './DesignInputs';
import { DesignTab } from './DesignTab';
import { PropsTab }  from './PropsTab';
import { CodeTab, DiffChangeRow, SavedDiffRow } from './CodeTab';

type TabId = 'design' | 'props' | 'code' | 'diff' | 'graph';

export function Inspector() {
  const T = useCanvasTheme();
  const {
    selectedArtboardId,
    liveArtboardIds,
    artboardFiberRoots,
    selectedComponentId,
    selectedComponentData,
    selectedComponentStyles,
    workspaceId,
    projectId,
  } = useCanvas();
  const [tab, setTab] = useState<TabId>('design');
  const { rawArtboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const selectedArtboard = rawArtboards.find((ab) => ab.id === selectedArtboardId) ?? null;
  const isLive = selectedArtboardId ? liveArtboardIds.has(selectedArtboardId) : false;

  return (
    <div
      data-tour="inspector-panel"
      className="dark-panel"
      style={{
        gridColumn: 3, gridRow: 2,
        background: T.bg, borderLeft: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 12,
      }}
    >
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {(['design', 'props', 'code', 'diff', 'graph'] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '11px 0',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '0.5875rem', fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color:       tab === t ? T.tabOn : T.tabFg,
              background:  'transparent', border: 'none',
              borderBottom: tab === t ? `2px solid ${T.accent}` : '2px solid transparent',
              cursor: 'pointer', transition: 'color 0.12s', marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content — minHeight:0 required so this flex child can shrink and scroll */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {!selectedArtboardId ? (
          <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span style={{ fontSize: '1.25rem', opacity: 0.3 }}>⬜</span>
            <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: T.dim, letterSpacing: '0.06em' }}>
              Select an artboard
            </span>
          </div>
        ) : tab === 'design' ? (
          <DesignTab
            artboardId={selectedArtboardId}
            componentId={selectedComponentId}
            componentData={selectedComponentData}
            styles={selectedComponentStyles}
            workspaceId={workspaceId}
          />
        ) : tab === 'props' ? (
          <PropsTab
            artboard={selectedArtboard}
            selectedComponentData={selectedComponentId ? selectedComponentData : null}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : tab === 'code' ? (
          <CodeTab
            componentId={selectedComponentId}
            componentData={selectedComponentData}
            artboardId={selectedArtboardId}
          />
        ) : tab === 'diff' ? (
          <DiffTab artboardId={selectedArtboardId} />
        ) : (
          <GraphTab fiberRoot={selectedArtboardId ? artboardFiberRoots[selectedArtboardId] : undefined} />
        )}
      </div>

      {/* Status bar */}
      <div style={{
        height: 27, background: T.bgDeep, borderTop: `1px solid ${T.sep}`,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isLive ? T.live : T.activeBg,
          boxShadow: isLive ? `0 0 6px ${T.liveBorder}` : 'none',
          transition: 'background 0.3s, box-shadow 0.3s',
        }} />
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.5625rem', color: T.fgMuted }}>
          {isLive ? 'Live render connected' : selectedArtboardId ? 'No render — set URL in Props' : 'No artboard selected'}
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.5625rem', color: T.dim }}>
          {selectedArtboard
            ? `${selectedArtboard.metadata_jsonb['width'] ?? '?'} × ${selectedArtboard.metadata_jsonb['height'] ?? '?'}`
            : '—'}
        </span>
      </div>
    </div>
  );
}

// ── Graph tab ─────────────────────────────────────────────────────────────────

function GraphTab({ fiberRoot }: { fiberRoot: FiberNode | undefined }) {
  const T = useCanvasTheme();
  if (!fiberRoot) {
    return (
      <Section label="Origin Graph">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
          No live render — connect a URL in Props to see the fiber tree
        </span>
      </Section>
    );
  }

  return (
    <Section label="Origin Graph">
      <FiberTreeView node={fiberRoot} depth={0} />
      <HSep />
      <div style={{ padding: '4px 0 8px' }}>
        <PropRow label="nodes" value={String(countFiberNodes(fiberRoot))} color="#7EB8FF" />
        <PropRow label="depth" value={String(measureFiberDepth(fiberRoot))} color="#7EB8FF" />
      </div>
    </Section>
  );
}

function FiberTreeView({ node, depth }: { node: FiberNode; depth: number }) {
  const T = useCanvasTheme();
  const [collapsed, setCollapsed] = useState(depth > 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: depth * 12, marginBottom: 4, cursor: hasChildren ? 'pointer' : 'default' }}
        onClick={() => hasChildren && setCollapsed(c => !c)}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: depth === 0 ? T.accent : T.dim }} />
        {hasChildren && (
          <span style={{ fontSize: '0.5rem', color: T.fgDim, marginRight: -2 }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: depth === 0 ? T.accent : T.fgMuted, letterSpacing: '-0.01em' }}>
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

// ── Diff tab ──────────────────────────────────────────────────────────────────

function DiffTab({ artboardId }: { artboardId: string | null }) {
  const T = useCanvasTheme();
  const { stacks } = useHistory();
  const { diffs, createDiff, isLoading } = useDiffs(artboardId);
  const { workspaceId, activeAgentSessionId } = useCanvas();
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'summarising' | 'exporting'>('idle');

  const summarizeDiff = trpc.ai.generateDiffSummary.useMutation();

  const artboardHistory  = artboardId ? (stacks[artboardId] ?? { past: [], future: [] }) : { past: [], future: [] };
  const pendingChanges: PropChange[] = artboardHistory.past.flatMap(e => e.changes);
  const hasChanges = pendingChanges.length > 0;

  const exportDiff = useCallback(async () => {
    if (!artboardId || !hasChanges) return;
    let summary = '';
    const meaningfulChanges = pendingChanges.filter(c => c.changeType !== 'unchanged');
    if (meaningfulChanges.length > 0 && workspaceId) {
      setSummaryStatus('summarising');
      try {
        const data = await summarizeDiff.mutateAsync({
          artboardId,
          workspaceId,
          changesJson:   JSON.stringify(meaningfulChanges),
          componentName: meaningfulChanges[0]?.key ?? 'Component',
        });
        summary = data.summary;
      } catch { /* non-fatal */ }
    }

    setSummaryStatus('exporting');
    createDiff.mutate(
      {
        artboard_id:       artboardId,
        changes:           { propChanges: pendingChanges, styleChanges: [] },
        aggregate_summary: summary,
        status:            'draft',
        session_id:        activeAgentSessionId ?? '',
      },
      { onSettled: () => setSummaryStatus('idle') },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artboardId, pendingChanges, hasChanges, createDiff, activeAgentSessionId]);

  if (!artboardId) {
    return (
      <Section label="Intent Diff">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
          No artboard selected
        </span>
      </Section>
    );
  }

  return (
    <>
      <Section label={`Pending · ${hasChanges ? pendingChanges.filter(c => c.changeType !== 'unchanged').length : 0} changes`}>
        {hasChanges ? (
          <>
            {pendingChanges
              .filter(c => c.changeType !== 'unchanged')
              .map((change, i) => <DiffChangeRow key={i} change={change} />)}
            <button
              onClick={() => void exportDiff()}
              disabled={summaryStatus !== 'idle' || createDiff.isPending}
              style={{
                marginTop: 10, width: '100%',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5875rem',
                background: T.accent, border: 'none', borderRadius: 6,
                color: '#fff', padding: '7px 0',
                cursor: (summaryStatus !== 'idle' || createDiff.isPending) ? 'wait' : 'pointer',
                letterSpacing: '0.04em',
                opacity: (summaryStatus !== 'idle' || createDiff.isPending) ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {summaryStatus === 'summarising' ? 'Summarising…' :
               summaryStatus === 'exporting' || createDiff.isPending ? 'Exporting…' :
               'Export diff →'}
            </button>
            {createDiff.isError && (
              <span style={{ fontSize: '0.5rem', color: '#FF8080', fontFamily: 'monospace', display: 'block', marginTop: 4 }}>
                Export failed — try again
              </span>
            )}
          </>
        ) : (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
            No pending changes
          </span>
        )}
      </Section>

      <HSep />

      <Section label="Exported">
        {isLoading ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>Loading…</span>
        ) : diffs.length === 0 ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>No exported diffs yet</span>
        ) : (
          diffs.map(d => <SavedDiffRow key={d.id} diff={d} />)
        )}
      </Section>
    </>
  );
}
