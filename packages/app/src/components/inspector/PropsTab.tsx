'use client';

// ── Props Tab (Phase 2) ───────────────────────────────────────────────────────
// Displays artboard metadata, editable render URL / route, selected component
// props, and the Drift Report action. Extracted from Inspector.tsx as per
// spec SOURCE-AWARE-CANVAS.md Phase 2.

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvasTheme } from '@/store/canvasTheme';
import { patchArtboard } from '@/hooks/useArtboards';
import { HSep, Section, PropRow } from './DesignInputs';
import type { FiberNode } from '@originmain/renderer';
import type { Artboard } from '@originmain/origin-graph';

const TYPE_COLORS: Record<string, string> = {
  s: '#7DD3A8',
  n: '#7EB8FF',
  b: '#FFBA7B',
};

interface PropsTabProps {
  artboard:              Artboard | null;
  selectedComponentData: FiberNode | null;
  workspaceId:           string | null | undefined;
  projectId:             string | null | undefined;
}

export function PropsTab({
  artboard,
  selectedComponentData,
  workspaceId,
  projectId,
}: PropsTabProps) {
  const T = useCanvasTheme();
  const queryClient = useQueryClient();
  const [editingUrl,   setEditingUrl]   = useState(false);
  const [urlDraft,     setUrlDraft]     = useState('');
  const [editingRoute, setEditingRoute] = useState(false);
  const [routeDraft,   setRouteDraft]   = useState('');

  // Drift report
  const [driftStatus, setDriftStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [driftReport, setDriftReport] = useState('');

  const generateDriftReport = useCallback(async () => {
    if (!artboard) return;
    setDriftStatus('loading');
    setDriftReport('');
    try {
      const res = await fetch('/api/ai/drift-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ artboard_id: artboard.id }),
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
    const { renderUrl: _r, ...rest } = artboard.metadata_jsonb;
    const meta: Record<string, unknown> = urlDraft.trim()
      ? { ...rest, renderUrl: urlDraft.trim() }
      : { ...rest };
    try {
      await patchArtboard(artboard.id, { metadata_jsonb: meta });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (e) {
      console.error('[PropsTab] patch renderUrl failed', e);
    }
    setEditingUrl(false);
  }, [artboard, urlDraft, workspaceId, projectId, queryClient]);

  const saveRoute = useCallback(async () => {
    if (!artboard) return;
    const cleaned = routeDraft.trim() || '/';
    const { route: _r, ...rest } = artboard.metadata_jsonb;
    const meta: Record<string, unknown> =
      cleaned === '/' ? { ...rest } : { ...rest, route: cleaned };
    try {
      await patchArtboard(artboard.id, { metadata_jsonb: meta });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (e) {
      console.error('[PropsTab] patch route failed', e);
    }
    setEditingRoute(false);
  }, [artboard, routeDraft, workspaceId, projectId, queryClient]);

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

  const reservedKeys = new Set(['x', 'y', 'width', 'height', 'renderUrl', 'route']);
  const extraProps = Object.entries(meta)
    .filter(([k]) => !reservedKeys.has(k))
    .map(([k, v]) => {
      const t     = typeof v;
      const color = t === 'number' ? N : t === 'boolean' ? B : S;
      const val   = t === 'string' ? `"${v as string}"` : String(v);
      return { key: k, val, color };
    });

  const renderUrl    = typeof meta['renderUrl']  === 'string' ? (meta['renderUrl']  as string) : '';
  const currentRoute = typeof meta['route']      === 'string' ? (meta['route']      as string) : '/';

  return (
    <>
      {/* ── Selected fiber component props ─────────────────────────────── */}
      {selectedComponentData && (
        <>
          <Section label={`↳ ${selectedComponentData.name}`}>
            {Object.entries(selectedComponentData.props ?? {}).map(([k, v]) => {
              const t     = typeof v;
              const color = t === 'number' ? N : t === 'boolean' ? B : S;
              const disp  = t === 'string' ? `"${v as string}"` : String(v);
              return <PropRow key={k} label={k} value={disp} color={color} />;
            })}
            {Object.keys(selectedComponentData.props ?? {}).length === 0 && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
                No props
              </span>
            )}
          </Section>
          <HSep />
        </>
      )}

      {/* ── Extra artboard metadata props ─────────────────────────────── */}
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

      {/* ── Canvas position / size ─────────────────────────────────────── */}
      <Section label="Canvas">
        {canvasProps.map(({ key, val, color }) => (
          <PropRow key={key} label={key} value={val} color={color} />
        ))}
      </Section>
      <HSep />

      {/* ── Render target: URL + route ─────────────────────────────────── */}
      <Section label="Render Target">
        <PropRow label="name" value={artboard.name}                   color="#7EB8FF" />
        <PropRow label="id"   value={artboard.id.slice(0, 8) + '…'}  color={T.key} />

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
                autoFocus value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  void saveRenderUrl();
                  if (e.key === 'Escape') setEditingUrl(false);
                }}
                placeholder="http://localhost:3000"
                style={{
                  flex: 1, fontSize: '0.5875rem', fontFamily: "'JetBrains Mono', monospace",
                  background: T.bgDeep, border: `1px solid ${T.border}`,
                  borderRadius: 5, padding: '4px 8px', color: T.fg, outline: 'none',
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
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
              not connected
            </span>
          )}
        </div>

        {/* route */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingRoute ? 6 : 0 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.key }}>
              route
            </span>
            <button
              onClick={() => { setRouteDraft(currentRoute); setEditingRoute(true); }}
              style={{
                fontSize: '0.5rem', fontFamily: "'JetBrains Mono', monospace",
                background: 'none', border: 'none', color: T.accent,
                cursor: 'pointer', padding: 0, letterSpacing: '0.06em',
                display: editingRoute ? 'none' : 'block',
              }}
            >
              edit
            </button>
          </div>

          {editingRoute ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                autoFocus value={routeDraft}
                onChange={e => setRouteDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  void saveRoute();
                  if (e.key === 'Escape') setEditingRoute(false);
                }}
                placeholder="/dashboard"
                style={{
                  flex: 1, fontSize: '0.5875rem', fontFamily: "'JetBrains Mono', monospace",
                  background: T.bgDeep, border: `1px solid ${T.border}`,
                  borderRadius: 5, padding: '4px 8px', color: T.fg, outline: 'none',
                }}
              />
              <button
                onClick={() => void saveRoute()}
                style={{
                  fontSize: '0.5625rem', fontFamily: "'JetBrains Mono', monospace",
                  background: T.accent, border: 'none', borderRadius: 5,
                  color: '#fff', padding: '4px 8px', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem',
              color: currentRoute === '/' ? T.dim : '#7DD3A8',
            }}>
              {currentRoute}
            </span>
          )}
        </div>
      </Section>

      <HSep />

      {/* ── Drift Report ───────────────────────────────────────────────── */}
      <Section label="Drift Report">
        <button
          onClick={() => void generateDriftReport()}
          disabled={driftStatus === 'loading'}
          style={{
            width: '100%',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5875rem',
            background: driftStatus === 'loading' ? T.activeBg : T.accentBg,
            border: `1px solid ${driftStatus === 'loading' ? T.border : T.accent}`,
            borderRadius: 6, padding: '6px 0',
            color: driftStatus === 'loading' ? T.fgDim : T.accent,
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
            marginTop: 8, padding: '8px 10px',
            background: T.bgDeep, border: `1px solid ${T.border}`,
            borderRadius: 6, maxHeight: 220, overflowY: 'auto',
            fontSize: '0.5875rem', fontFamily: "'Inter', sans-serif",
            color: T.fgMuted, lineHeight: 1.65, whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', scrollbarWidth: 'thin',
            scrollbarColor: `${T.dim} transparent`,
          } as React.CSSProperties}>
            {driftReport}
          </div>
        )}
      </Section>
    </>
  );
}
