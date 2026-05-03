'use client';

import { useState, useCallback, useRef } from 'react';
import { useCanvas } from '@/store/canvas';
import { useHistory } from '@/store/history';
import { useArtboards, patchArtboard } from '@/hooks/useArtboards';
import { useDiffs } from '@/hooks/useDiffs';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvasTheme } from '@/store/canvasTheme';
import type { PropChange } from '@originmain/diff-engine';
import type { FiberNode } from '@originmain/renderer';
import type { Artboard, IntentDiff } from '@originmain/origin-graph';
import { FrameSection } from './sections/FrameSection';
import { LayoutSection } from './sections/LayoutSection';
import { FillSection } from './sections/FillSection';
import { StrokeSection } from './sections/StrokeSection';
import { EffectsSection } from './sections/EffectsSection';
import { TypographySection } from './sections/TypographySection';
import { BoxModelSection } from './sections/BoxModelSection';
import { ConstraintsSection } from './sections/ConstraintsSection';

const TYPE_COLORS: Record<string, string> = {
  s: '#7DD3A8',
  n: '#7EB8FF',
  b: '#FFBA7B',
};

type TabId = 'design' | 'props' | 'diff' | 'graph';

export function Inspector() {
  const T = useCanvasTheme();
  const { selectedArtboardId, liveArtboardIds, artboardFiberRoots, selectedComponentId, selectedComponentData, selectedComponentStyles, workspaceId, projectId } = useCanvas();
  const [tab, setTab] = useState<TabId>('design');
  const { rawArtboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const selectedArtboard = rawArtboards.find((ab) => ab.id === selectedArtboardId) ?? null;
  const isLive = selectedArtboardId ? liveArtboardIds.has(selectedArtboardId) : false;

  return (
    <div
      data-tour="inspector-panel"
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
        {(['design', 'props', 'diff', 'graph'] as TabId[]).map((t) => (
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
                color: T.dim,
                letterSpacing: '0.06em',
              }}
            >
              Select an artboard
            </span>
          </div>
        ) : tab === 'design' ? (
          <DesignTab
            artboardId={selectedArtboardId}
            componentId={selectedComponentId}
            componentData={selectedComponentData}
            styles={selectedComponentStyles}
          />
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
          background: T.bgDeep,
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

/* ── Design tab ─────────────────────────────────────────────── */

/** Strip the numeric portion from a CSS value: "320px" → "320", "1.5" → "1.5" */
function parseCssNum(val: string | undefined): string {
  if (!val) return '';
  const m = val.match(/^(-?[\d.]+)/);
  return m?.[1] ?? '';
}

/** Extract the unit suffix: "320px" → "px", "1.5" → "", "14pt" → "pt" */
function parseCssUnit(val: string | undefined): string {
  if (!val) return 'px';
  const m = val.match(/^-?[\d.]+(.*)$/);
  return m?.[1]?.trim() ?? '';
}

/** rgb()/rgba() → #RRGGBB */
function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n ?? '0').toString(16).padStart(2, '0'))
    .join('');
}

/** rgba(..., 0.8) → "80"  (percent string, no %) */
function rgbaAlpha(val: string): string {
  const m = val.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/);
  if (!m) return '100';
  const a = m[1] !== undefined ? parseFloat(m[1]) : 1;
  return String(Math.round(a * 100));
}

/** Is the CSS color transparent / none? */
function isTransparent(val: string | undefined): boolean {
  if (!val) return true;
  return val === 'transparent' || val === 'rgba(0, 0, 0, 0)';
}

// ── Compact numeric stepper input ────────────────────────────────

