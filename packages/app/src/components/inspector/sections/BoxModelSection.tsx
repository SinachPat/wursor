'use client';

// ── Box Model Section — Margin / Padding visual diagram ───────────────────────
// Renders a concentric-rectangle diagram (like browser DevTools' box model view).
// Outer ring = margin, middle ring = border, inner ring = padding, center = W×H.
// Each editable quad shows the current value; clicking focuses an inline input.

import { useState } from 'react';
import { useCanvasTheme } from '@/store/canvasTheme';
import { SectionHeader, HSep, parseCssNum, parseCssUnit } from '../DesignInputs';

interface BoxModelSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

// Parse a shorthand-or-individual CSS value for one side.
function getSide(styles: Record<string, string>, base: string, side: string): string {
  const individual = styles[`${base}-${side}`];
  if (individual) return individual;
  return styles[base] ?? '0px';
}

// Tiny inline editable cell for a box model value.
function BoxCell({
  prop,
  value,
  onPatch,
  mini = false,
  style: styleProp,
}: {
  prop: string;
  value: string;
  onPatch: (prop: string, val: string) => void;
  mini?: boolean;
  style?: React.CSSProperties;
}) {
  const T = useCanvasTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const num = parseCssNum(value);
  const unit = parseCssUnit(value);

  const display = num || '0';

  function commit(raw: string) {
    const n = parseFloat(raw);
    if (!isNaN(n)) onPatch(prop, `${n}${unit || 'px'}`);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit(draft);
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: mini ? 28 : 36,
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5625rem',
          background: T.bgDeep,
          border: `1px solid ${T.accent}`,
          borderRadius: 3,
          color: T.fg,
          outline: 'none',
          padding: '1px 3px',
          ...styleProp,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { setEditing(true); setDraft(num || '0'); }}
      title={`${prop}: ${value}`}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5625rem',
        color: T.fg,
        cursor: 'text',
        minWidth: mini ? 20 : 28,
        textAlign: 'center',
        display: 'inline-block',
        padding: '1px 2px',
        borderRadius: 2,
        transition: 'background 0.1s',
        ...styleProp,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = T.hoverBg ?? 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {display}
    </span>
  );
}

export function BoxModelSection({ styles, onPatch }: BoxModelSectionProps) {
  const T = useCanvasTheme();
  const [open, setOpen] = useState(false);

  // Margin values
  const mt = getSide(styles, 'margin', 'top');
  const mr = getSide(styles, 'margin', 'right');
  const mb = getSide(styles, 'margin', 'bottom');
  const ml = getSide(styles, 'margin', 'left');

  // Padding values
  const pt = getSide(styles, 'padding', 'top');
  const pr = getSide(styles, 'padding', 'right');
  const pb = getSide(styles, 'padding', 'bottom');
  const pl = getSide(styles, 'padding', 'left');

  // Border values (display only — editable via StrokeSection)
  const bw = styles['border-width'] ?? '0px';

  // Dimensions
  const w = parseCssNum(styles['width'] ?? '0px') || '—';
  const h = parseCssNum(styles['height'] ?? '0px') || '—';

  // Shared ring styles
  const ringBase: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.4375rem',
    color: T.dim,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    position: 'absolute',
    top: 4,
    left: 6,
    userSelect: 'none',
    pointerEvents: 'none',
  };

  return (
    <>
      <SectionHeader label="Box Model" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '8px 14px 12px' }}>
          {/* Outermost = margin */}
          <div style={{
            ...ringBase,
            background: 'rgba(255,200,100,0.07)',
            border: `1px solid rgba(255,200,100,0.18)`,
            borderRadius: 5,
            padding: '18px 20px',
            minHeight: 130,
          }}>
            <span style={labelStyle}>margin</span>

            {/* Top margin */}
            <BoxCell prop="margin-top" value={mt} onPatch={onPatch}
              mini style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties} />
            {/* Bottom margin */}
            <BoxCell prop="margin-bottom" value={mb} onPatch={onPatch}
              mini style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties} />
            {/* Left margin */}
            <BoxCell prop="margin-left" value={ml} onPatch={onPatch}
              mini style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)' } as React.CSSProperties} />
            {/* Right margin */}
            <BoxCell prop="margin-right" value={mr} onPatch={onPatch}
              mini style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' } as React.CSSProperties} />

            {/* Border ring */}
            <div style={{
              ...ringBase,
              background: 'rgba(130,170,255,0.07)',
              border: `1px solid rgba(130,170,255,0.22)`,
              borderRadius: 4,
              width: '100%',
              minHeight: 96,
              padding: '14px 16px',
            }}>
              <span style={{ ...labelStyle, color: 'rgba(130,170,255,0.55)' }}>border</span>
              {/* Border width — read-only hint */}
              <span style={{
                position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
                color: 'rgba(130,170,255,0.55)',
              }}>
                {parseCssNum(bw) || '0'}
              </span>

              {/* Padding ring */}
              <div style={{
                ...ringBase,
                background: 'rgba(100,200,130,0.07)',
                border: `1px solid rgba(100,200,130,0.22)`,
                borderRadius: 3,
                width: '100%',
                minHeight: 60,
                padding: '10px 12px',
              }}>
                <span style={{ ...labelStyle, color: 'rgba(100,200,130,0.55)' }}>padding</span>
                <BoxCell prop="padding-top" value={pt} onPatch={onPatch}
                  mini style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties} />
                <BoxCell prop="padding-bottom" value={pb} onPatch={onPatch}
                  mini style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties} />
                <BoxCell prop="padding-left" value={pl} onPatch={onPatch}
                  mini style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)' } as React.CSSProperties} />
                <BoxCell prop="padding-right" value={pr} onPatch={onPatch}
                  mini style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)' } as React.CSSProperties} />

                {/* Content dimensions */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.5625rem',
                  color: T.fg,
                  opacity: 0.7,
                  whiteSpace: 'nowrap',
                }}>
                  {w} × {h}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <HSep />
    </>
  );
}
