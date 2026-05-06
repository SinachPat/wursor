'use client';

// ── Fill Section — Full Implementation (spec §5.4) ────────────────────────────
// Multiple fill layers, per-layer type selector (None / Solid / Gradient / Image),
// gradient bar with draggable color stops, linear/radial toggle, angle input,
// and per-layer opacity.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasTheme } from '@/store/canvasTheme';
import { isTransparent, HSep } from '../DesignInputs';

// ── Types ──────────────────────────────────────────────────────────────────────

type FillType     = 'none' | 'solid' | 'gradient' | 'image';
type GradientKind = 'linear' | 'radial';

interface GradientStop {
  id:       string;
  color:    string;   // hex e.g. "#3385ff"
  position: number;   // 0–100
}

interface FillLayer {
  id:        string;
  type:      FillType;
  color:     string;        // hex (solid)
  opacity:   number;        // 0–100
  gradKind:  GradientKind;
  angle:     number;        // degrees (linear gradient)
  stops:     GradientStop[];
  imageUrl:  string;        // CSS url(…)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function hexFromCss(css: string): string {
  if (css.startsWith('#')) return css.slice(0, 7).padEnd(7, '0');
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n ?? '0', 10).toString(16).padStart(2, '0'))
    .join('');
}

function alphaFromCss(css: string): number {
  const m = css.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  return m ? Math.round(parseFloat(m[1] ?? '1') * 100) : 100;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function solidCss(layer: FillLayer): string {
  if (layer.opacity >= 100) return layer.color;
  const { r, g, b } = hexToRgb(layer.color);
  return `rgba(${r},${g},${b},${(layer.opacity / 100).toFixed(2)})`;
}

function gradientCss(layer: FillLayer): string {
  const sorted = [...layer.stops].sort((a, b) => a.position - b.position);
  const stops  = sorted.map(s => `${s.color} ${s.position.toFixed(0)}%`).join(', ');
  return layer.gradKind === 'linear'
    ? `linear-gradient(${layer.angle}deg, ${stops})`
    : `radial-gradient(circle, ${stops})`;
}

function layerToCss(layer: FillLayer): string {
  switch (layer.type) {
    case 'solid':    return solidCss(layer);
    case 'gradient': return gradientCss(layer);
    case 'image':    return `url(${layer.imageUrl})`;
    default:         return '';
  }
}

/** Best-effort parser for linear-gradient() / radial-gradient() CSS values. */
function parseGradient(css: string): Pick<FillLayer, 'gradKind' | 'angle' | 'stops'> | null {
  const isLinear = /linear-gradient/i.test(css);
  const isRadial = /radial-gradient/i.test(css);
  if (!isLinear && !isRadial) return null;

  // Extract the content inside the outermost parens
  const m = css.match(/(?:linear|radial)-gradient\((.+)\)/i);
  if (!m) return null;
  const parts = m[1]!.split(',').map(s => s.trim());

  let angle    = 135;
  let startIdx = 0;
  const first  = parts[0] ?? '';

  if (/^\d+deg$/.test(first)) {
    angle    = parseInt(first, 10);
    startIdx = 1;
  } else if (/^to\s/.test(first)) {
    const dir = first.slice(3).trim();
    angle = dir === 'right' ? 90 : dir === 'bottom' ? 180 : dir === 'left' ? 270 : 0;
    startIdx = 1;
  } else if (/^circle/.test(first)) {
    startIdx = 1;
  }

  const stops: GradientStop[] = [];
  const total = parts.length - startIdx;
  for (let i = startIdx; i < parts.length; i++) {
    const part = parts[i] ?? '';
    const pm   = part.match(/^(.+?)\s+([\d.]+)%\s*$/);
    const rawColor = (pm ? pm[1]!.trim() : part.trim());
    const pos  = pm ? parseFloat(pm[2]!) : ((i - startIdx) / Math.max(1, total - 1)) * 100;
    stops.push({ id: uid(), color: hexFromCss(rawColor), position: Math.round(pos) });
  }

  return { gradKind: isRadial ? 'radial' : 'linear', angle, stops };
}

function parseFills(styles: Record<string, string>): FillLayer[] {
  const bgImg   = styles['background-image'] ?? styles['background'] ?? '';
  const bgColor = styles['background-color'] ?? '';

  // Gradient
  if (/gradient\(/.test(bgImg)) {
    const g = parseGradient(bgImg);
    return [{
      id: uid(), type: 'gradient', color: '#ffffff', opacity: 100,
      gradKind: g?.gradKind ?? 'linear',
      angle:    g?.angle    ?? 135,
      stops:    g?.stops    ?? [
        { id: uid(), color: '#3385FF', position: 0 },
        { id: uid(), color: '#7DD3A8', position: 100 },
      ],
      imageUrl: '',
    }];
  }

  // Image url()
  if (/url\(/.test(bgImg)) {
    const urlM = bgImg.match(/url\(([^)]+)\)/);
    return [{
      id: uid(), type: 'image', color: '#000000', opacity: 100,
      gradKind: 'linear', angle: 135,
      stops: [{ id: uid(), color: '#000000', position: 0 }, { id: uid(), color: '#ffffff', position: 100 }],
      imageUrl: urlM?.[1] ?? '',
    }];
  }

  // Solid color
  const colorSrc = bgColor || bgImg;
  if (colorSrc && !isTransparent(colorSrc)) {
    return [{
      id: uid(), type: 'solid',
      color:   hexFromCss(colorSrc),
      opacity: alphaFromCss(colorSrc),
      gradKind: 'linear', angle: 135,
      stops: [
        { id: uid(), color: '#3385FF', position: 0 },
        { id: uid(), color: '#7DD3A8', position: 100 },
      ],
      imageUrl: '',
    }];
  }

  return [];
}

// ── Main component ─────────────────────────────────────────────────────────────

interface FillSectionProps {
  styles:  Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

export function FillSection({ styles, onPatch }: FillSectionProps) {
  const T = useCanvasTheme();
  const [open, setOpen]     = useState(true);
  const [layers, setLayers] = useState<FillLayer[]>(() => parseFills(styles));

  // Track a change-key so we re-init when a *different* component is selected.
  const prevKeyRef = useRef(
    (styles['background-color'] ?? '') +
    (styles['background-image'] ?? '') +
    (styles['background'] ?? ''),
  );

  useEffect(() => {
    const key =
      (styles['background-color'] ?? '') +
      (styles['background-image'] ?? '') +
      (styles['background'] ?? '');
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      setLayers(parseFills(styles));
    }
  }, [styles]);

  // Commit layer array → CSS props
  const commit = useCallback((next: FillLayer[]) => {
    setLayers(next);
    const active = next.filter(l => l.type !== 'none');
    if (active.length === 0) {
      onPatch('background-color', 'transparent');
      onPatch('background-image', 'none');
      return;
    }
    const hasDynamic = active.some(l => l.type === 'gradient' || l.type === 'image');
    if (!hasDynamic && active.length === 1) {
      onPatch('background-color', solidCss(active[0]!));
      onPatch('background-image', 'none');
    } else {
      const bgImgLayers = active.filter(l => l.type !== 'solid').map(layerToCss).filter(Boolean);
      const lastSolid   = active.filter(l => l.type === 'solid').slice(-1)[0];
      onPatch('background-image', bgImgLayers.length ? bgImgLayers.join(', ') : 'none');
      onPatch('background-color', lastSolid ? solidCss(lastSolid) : 'transparent');
    }
  }, [onPatch]);

  const addLayer = () => {
    commit([
      ...layers,
      {
        id: uid(), type: 'solid', color: '#ffffff', opacity: 100,
        gradKind: 'linear', angle: 135,
        stops: [
          { id: uid(), color: '#3385FF', position: 0 },
          { id: uid(), color: '#7DD3A8', position: 100 },
        ],
        imageUrl: '',
      },
    ]);
  };

  const removeLayer  = (id: string) => commit(layers.filter(l => l.id !== id));

  const updateLayer  = (id: string, patch: Partial<FillLayer>) =>
    commit(layers.map(l => l.id === id ? { ...l, ...patch } : l));

  const addStop = (layerId: string, position: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const sorted = [...layer.stops].sort((a, b) => a.position - b.position);
    const before = sorted.filter(s => s.position <= position).slice(-1)[0];
    const after  = sorted.filter(s => s.position >= position)[0];
    let newColor = '#888888';
    if (before && after && before !== after) {
      const t  = (position - before.position) / (after.position - before.position);
      const br = hexToRgb(before.color);
      const ar = hexToRgb(after.color);
      newColor = '#' + [
        Math.round(br.r + t * (ar.r - br.r)),
        Math.round(br.g + t * (ar.g - br.g)),
        Math.round(br.b + t * (ar.b - br.b)),
      ].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    } else if (before) {
      newColor = before.color;
    } else if (after) {
      newColor = after.color;
    }
    updateLayer(layerId, { stops: [...layer.stops, { id: uid(), color: newColor, position }] });
  };

  return (
    <>
      {/* Custom header row — uses a div wrapper so the + button can be a real <button>
          (nested <button> inside <button> is invalid HTML). */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center',
            padding: '7px 14px', background: 'transparent', border: 'none',
            cursor: 'pointer', userSelect: 'none', textAlign: 'left',
          }}
        >
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
            fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: T.label, flex: 1,
          }}>
            Fill
          </span>
          <span style={{ color: T.dim, fontSize: '0.55rem', marginLeft: 6 }}>
            {open ? '▾' : '▸'}
          </span>
        </button>

        {open && (
          <button
            onClick={addLayer}
            title="Add fill layer"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '7px 14px 7px 4px',
              color: T.dim, fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem', lineHeight: 1,
            }}
          >
            +
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: '0 0 6px' }}>
          {layers.length === 0 ? (
            <div style={{ padding: '0 14px 4px' }}>
              <button
                onClick={addLayer}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4, color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >
                + Add fill
              </button>
            </div>
          ) : (
            layers.map(layer => (
              <FillLayerRow
                key={layer.id}
                layer={layer}
                onAddStop={(pos) => addStop(layer.id, pos)}
                onChange={patch => updateLayer(layer.id, patch)}
                onRemove={() => removeLayer(layer.id)}
              />
            ))
          )}
        </div>
      )}

      <HSep />
    </>
  );
}