function NumInput({
  value,
  propKey,
  onPatch,
  inputWidth = 60,
}: {
  value: string;
  propKey: string;
  onPatch: (prop: string, val: string) => void;
  inputWidth?: number;
}) {
  const T = useCanvasTheme();
  const unit = parseCssUnit(value);
  const numStr = parseCssNum(value);
  const [draft, setDraft] = useState(numStr);
  const prevRef = useRef(value);

  if (prevRef.current !== value) {
    prevRef.current = value;
    setDraft(parseCssNum(value));
  }

  const commit = (v: string) => {
    const n = parseFloat(v);
    if (!isNaN(n)) onPatch(propKey, `${n}${unit}`);
  };

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') { commit(draft); e.currentTarget.blur(); }
        if (e.key === 'Escape') setDraft(parseCssNum(value));
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const n = parseFloat(draft) || 0;
          const step = e.shiftKey ? 10 : 1;
          const next = e.key === 'ArrowUp' ? n + step : n - step;
          setDraft(String(next));
          onPatch(propKey, `${next}${unit}`);
        }
        e.stopPropagation();
      }}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        background: T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        color: T.fg,
        padding: '3px 6px',
        width: inputWidth,
        outline: 'none',
        textAlign: 'right',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Plain text input (e.g. font-family, box-shadow) ────────────────

