'use client';

// ── Code Tab (Phase 4) ────────────────────────────────────────────────────────
// Shows a live source diff for the selected component based on pending style
// edits, with hunk-level accept/reject, Send-to-Agent, and Realtime status.
// Extracted from Inspector.tsx as per spec SOURCE-AWARE-CANVAS.md Phase 2.
//
// Phase 4 additions:
//   • diffIndicators: 'bars'  — gutter bar change indicators
//   • lineAnnotations         — token match badges on addition lines
//   • renderAnnotation        — renders the token key pill
//   • onTokenEnter/Leave      — hover tooltip showing matched design token
//   • rejectedHunks Set       — tracks explicitly rejected hunks
//   • allRejected guard       — disables Send-to-Agent when all hunks rejected

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCanvas } from '@/store/canvas';
import { useHistory } from '@/store/history';
import { useDiffs } from '@/hooks/useDiffs';
import { useIndexer } from '@/hooks/useIndexer';
import { useCanvasTheme } from '@/store/canvasTheme';
import { generatePatch } from '@originmain/diff-engine';
import type { PropChange } from '@originmain/diff-engine';
import type { FiberNode } from '@originmain/renderer';
import type { IntentDiff } from '@originmain/origin-graph';
import { FileDiff as PierreDiff } from '@pierre/diffs/react';
import type { DiffLineAnnotation } from '@pierre/diffs/react';
import { processFile, diffAcceptRejectHunk } from '@pierre/diffs';
import type { FileDiffMetadata } from '@pierre/diffs';
import { resolveValueToToken } from '@originmain/design-language';
import { browserClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Best-effort application of PropChange values to a source file string.
 * Searches for `propKey: oldValue` patterns and replaces with new values.
 */
function applyChangesToSource(source: string, changes: PropChange[]): string {
  let result = source;
  for (const change of changes) {
    if (change.before === undefined || change.before === change.after) continue;
    const escapedBefore = String(change.before).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${change.key}\\s*:\\s*)${escapedBefore}`, 'g');
    result = result.replace(re, `$1${String(change.after)}`);
  }
  return result;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    '#FFBA7B',
  REVIEWED: '#7EB8FF',
  APPLIED:  '#7DD3A8',
  REJECTED: '#FF8080',
};

export function SavedDiffRow({ diff }: { diff: IntentDiff }) {
  const T = useCanvasTheme();
  const changes = diff.changes as { propChanges?: PropChange[]; styleChanges?: PropChange[] } | null;
  const count   = (changes?.propChanges?.length ?? 0) + (changes?.styleChanges?.length ?? 0);
  const color   = STATUS_COLOR[diff.status] ?? T.dim;
  return (
    <div style={{ marginBottom: 8, padding: '6px 8px', background: T.bgDeep, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color }}>
          {diff.status}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: T.dim }}>
          {count} change{count !== 1 ? 's' : ''}
        </span>
      </div>
      {diff.aggregate_summary && (
        <span style={{ fontFamily: 'sans-serif', fontSize: '0.625rem', color: T.fgMuted, lineHeight: 1.4, display: 'block' }}>
          {diff.aggregate_summary}
        </span>
      )}
    </div>
  );
}

export function DiffChangeRow({ change }: { change: PropChange }) {
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
            fontSize: '0.625rem', padding: '4px 8px',
            borderRadius: 4, marginBottom: 3, lineHeight: 1.55,
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

// ── HunkList — virtualised list of hunk accept/reject controls ────────────────
// Uses @tanstack/react-virtual so even a 1 000-hunk diff won't freeze the panel.
// Each row is ~26px high; overscan=3 keeps the list feeling instant on scroll.

interface HunkListProps {
  hunks: FileDiffMetadata['hunks'];
  allRejected: boolean;
  fileDiff: FileDiffMetadata;
  handleRejectHunk: (renderedIdx: number) => void;
  setFileDiff: (d: FileDiffMetadata) => void;
}

function HunkList({ hunks, allRejected, fileDiff, handleRejectHunk, setFileDiff }: HunkListProps) {
  const T = useCanvasTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hunks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 26,
    overscan: 3,
  });

  return (
    <div
      style={{
        padding: '8px 12px', borderTop: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}
    >
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
        color: T.dim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2,
      }}>
        {hunks.length} hunk{hunks.length !== 1 ? 's' : ''}
        {allRejected && <span style={{ color: '#FF8080', marginLeft: 6 }}>— all rejected</span>}
      </span>

      {/* Scrollable virtual container — capped at 160px so it doesn't crowd the diff */}
      <div ref={scrollRef} style={{ maxHeight: 160, overflowY: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => (
            <div
              key={vItem.index}
              data-index={vItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%',
                transform: `translateY(${vItem.start}px)`,
                display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 4,
              }}
            >
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                color: T.fgMuted, flex: 1,
              }}>
                Hunk {vItem.index + 1}
              </span>
              <button
                onClick={() => setFileDiff(diffAcceptRejectHunk(fileDiff, vItem.index, 'accept'))}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                  color: '#7DD3A8', background: 'rgba(125,211,168,0.08)',
                  border: '1px solid rgba(125,211,168,0.28)', borderRadius: 3,
                  padding: '2px 7px', cursor: 'pointer',
                }}
              >
                accept
              </button>
              <button
                onClick={() => handleRejectHunk(vItem.index)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                  color: '#FF6B6B', background: 'rgba(255,107,107,0.08)',
                  border: '1px solid rgba(255,107,107,0.28)', borderRadius: 3,
                  padding: '2px 7px', cursor: 'pointer',
                }}
              >
                reject
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main CodeTab component ─────────────────────────────────────────────────────

interface CodeTabProps {
  componentId:   string | null;
  componentData: FiberNode | null;
  artboardId:    string | null;
}

// ── Token annotation metadata shape ───────────────────────────────────────────
interface TokenAnnotationMeta {
  tokenKey:  string;
  tokenName: string;
}

export function CodeTab({ componentId, componentData, artboardId }: CodeTabProps) {
  const T = useCanvasTheme();
  const {
    indexerStatus, undoStyleEdit, patchStyleEdit,
    designLanguageTokens, artboardRootFontSize,
  } = useCanvas();
  const { stacks }    = useHistory();
  const { fetchFile } = useIndexer();
  const { createDiff } = useDiffs(artboardId);

  const [diffStyle,   setDiffStyle]   = useState<'split' | 'unified'>('split');
  const [fileDiff,    setFileDiff]    = useState<FileDiffMetadata | null>(null);
  const [patchStr,    setPatchStr]    = useState<string>('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [diffError,   setDiffError]   = useState<string | null>(null);
  const [isSending,   setIsSending]   = useState(false);
  const [exportedId,  setExportedId]  = useState<string | null>(null);
  const [intentRtStatus, setIntentRtStatus] = useState<string | null>(null);

  // ── Phase 4: rejection tracking ───────────────────────────────────────────
  // rejectedHunks tracks each explicit hunk rejection; size compared against
  // initialHunkCount to determine when all hunks have been dismissed.
  const [rejectedHunks, setRejectedHunks] = useState<Set<number>>(new Set());
  const [initialHunkCount, setInitialHunkCount] = useState(0);
  // Monotonically incrementing ID so each rejection inserts a unique entry.
  const rejectionIdRef = useRef(0);

  // ── Phase 4: token hover tooltip ──────────────────────────────────────────
  const [tokenTooltip, setTokenTooltip] = useState<{
    tokenKey: string; tokenName: string; x: number; y: number;
  } | null>(null);

  const tokens        = designLanguageTokens ?? [];
  const rootFontSizePx = artboardId ? (artboardRootFontSize[artboardId] ?? 16) : 16;

  const artboardHistory = artboardId
    ? (stacks[artboardId] ?? { past: [], future: [] })
    : { past: [], future: [] };
  const pendingChanges = artboardHistory.past
    .flatMap(e => e.changes)
    .filter(c => c.changeType !== 'unchanged');

  // ── Generate diff ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!componentData?.callSite || indexerStatus !== 'ready' || pendingChanges.length === 0) {
      setFileDiff(null);
      setPatchStr('');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setDiffError(null);

    void (async () => {
      try {
        const filePath     = componentData.callSite!.fileName.replace(/\\/g, '/');
        const sourceContent = await fetchFile(filePath).catch(() => null);

        let patch: string;
        if (sourceContent) {
          const afterContent = applyChangesToSource(sourceContent, pendingChanges);
          patch = generatePatch(sourceContent, afterContent, { filename: filePath });
        } else {
          const beforeText = pendingChanges.map(c => `  ${c.key}: ${String(c.before)},`).join('\n');
          const afterText  = pendingChanges.map(c => `  ${c.key}: ${String(c.after)},`).join('\n');
          patch = generatePatch(beforeText, afterText, { filename: filePath });
        }

        if (cancelled || !patch) return;
        const parsed = processFile(patch);
        if (!cancelled) {
          setFileDiff(parsed ?? null);
          setPatchStr(patch);
          // Reset rejection tracking when a fresh diff arrives.
          setRejectedHunks(new Set());
          rejectionIdRef.current = 0;
          setInitialHunkCount(parsed?.hunks?.length ?? 0);
        }
      } catch (err) {
        if (!cancelled) setDiffError(err instanceof Error ? err.message : 'Diff generation failed');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentData?.callSite?.fileName, pendingChanges.length, indexerStatus, fetchFile]);

  // ── Realtime — watch intent_diffs for agent status ─────────────────────────
  useEffect(() => {
    if (!exportedId) return;
    const db = browserClient() as unknown as SupabaseClient;
    const channel = db
      .channel(`code_tab_intent_${exportedId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intent_diffs', filter: `id=eq.${exportedId}` },
        (payload: { new: Record<string, unknown> }) => {
          const status = payload.new['status'];
          if (typeof status === 'string') setIntentRtStatus(status);
        },
      )
      .subscribe();
    return () => { void db.removeChannel(channel); };
  }, [exportedId]);

  // ── Cmd+Z undo ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const undone = undoStyleEdit();
        if (undone) {
          e.preventDefault();
          patchStyleEdit(undone.artboardId, undone.nodeId, undone.property, undone.previousValue);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoStyleEdit, patchStyleEdit]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!componentId) {
    return (
      <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.22 }}>
          <polyline points="7,9 2,14 7,19"   stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <polyline points="21,9 26,14 21,19" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="16" y1="6" x2="12" y2="22" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: T.dim, letterSpacing: '0.04em', lineHeight: 1.6 }}>
          Select a component to<br/>view its source
        </span>
      </div>
    );
  }

  const filePath  = componentData?.callSite?.fileName?.replace(/\\/g, '/') ?? null;
  const shortPath = filePath ? filePath.split('/').slice(-2).join('/') : null;
  const hunkCount = fileDiff?.hunks?.length ?? 0;

  // ── Phase 4: allRejected guard ────────────────────────────────────────────
  // True when the user has explicitly dismissed every hunk via "reject".
  // Prevents sending an empty diff to the agent.
  const allRejected = initialHunkCount > 0 && rejectedHunks.size >= initialHunkCount;

  // ── Phase 4: per-hunk reject handler ─────────────────────────────────────
  const handleRejectHunk = useCallback((renderedIdx: number) => {
    const id = rejectionIdRef.current++;
    setRejectedHunks(prev => new Set([...prev, id]));
    setFileDiff(prev => prev ? diffAcceptRejectHunk(prev, renderedIdx, 'reject') : null);
  }, []);

  // ── Phase 4: line annotations (token match badges on addition lines) ──────
  // For each hunk that is not yet rejected, find the first pending change
  // whose new value resolves to a known design token and annotate the first
  // addition line of that hunk with the token key/name.
  const lineAnnotations = useMemo<DiffLineAnnotation<TokenAnnotationMeta>[]>(() => {
    if (!fileDiff || !tokens.length) return [];

    const annotations: DiffLineAnnotation<TokenAnnotationMeta>[] = [];

    fileDiff.hunks.forEach((hunk) => {
      for (const change of pendingChanges) {
        const cssValue = String(change.after ?? '').trim();
        if (!cssValue) continue;
        const match = resolveValueToToken(cssValue, tokens, rootFontSizePx);
        if (match) {
          annotations.push({
            side: 'additions',
            lineNumber: hunk.additionStart,
            metadata: { tokenKey: match.token.key, tokenName: match.token.name },
          });
          break; // one annotation per hunk
        }
      }
    });

    return annotations;
  }, [fileDiff, tokens, pendingChanges, rootFontSizePx]);

  // ── Phase 4: annotation renderer ─────────────────────────────────────────
  // Renders the token key as a small pill badge in the diff gutter annotation slot.
  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<TokenAnnotationMeta>): React.ReactNode => {
      if (!annotation.metadata) return null;
      return (
        <span
          title={annotation.metadata.tokenName}
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '1px 5px', borderRadius: 3, flexShrink: 0, whiteSpace: 'nowrap',
            background: 'rgba(125,211,168,0.10)',
            border: '1px solid rgba(125,211,168,0.28)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.45rem', color: '#7DD3A8', letterSpacing: '0.04em', lineHeight: 1.2,
          }}
        >
          {annotation.metadata.tokenKey}
        </span>
      );
    },
    [],
  );

  async function handleSendToAgent() {
    if (!artboardId || !fileDiff || pendingChanges.length === 0 || isSending) return;
    setIsSending(true);
    try {
      const result = await createDiff.mutateAsync({
        artboard_id:       artboardId,
        changes:           { propChanges: pendingChanges, styleChanges: [] },
        aggregate_summary: `Code diff — ${componentData?.name ?? componentId} (${pendingChanges.length} change${pendingChanges.length !== 1 ? 's' : ''})`,
        status:            'EXPORTED',
        session_id:        '',
        exported_code:     patchStr || null,
      });
      setExportedId(result.id);
      setIntentRtStatus('EXPORTED');
    } catch { /* mutation error shown via createDiff.isError */ }
    finally { setIsSending(false); }
  }

  const rtColour =
    intentRtStatus === 'IMPLEMENTED' ? '#7DD3A8' :
    intentRtStatus === 'BLOCKED'     ? '#FF6B6B' : '#FFBA7B';
  const rtBg =
    intentRtStatus === 'IMPLEMENTED' ? 'rgba(125,211,168,0.10)' :
    intentRtStatus === 'BLOCKED'     ? 'rgba(255,107,107,0.10)' : 'rgba(255,186,123,0.10)';
  const rtBorder =
    intentRtStatus === 'IMPLEMENTED' ? 'rgba(125,211,168,0.30)' :
    intentRtStatus === 'BLOCKED'     ? 'rgba(255,107,107,0.30)' : 'rgba(255,186,123,0.30)';
  const rtLabel =
    intentRtStatus === 'IMPLEMENTED' ? '✓ Implemented by agent' :
    intentRtStatus === 'BLOCKED'     ? '✗ Blocked — check agent output' :
    intentRtStatus ?? '';

  const canSend = !!fileDiff && !isSending && pendingChanges.length > 0 && !allRejected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '9px 12px', borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: T.fgMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortPath ?? '—'}
            {componentData?.callSite?.lineNumber != null && (
              <span style={{ color: T.dim }}>:{componentData.callSite.lineNumber}</span>
            )}
          </span>
          <span
            title={indexerStatus === 'ready' ? 'CLI indexer ready' : indexerStatus === 'indexing' ? 'Indexing…' : 'CLI indexer offline'}
            style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: indexerStatus === 'ready' ? '#7DD3A8' : indexerStatus === 'indexing' ? '#FFBA7B' : T.dim,
              boxShadow: indexerStatus === 'ready' ? '0 0 5px rgba(125,211,168,0.7)' : 'none',
              transition: 'background 0.25s',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem',
            color: T.accent, background: T.accentBg,
            border: `1px solid ${T.accent}33`, borderRadius: 4, padding: '1px 6px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100,
          }}>
            {componentData?.name ?? componentId}
          </span>
          <span style={{ flex: 1 }} />
          {(['split', 'unified'] as const).map(s => (
            <button
              key={s}
              onClick={() => setDiffStyle(s)}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                letterSpacing: '0.04em', textTransform: 'uppercase',
                color: diffStyle === s ? T.accent : T.dim,
                background: diffStyle === s ? T.accentBg : 'transparent',
                border: `1px solid ${diffStyle === s ? T.accent + '44' : 'transparent'}`,
                borderRadius: 3, padding: '2px 6px', cursor: 'pointer',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Diff viewer ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {indexerStatus !== 'ready' ? (
          <div style={{ padding: '20px 14px' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(255,186,123,0.06)', border: '1px solid rgba(255,186,123,0.2)', borderRadius: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFBA7B', flexShrink: 0 }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: '#FFBA7B', letterSpacing: '0.04em' }}>CLI indexer offline</span>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.5875rem', color: T.fgDim, lineHeight: 1.6, margin: 0 }}>
                Source diffs require the CLI indexer. Run{' '}
                <code style={{ fontFamily: "'JetBrains Mono', monospace", color: '#FFBA7B', fontSize: '0.5rem' }}>
                  npx @originmain/cli dev
                </code>{' '}to enable.
              </p>
            </div>
          </div>
        ) : pendingChanges.length === 0 ? (
          <div style={{ padding: '36px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: T.dim, letterSpacing: '0.04em' }}>
              No pending changes
            </span>
          </div>
        ) : isLoading ? (
          <div style={{ padding: '36px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: T.dim }}>Generating diff…</span>
          </div>
        ) : diffError ? (
          <div style={{ padding: '14px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: '#FF6B6B' }}>
            {diffError}
          </div>
        ) : fileDiff ? (
          <div style={{ position: 'relative' }}>
            {/* Token hover tooltip (Phase 4) */}
            {tokenTooltip && (
              <div
                style={{
                  position: 'fixed',
                  left: tokenTooltip.x, top: tokenTooltip.y + 4,
                  zIndex: 9999,
                  padding: '4px 8px', borderRadius: 5,
                  background: '#1A1A22', border: '1px solid rgba(125,211,168,0.3)',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: '#7DD3A8' }}>
                  {tokenTooltip.tokenKey}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.45rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {tokenTooltip.tokenName}
                </div>
              </div>
            )}

            <PierreDiff<TokenAnnotationMeta>
              fileDiff={fileDiff}
              lineAnnotations={lineAnnotations}
              renderAnnotation={renderAnnotation}
              options={{
                diffStyle,
                lineDiffType: 'char',
                diffIndicators: 'bars',
                onTokenEnter: (props, event) => {
                  void event;
                  const match = resolveValueToToken(props.tokenText, tokens, rootFontSizePx);
                  if (match) {
                    const rect = props.tokenElement.getBoundingClientRect();
                    setTokenTooltip({
                      tokenKey: match.token.key,
                      tokenName: match.token.name,
                      x: rect.left,
                      y: rect.bottom,
                    });
                  }
                },
                onTokenLeave: () => setTokenTooltip(null),
                onTokenClick: (props, event) => {
                  void event;
                  // Copy token key to clipboard on click.
                  const match = resolveValueToToken(props.tokenText, tokens, rootFontSizePx);
                  if (match) {
                    void navigator.clipboard.writeText(match.token.key).catch(() => { /* non-fatal */ });
                  }
                },
              }}
              style={{ fontSize: '0.5625rem' }}
            />
            {hunkCount > 0 && (
              <HunkList
                hunks={fileDiff.hunks}
                allRejected={allRejected}
                fileDiff={fileDiff}
                handleRejectHunk={handleRejectHunk}
                setFileDiff={setFileDiff}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* ── Footer: Realtime status + Send to Agent ───────────────────────── */}
      <div style={{ padding: '9px 12px', borderTop: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {intentRtStatus && (
          <div style={{ padding: '4px 9px', background: rtBg, border: `1px solid ${rtBorder}`, borderRadius: 5 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: rtColour, letterSpacing: '0.02em' }}>
              {rtLabel}
            </span>
          </div>
        )}
        <button
          onClick={() => void handleSendToAgent()}
          disabled={!canSend}
          style={{
            width: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5875rem',
            background: canSend ? T.accent : T.bgDeep,
            color: canSend ? '#fff' : T.dim,
            border: 'none', borderRadius: 6, padding: '7px 0',
            cursor: canSend ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {isSending ? 'Sending…' : 'Send to Agent'}
        </button>
      </div>
    </div>
  );
}