// ── Per-layer row ──────────────────────────────────────────────────────────────

const FILL_TYPES: FillType[] = ['none', 'solid', 'gradient', 'image'];
const TYPE_LABEL: Record<FillType, string> = {
  none: 'None', solid: 'Solid', gradient: 'Grad', image: 'Img',
};

function FillLayerRow({
  layer,
  onAddStop,
  onChange,
  onRemove,
}: {
  layer:     FillLayer;
  onAddStop: (position: number) => void;
  onChange:  (patch: Partial<FillLayer>) => void;
  onRemove:  () => void;
}) {
  const T = useCanvasTheme();
  const [selStopId, setSelStopId] = useState<string | null>(layer.stops[0]?.id ?? null);
  // Keep selectedStopId valid when stops list changes
  const selStop = layer.stops.find(s => s.id === selStopId) ?? layer.stops[0] ?? null;

  // Preview swatch CSS
  const swatchBg =
    layer.type === 'none'     ? undefined :
    layer.type === 'solid'    ? solidCss(layer) :
    layer.type === 'gradient' ? gradientCss(layer) :
    '#555';

  const checkerBg = `repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 0 0 / 6px 6px`;

  return (
    <div style={{ padding: '4px 14px 6px', borderBottom: `1px solid ${T.sep}22` }}>
      {/* Row: swatch · type segmented · opacity · × */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        {/* Color / gradient preview swatch */}
        <div style={{
          width: 18, height: 18, borderRadius: 3, flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.15)',
          background: layer.type === 'none' ? checkerBg : swatchBg,
        }} />

        {/* Segmented type selector */}
        <div style={{ display: 'flex', flex: 1, gap: 1 }}>
          {FILL_TYPES.map(t => (
            <button
              key={t}
              onClick={() => onChange({ type: t })}
              style={{
                flex: 1,
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.4375rem',
                letterSpacing: '0.02em', padding: '3px 0',
                background: layer.type === t ? 'rgba(51,133,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${layer.type === t ? 'rgba(51,133,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3,
                color: layer.type === t ? '#3385FF' : T.fgMuted,
                cursor: 'pointer', transition: 'background 0.1s, color 0.1s',
              }}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Opacity (solid / gradient) */}
        {(layer.type === 'solid' || layer.type === 'gradient') && (
          <OpacityInput value={layer.opacity} onChange={v => onChange({ opacity: v })} />
        )}

        {/* Remove fill layer */}
        <button
          onClick={onRemove}
          title="Remove fill"
          style={{
            background: 'none', border: 'none', color: T.dim,
            cursor: 'pointer', padding: '0 2px', lineHeight: 1,
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Type-specific editor */}
      {layer.type === 'solid' && (
        <SolidEditor color={layer.color} onChange={c => onChange({ color: c })} />
      )}

      {layer.type === 'gradient' && (
        <GradientEditor
          layer={layer}
          selectedStopId={selStop?.id ?? null}
          onSelectStop={setSelStopId}
          onAddStop={onAddStop}
          onChange={onChange}
          selectedStop={selStop}
        />
      )}

      {layer.type === 'image' && (
        <ImageEditor url={layer.imageUrl} onChange={url => onChange({ imageUrl: url })} />
      )}
    </div>
  );
}

// ── Solid color editor ─────────────────────────────────────────────────────────

function SolidEditor({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const T        = useCanvasTheme();
  const colorRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(color.replace('#', ''));
  const prevRef = useRef(color);
  if (prevRef.current !== color) { prevRef.current = color; setDraft(color.replace('#', '')); }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div
        style={{
          width: 20, height: 20, borderRadius: 3, flexShrink: 0,
          background: color, border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
        }}
        onClick={() => colorRef.current?.click()}
      >
        <input
          ref={colorRef} type="color" value={color}
          onChange={e => { onChange(e.target.value); setDraft(e.target.value.replace('#', '')); }}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </div>
      <input
        value={draft.toUpperCase()} maxLength={6}
        onChange={e => {
          const v = e.target.value.replace(/[^0-9a-fA-F]/g, '');
          setDraft(v);
          if (v.length === 3 || v.length === 6) onChange(`#${v}`);
        }}
        onBlur={() => { if (draft.length === 6) onChange(`#${draft}`); }}
        onKeyDown={e => { if (e.key === 'Enter') onChange(`#${draft}`); e.stopPropagation(); }}
        style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5875rem',
          background: T.bgDeep, border: `1px solid ${T.border}`,
          borderRadius: 4, color: T.fg, padding: '3px 6px', width: 60, outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── Opacity input ──────────────────────────────────────────────────────────────

function OpacityInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const T = useCanvasTheme();
  const [draft, setDraft] = useState(String(Math.round(value)));
  const prevRef = useRef(value);
  if (prevRef.current !== value) { prevRef.current = value; setDraft(String(Math.round(value))); }

  const commit = () => {
    const n = Math.max(0, Math.min(100, parseFloat(draft) || 0));
    onChange(n);
    setDraft(String(Math.round(n)));
  };

  return (
    <input
      value={`${draft}%`} size={4}
      onChange={e => setDraft(e.target.value.replace('%', '').trim())}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); e.stopPropagation(); }}
      style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
        background: T.bgDeep, border: `1px solid ${T.border}`,
        borderRadius: 3, color: T.fg, padding: '2px 4px',
        width: 38, outline: 'none', textAlign: 'right',
        boxSizing: 'border-box', flexShrink: 0,
      }}
    />
  );
}