function TextInput({
  value,
  propKey,
  onPatch,
  fullWidth,
}: {
  value: string;
  propKey: string;
  onPatch: (prop: string, val: string) => void;
  fullWidth?: boolean;
}) {
  const T = useCanvasTheme();
  const [draft, setDraft] = useState(value);
  const prevRef = useRef(value);
  if (prevRef.current !== value) { prevRef.current = value; setDraft(value); }

  return (
    <input
      value={draft}
      onChange={e => { setDraft(e.target.value); onPatch(propKey, e.target.value); }}
      onBlur={() => onPatch(propKey, draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') { onPatch(propKey, draft); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setDraft(value); onPatch(propKey, value); }
        e.stopPropagation();
      }}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        background: T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        color: T.fg,
        padding: '3px 6px',
        width: fullWidth ? '100%' : undefined,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Color swatch + hex input ──────────────────────────────────────

function ColorInput({
  value,
  propKey,
  onPatch,
}: {
  value: string;
  propKey: string;
  onPatch: (prop: string, val: string) => void;
}) {
  const T = useCanvasTheme();
  const colorRef = useRef<HTMLInputElement>(null);
  const hex = value.startsWith('rgb') ? rgbToHex(value) : (value.startsWith('#') ? value : '#000000');
  const [hexDraft, setHexDraft] = useState(hex.replace('#', ''));

  const prevRef = useRef(value);
  if (prevRef.current !== value) {
    prevRef.current = value;
    setHexDraft((value.startsWith('rgb') ? rgbToHex(value) : value).replace('#', ''));
  }

  const commitHex = (v: string) => {
    const cleaned = v.startsWith('#') ? v : `#${v}`;
    onPatch(propKey, cleaned);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
      {/* Colour swatch — click to open native color picker */}
      <div
        title="Pick colour"
        style={{
          width: 20, height: 20, borderRadius: 3, flexShrink: 0,
          background: hex,
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
        onClick={() => colorRef.current?.click()}
      >
        <input
          ref={colorRef}
          type="color"
          value={hex}
          onChange={e => onPatch(propKey, e.target.value)}
          style={{
            position: 'absolute', inset: 0, opacity: 0,
            cursor: 'pointer', width: '100%', height: '100%',
          }}
        />
      </div>
      {/* Hex text */}
      <input
        value={hexDraft.toUpperCase()}
        maxLength={6}
        onChange={e => {
          const v = e.target.value.replace(/[^0-9a-fA-F]/g, '');
          setHexDraft(v);
          if (v.length === 3 || v.length === 6) commitHex(v);
        }}
        onBlur={() => commitHex(hexDraft)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitHex(hexDraft);
          e.stopPropagation();
        }}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5875rem',
          background: T.bgDeep,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          color: T.fg,
          padding: '3px 6px',
          width: 60,
          outline: 'none',
        }}
      />
    </div>
  );
}

// ── Native select styled with design tokens ───────────────────────

function CssSelect({
  value,
  propKey,
  options,
  onPatch,
}: {
  value: string;
  propKey: string;
  options: Array<{ val: string; label: string }>;
  onPatch: (prop: string, val: string) => void;
}) {
  const T = useCanvasTheme();
  return (
    <select
      value={value}
      onChange={e => onPatch(propKey, e.target.value)}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        background: T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        color: T.fg,
        padding: '3px 5px',
        cursor: 'pointer',
        flex: 1,
        outline: 'none',
      }}
    >
      {options.map(o => (
        <option key={o.val} value={o.val}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Toggle group for text-align ───────────────────────────────────

function TextAlignToggle({ value, onPatch }: { value: string; onPatch: (v: string) => void }) {
  const T = useCanvasTheme();
  const opts = [
    { val: 'left',    icon: '⬤  ◻ ◻ ◻' },
    { val: 'center',  icon: '◻ ⬤  ⬤  ◻' },
    { val: 'right',   icon: '◻ ◻ ◻  ⬤' },
    { val: 'justify', icon: '≡' },
  ] as const;
  const labels: Record<string, string> = { left: 'L', center: 'C', right: 'R', justify: 'J' };
  return (
    <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
      {opts.map(o => (
        <button
          key={o.val}
          title={o.val}
          onClick={() => onPatch(o.val)}
          style={{
            width: 22, height: 22,
            background: o.val === value ? T.accent : T.bgDeep,
            border: `1px solid ${o.val === value ? T.accent : T.border}`,
            borderRadius: 3, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5625rem',
            color: o.val === value ? '#fff' : T.fgMuted,
          }}
        >
          {labels[o.val]}
        </button>
      ))}
    </div>
  );
}

// ── Toggle group for flex-direction ──────────────────────────────

function FlexDirToggle({ value, onPatch }: { value: string; onPatch: (v: string) => void }) {
  const T = useCanvasTheme();
  const opts = [
    { val: 'row', icon: '→' },
    { val: 'column', icon: '↓' },
    { val: 'row-reverse', icon: '←' },
    { val: 'column-reverse', icon: '↑' },
  ] as const;
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {opts.map(o => (
        <button
          key={o.val}
          title={o.val}
          onClick={() => onPatch(o.val)}
          style={{
            width: 22, height: 22,
            background: o.val === value ? T.accent : T.bgDeep,
            border: `1px solid ${o.val === value ? T.accent : T.border}`,
            borderRadius: 3, cursor: 'pointer', fontSize: '0.625rem',
            color: o.val === value ? '#fff' : T.fgMuted,
          }}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

// ── Sub-section label ─────────────────────────────────────────────

function DesignSectionLabel({ children }: { children: React.ReactNode }) {
  const T = useCanvasTheme();
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.5rem',
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: T.label,
      marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

// ── Label above a field ───────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  const T = useCanvasTheme();
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.5rem',
      color: T.dim,
      letterSpacing: '0.04em',
      userSelect: 'none',
    }}>
      {children}
    </span>
  );
}

// ── Main Design Tab ───────────────────────────────────────────────

function DesignTab({
  artboardId,
  componentId,
  componentData,
  styles,
}: {
  artboardId: string | null;
  componentId: string | null;
  componentData: FiberNode | null;
  styles: Record<string, string> | null;
}) {
  const T = useCanvasTheme();
  const { patchStyleEdit, patchChildrenStyleEdit, indexerStatus, selectedComponentHasDirectText, selectedComponentHasParagraphChildren } = useCanvas();

  if (!artboardId) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
          Select an artboard
        </span>
      </div>
    );
  }

  if (!componentId) {
    return (
      <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.22 }}>
          <rect x="2" y="2" width="24" height="24" rx="4" stroke="white" strokeWidth="1.4" strokeDasharray="4 2"/>
          <circle cx="14" cy="14" r="4" stroke="white" strokeWidth="1.4"/>
        </svg>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: T.dim, letterSpacing: '0.04em', lineHeight: 1.6 }}>
          Click a component in the<br/>artboard to inspect &amp; edit
        </span>
      </div>
    );
  }

  if (!styles) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
          Fetching styles…
        </span>
      </div>
    );
  }

  const patch = (prop: string, val: string) => {
    if (!artboardId || !componentId) return;
    patchStyleEdit(artboardId, componentId, prop, val);
  };

  const patchChildren = (selector: string, prop: string, val: string) => {
    if (!artboardId || !componentId) return;
    patchChildrenStyleEdit(artboardId, componentId, selector, prop, val);
  };

  // ── Derive call-site display ──────────────────────────────────────
  const callSite = componentData?.callSite;
  const callSiteLabel = callSite
    ? (() => {
        // Show the last two path segments for readability: "app/page.tsx:34"
        const parts = callSite.fileName.replace(/\\/g, '/').split('/');
        const short = parts.slice(-2).join('/');
        return `${short}:${callSite.lineNumber}`;
      })()
    : null;

  // ── Indexer status dot ────────────────────────────────────────────
  const indexerDot = {
    offline:  { color: T.dim,       title: 'CLI indexer offline' },
    indexing: { color: '#FFBA7B',   title: 'Indexing…'           },
    ready:    { color: '#7DD3A8',   title: 'Indexer ready'       },
  }[indexerStatus];

  return (
    <>
      {/* ── Component identity header ────────────────────────────── */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: `1px solid ${T.sep}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Component name */}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: T.fg,
            letterSpacing: '-0.01em',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {componentData?.name ?? componentId}
          </span>
          {/* Indexer dot */}
          <div
            title={indexerDot.title}
            style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: indexerDot.color,
              boxShadow: indexerStatus === 'ready' ? `0 0 5px ${indexerDot.color}` : 'none',
              transition: 'background 0.3s',
            }}
          />
        </div>
        {/* Call-site breadcrumb — "used in app/page.tsx:34" */}
        {callSiteLabel && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5rem',
            color: T.dim,
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
            title={`${callSite?.fileName}:${callSite?.lineNumber}`}
          >
            ↳ {callSiteLabel}
          </span>
        )}
      </div>

      {/* ── Section components ───────────────────────────────────── */}
      <FrameSection       styles={styles} onPatch={patch} />
      <ConstraintsSection styles={styles} onPatch={patch} />
      <LayoutSection      styles={styles} onPatch={patch} />
      <FillSection        styles={styles} onPatch={patch} />
      <StrokeSection      styles={styles} onPatch={patch} />
      <TypographySection
        styles={styles}
        hasDirectText={selectedComponentHasDirectText}
        hasParagraphChildren={selectedComponentHasParagraphChildren}
        onPatch={patch}
        onPatchChildren={patchChildren}
      />
      <EffectsSection     styles={styles} onPatch={patch} />
      <BoxModelSection    styles={styles} onPatch={patch} />
    </>
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
  const T = useCanvasTheme();
  const queryClient = useQueryClient();
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [editingRoute, setEditingRoute] = useState(false);
  const [routeDraft, setRouteDraft] = useState('');

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

  const reservedKeys = new Set(['x', 'y', 'width', 'height', 'renderUrl', 'route']);
  const extraProps = Object.entries(meta)
    .filter(([k]) => !reservedKeys.has(k))
    .map(([k, v]) => {
      const t = typeof v;
      const color = t === 'number' ? N : t === 'boolean' ? B : S;
      const val = t === 'string' ? `"${v}"` : String(v);
      return { key: k, val, color };
    });

  const renderUrl = typeof meta['renderUrl'] === 'string' ? meta['renderUrl'] as string : '';
  const currentRoute = typeof meta['route'] === 'string' ? meta['route'] as string : '/';

  const saveRoute = useCallback(async () => {
    if (!artboard) return;
    const cleaned = routeDraft.trim() || '/';
    const { route: _r, ...rest } = artboard.metadata_jsonb;
    const meta2: Record<string, unknown> =
      cleaned === '/' ? { ...rest } : { ...rest, route: cleaned };
    try {
      await patchArtboard(artboard.id, { metadata_jsonb: meta2 });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (e) {
      console.error('[Inspector] patch route failed', e);
    }
    setEditingRoute(false);
  }, [artboard, routeDraft, workspaceId, projectId, queryClient]);

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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
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
        <PropRow label="id"   value={artboard.id.slice(0, 8) + '…'} color={T.key} />

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
                  background: T.bgDeep, border: `1px solid ${T.border}`,
                  borderRadius: 5, padding: '4px 8px', color: T.fg,
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
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
              not connected
            </span>
          )}
        </div>

        {/* route — which screen/path this artboard renders */}
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
                autoFocus
                value={routeDraft}
                onChange={e => setRouteDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void saveRoute();
                  if (e.key === 'Escape') setEditingRoute(false);
                }}
                placeholder="/dashboard"
                style={{
                  flex: 1, fontSize: '0.5875rem', fontFamily: "'JetBrains Mono', monospace",
                  background: T.bgDeep, border: `1px solid ${T.border}`,
                  borderRadius: 5, padding: '4px 8px', color: T.fg,
                  outline: 'none',
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

      {/* ── Drift Report ───────────────────────────────────── */}
      <Section label="Drift Report">
        <button
          onClick={() => void generateDriftReport()}
          disabled={driftStatus === 'loading'}
          style={{
            width: '100%',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5875rem',
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
            marginTop: 8,
            padding: '8px 10px',
            background: T.bgDeep,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            maxHeight: 220,
            overflowY: 'auto',
            fontSize: '0.5875rem',
            fontFamily: "'Inter', sans-serif",
            color: T.fgMuted,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            scrollbarWidth: 'thin',
            scrollbarColor: `${T.dim} transparent`,
          } as React.CSSProperties}>
            {driftReport}
          </div>
        )}
      </Section>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const T = useCanvasTheme();
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
  const T = useCanvasTheme();
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
  const T = useCanvasTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: depth * 14, marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isRoot ? T.accent : T.dim, flexShrink: 0 }} />
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: isRoot ? T.accent : T.fgMuted, letterSpacing: '-0.01em' }}>
        {label}
      </span>
    </div>
  );
}

/* ── Graph tab ────────────────────────────────────────────── */
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
  const T = useCanvasTheme();
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
          background: depth === 0 ? T.accent : T.dim,
        }} />
        {hasChildren && (
          <span style={{ fontSize: '0.5rem', color: T.fgDim, marginRight: -2 }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.625rem',
          color: depth === 0 ? T.accent : T.fgMuted,
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
  const T = useCanvasTheme();
  return <div style={{ height: 1, background: T.sep, margin: '2px 0' }} />;
}

/* ── Diff tab ─────────────────────────────────────────────── */
function DiffTab({ artboardId }: { artboardId: string | null }) {
  const T = useCanvasTheme();
  const { stacks } = useHistory();
  const { diffs, createDiff, isLoading } = useDiffs(artboardId);
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'summarising' | 'exporting'>('idle');

  const artboardHistory = artboardId ? (stacks[artboardId] ?? { past: [], future: [] }) : { past: [], future: [] };
  const pendingChanges: PropChange[] = artboardHistory.past.flatMap(e => e.changes);
  const hasChanges = pendingChanges.length > 0;

  const exportDiff = useCallback(async () => {
    if (!artboardId || !hasChanges) return;

    // 1. Generate AI summary (best-effort — fall back to empty string on failure)
    let summary = '';
    const meaningfulChanges = pendingChanges.filter(c => c.changeType !== 'unchanged');
    if (meaningfulChanges.length > 0) {
      setSummaryStatus('summarising');
      try {
        const res = await fetch('/api/ai/diff-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changesJson: JSON.stringify(meaningfulChanges),
            componentName: meaningfulChanges[0]?.key ?? 'Component',
          }),
        });
        if (res.ok) {
          const data = await res.json() as { summary?: string };
          summary = data.summary ?? '';
        }
      } catch { /* non-fatal — proceed without summary */ }
    }

    // 2. Export diff with AI-generated summary included
    setSummaryStatus('exporting');
    createDiff.mutate(
      {
        artboard_id: artboardId,
        changes_jsonb: { propChanges: pendingChanges, styleChanges: [] },
        summary,
        status: 'DRAFT',
      },
      { onSettled: () => setSummaryStatus('idle') },
    );
  }, [artboardId, pendingChanges, hasChanges, createDiff]);

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

      {/* Saved diffs from DB */}
      <Section label="Exported">
        {isLoading ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
            Loading…
          </span>
        ) : diffs.length === 0 ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
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
  const T = useCanvasTheme();
  const changes = diff.changes_jsonb as { propChanges?: PropChange[]; styleChanges?: PropChange[] } | null;
  const count = (changes?.propChanges?.length ?? 0) + (changes?.styleChanges?.length ?? 0);
  const color = STATUS_COLOR[diff.status] ?? T.dim;
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
      {diff.summary && (
        <span style={{ fontFamily: 'sans-serif', fontSize: '0.625rem', color: T.fgMuted, lineHeight: 1.4, display: 'block' }}>
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