// ── Gradient editor ────────────────────────────────────────────────────────────

function GradientEditor({
  layer,
  selectedStopId,
  onSelectStop,
  onAddStop,
  onChange,
  selectedStop,
}: {
  layer:          FillLayer;
  selectedStopId: string | null;
  onSelectStop:   (id: string) => void;
  onAddStop:      (pos: number) => void;
  onChange:       (patch: Partial<FillLayer>) => void;
  selectedStop:   GradientStop | null;
}) {
  const T = useCanvasTheme();

  const moveStop = useCallback((id: string, position: number) => {
    onChange({
      stops: layer.stops.map(s =>
        s.id === id ? { ...s, position: Math.max(0, Math.min(100, position)) } : s,
      ),
    });
  }, [layer.stops, onChange]);

  const updateStopColor = (id: string, color: string) =>
    onChange({ stops: layer.stops.map(s => s.id === id ? { ...s, color } : s) });

  const removeStop = (id: string) => {
    if (layer.stops.length <= 2) return;
    onChange({ stops: layer.stops.filter(s => s.id !== id) });
  };

  return (
    <div>
      {/* Gradient bar */}
      <GradientBar
        layer={layer}
        selectedStopId={selectedStopId}
        onSelectStop={onSelectStop}
        onMoveStop={moveStop}
        onAddStop={onAddStop}
      />

      {/* Selected stop controls */}
      {selectedStop && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
          <StopColorPicker
            color={selectedStop.color}
            onChange={c => updateStopColor(selectedStop.id, c)}
          />
          <input
            value={`${Math.round(selectedStop.position)}%`} size={4}
            onChange={e => {
              const v = parseFloat(e.target.value.replace('%', ''));
              if (!isNaN(v)) moveStop(selectedStop.id, v);
            }}
            onKeyDown={e => e.stopPropagation()}
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
              background: T.bgDeep, border: `1px solid ${T.border}`,
              borderRadius: 3, color: T.fg, padding: '2px 4px',
              width: 36, outline: 'none', textAlign: 'right', boxSizing: 'border-box',
            }}
          />
          {layer.stops.length > 2 && (
            <button
              onClick={() => removeStop(selectedStop.id)}
              style={{
                background: 'none', border: 'none', color: T.dim,
                cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Linear/Radial toggle + angle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {(['linear', 'radial'] as GradientKind[]).map(k => (
          <button
            key={k}
            onClick={() => onChange({ gradKind: k })}
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.4375rem',
              letterSpacing: '0.04em', padding: '2px 6px',
              background: layer.gradKind === k ? 'rgba(51,133,255,0.18)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${layer.gradKind === k ? 'rgba(51,133,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 3, color: layer.gradKind === k ? '#3385FF' : T.fgMuted,
              cursor: 'pointer',
            }}
          >
            {k}
          </button>
        ))}

        {layer.gradKind === 'linear' && (
          <>
            <span style={{ flex: 1 }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.4375rem',
              color: T.dim, letterSpacing: '0.04em',
            }}>
              angle
            </span>
            <input
              value={`${layer.angle}°`} size={4}
              onChange={e => {
                const v = parseFloat(e.target.value.replace('°', ''));
                if (!isNaN(v)) onChange({ angle: ((Math.round(v) % 360) + 360) % 360 });
              }}
              onKeyDown={e => e.stopPropagation()}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                background: T.bgDeep, border: `1px solid ${T.border}`,
                borderRadius: 3, color: T.fg, padding: '2px 4px',
                width: 42, outline: 'none', textAlign: 'right', boxSizing: 'border-box',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Gradient bar with draggable stop markers ───────────────────────────────────

function GradientBar({
  layer,
  selectedStopId,
  onSelectStop,
  onMoveStop,
  onAddStop,
}: {
  layer:          FillLayer;
  selectedStopId: string | null;
  onSelectStop:   (id: string) => void;
  onMoveStop:     (id: string, position: number) => void;
  onAddStop:      (position: number) => void;
}) {
  const barRef      = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);

  const posFromEvent = useCallback((e: MouseEvent): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  }, []);

  const handleStopMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = id;
    onSelectStop(id);

    const onMove = (ev: MouseEvent) => {
      if (draggingRef.current) onMoveStop(draggingRef.current, posFromEvent(ev));
    };
    const onUp = () => {
      draggingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [onSelectStop, onMoveStop, posFromEvent]);

  // Always render the gradient left-to-right in the bar preview
  const sorted  = [...layer.stops].sort((a, b) => a.position - b.position);
  const barGrad = `linear-gradient(90deg, ${sorted.map(s => `${s.color} ${s.position}%`).join(', ')})`;

  return (
    <div style={{ marginBottom: 7 }}>
      <div
        ref={barRef}
        style={{
          height: 20, borderRadius: 4,
          background: barGrad,
          border: '1px solid rgba(255,255,255,0.12)',
          position: 'relative', cursor: 'crosshair', userSelect: 'none',
        }}
        onClick={e => {
          // Ignore if we were dragging
          if (draggingRef.current) return;
          const bar = barRef.current;
          if (!bar) return;
          const rect = bar.getBoundingClientRect();
          const pos  = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
          onAddStop(pos);
        }}
      >
        {layer.stops.map(stop => (
          <div
            key={stop.id}
            onMouseDown={e => handleStopMouseDown(stop.id, e)}
            onClick={e => { e.stopPropagation(); onSelectStop(stop.id); }}
            title={`${stop.color} @ ${Math.round(stop.position)}%`}
            style={{
              position: 'absolute',
              left: `${stop.position}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 11, height: 11, borderRadius: '50%',
              background: stop.color,
              border: `2px solid ${stop.id === selectedStopId ? '#ffffff' : 'rgba(255,255,255,0.55)'}`,
              boxShadow: stop.id === selectedStopId
                ? '0 0 0 1.5px #3385FF, 0 1px 4px rgba(0,0,0,0.6)'
                : '0 1px 3px rgba(0,0,0,0.5)',
              cursor: 'grab', zIndex: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Gradient stop color picker ─────────────────────────────────────────────────

function StopColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const T        = useCanvasTheme();
  const colorRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(color.replace('#', ''));
  const prevRef = useRef(color);
  if (prevRef.current !== color) { prevRef.current = color; setDraft(color.replace('#', '')); }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          width: 18, height: 18, borderRadius: 3, flexShrink: 0,
          background: color, border: '1px solid rgba(255,255,255,0.2)',
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
        }}
        onClick={() => colorRef.current?.click()}
      >
        <input
          ref={colorRef} type="color" value={color}
          onChange={e => { onChange(e.target.value); setDraft(e.target.value.replace('#', '')); }}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </div>
      <input
        value={draft.toUpperCase()} maxLength={6}
        onChange={e => {
          const v = e.target.value.replace(/[^0-9a-fA-F]/g, '');
          setDraft(v);
          if (v.length === 3 || v.length === 6) onChange(`#${v}`);
        }}
        onBlur={() => { if (draft.length === 6) onChange(`#${draft}`); }}
        onKeyDown={e => { if (e.key === 'Enter') onChange(`#${draft}`); e.stopPropagation(); }}
        style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem',
          background: T.bgDeep, border: `1px solid ${T.border}`,
          borderRadius: 3, color: T.fg, padding: '2px 5px',
          width: 52, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── Image fill editor ──────────────────────────────────────────────────────────

function ImageEditor({ url, onChange }: { url: string; onChange: (v: string) => void }) {
  const T = useCanvasTheme();
  const [draft, setDraft] = useState(url);
  const prevRef = useRef(url);
  if (prevRef.current !== url) { prevRef.current = url; setDraft(url); }

  return (
    <input
      value={draft} placeholder="https://…"
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onChange(draft)}
      onKeyDown={e => { if (e.key === 'Enter') onChange(draft); e.stopPropagation(); }}
      style={{
        width: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
        background: T.bgDeep, border: `1px solid ${T.border}`,
        borderRadius: 4, color: T.fg, padding: '4px 6px',
        outline: 'none', boxSizing: 'border-box',
      }}
    />
  );
}
