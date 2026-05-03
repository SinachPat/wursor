'use client';

// ── Constraints Section ───────────────────────────────────────────────────────
// Figma-style constraint anchors: 3×3 grid for horizontal and vertical pinning.
// Only shown when the element's position is 'absolute' or 'fixed'.
//
// Horizontal options: Left | Center | Right | Left+Right | Scale
// Vertical options:   Top  | Center | Bottom | Top+Bottom | Scale
//
// Selecting a constraint writes the appropriate CSS properties:
//   Left       → left: Xpx, removes right
//   Right      → right: Xpx, removes left
//   Center     → left: 50%, transform: translateX(-50%)
//   Left+Right → both left and right set
//   Scale      → width: X% (relative to parent)

import { useState } from 'react';
import { useCanvasTheme } from '@/store/canvasTheme';
import { SectionHeader, HSep } from '../DesignInputs';

type HConstraint = 'left' | 'center' | 'right' | 'left+right' | 'scale';
type VConstraint = 'top' | 'center' | 'bottom' | 'top+bottom' | 'scale';

interface ConstraintsSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

// ── Transform composition helpers ────────────────────────────────────────────
// These keep centering (translateX/Y) from clobbering other transforms such
// as CSS `rotate` or `scale` that may be set on the same element. (BUG-4)

/**
 * Replace or insert a single CSS translate function inside an existing
 * transform string without disturbing other functions (rotate, scale, etc.).
 */
function withTranslateFn(
  existing: string,
  fn: 'translateX' | 'translateY',
  value: string,
): string {
  const newFn = `${fn}(${value})`;
  if (!existing || existing === 'none') return newFn;
  const re = new RegExp(`${fn}\\([^)]*\\)`, 'g');
  if (re.test(existing)) return existing.replace(re, newFn);
  return `${existing} ${newFn}`;
}

/**
 * Remove all translateX/Y functions from a transform string.
 * Used when switching to a pin or scale constraint that shouldn't centre.
 */
function withoutTranslateFns(existing: string): string {
  if (!existing || existing === 'none') return 'none';
  const cleaned = existing.replace(/translate[XY]\([^)]*\)\s*/g, '').trim();
  return cleaned || 'none';
}

// ── Constraint inference ──────────────────────────────────────────────────────
// NOTE: `styles` comes from getComputedStyle, so percentage values are
// resolved to pixels. We can't detect 'center' from left==='50%' (BUG-5).
// Instead we use the presence of a translateX/Y in the transform string as a
// proxy — applyH/applyV always add them when centering. This is still
// best-effort: after a page reload the inline style is gone and the element
// will appear as 'left'/'top' until the user re-applies a constraint.

/** Infer current H constraint from computed styles */
function inferHConstraint(styles: Record<string, string>): HConstraint {
  const left      = styles['left']  ?? 'auto';
  const right     = styles['right'] ?? 'auto';
  const transform = styles['transform'] ?? '';
  // left+right must be checked before center to handle the edge case where
  // both sides are pinned and a translateX somehow also exists.
  if (left !== 'auto' && right !== 'auto') return 'left+right';
  // Detect center via translateX in the transform (set by applyH).
  // The '50%' check is retained as a secondary signal for inline styles.
  if (transform.includes('translateX') || left.includes('50%')) return 'center';
  if (right !== 'auto' && left === 'auto') return 'right';
  return 'left';
}

/** Infer current V constraint from computed styles */
function inferVConstraint(styles: Record<string, string>): VConstraint {
  const top       = styles['top']    ?? 'auto';
  const bottom    = styles['bottom'] ?? 'auto';
  const transform = styles['transform'] ?? '';
  if (top !== 'auto' && bottom !== 'auto') return 'top+bottom';
  if (transform.includes('translateY') || top.includes('50%')) return 'center';
  if (bottom !== 'auto' && top === 'auto') return 'bottom';
  return 'top';
}

// A single dot in the 3×3 constraint grid.
function ConstraintDot({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const T = useCanvasTheme();
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: active ? T.accent : 'transparent',
        border: `1.5px solid ${active ? T.accent : 'rgba(255,255,255,0.22)'}`,
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.1s, border-color 0.1s',
        flexShrink: 0,
      }}
    />
  );
}

export function ConstraintsSection({ styles, onPatch }: ConstraintsSectionProps) {
  const T = useCanvasTheme();
  const [open, setOpen] = useState(true);

  const isPositioned = styles['position'] === 'absolute' || styles['position'] === 'fixed';
  if (!isPositioned) return null;

  const hConstraint = inferHConstraint(styles);
  const vConstraint = inferVConstraint(styles);

  function applyH(c: HConstraint) {
    const curLeft   = styles['left']      ?? '0px';
    const curRight  = styles['right']     ?? '0px';
    const curTransform = styles['transform'] ?? 'none';
    switch (c) {
      case 'left':
        onPatch('left', curLeft === 'auto' ? '0px' : curLeft);
        onPatch('right', 'auto');
        // BUG-15 fix: clear any translateX that was set by a previous center constraint.
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
      case 'right':
        onPatch('right', curRight === 'auto' ? '0px' : curRight);
        onPatch('left', 'auto');
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
      case 'center':
        onPatch('left', '50%');
        onPatch('right', 'auto');
        // BUG-4 fix: compose translateX into the existing transform rather than
        // replacing it, so rotate/scale on the element are preserved.
        onPatch('transform', withTranslateFn(curTransform, 'translateX', '-50%'));
        break;
      case 'left+right':
        onPatch('left',  curLeft  === 'auto' ? '0px' : curLeft);
        onPatch('right', curRight === 'auto' ? '0px' : curRight);
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
      case 'scale':
        onPatch('width', '100%');
        onPatch('left', '0px');
        onPatch('right', 'auto');
        // BUG-15 fix: clear translateX so a previously-centred element doesn't
        // remain shifted after switching to scale mode.
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
    }
  }

  function applyV(c: VConstraint) {
    const curTop    = styles['top']       ?? '0px';
    const curBottom = styles['bottom']    ?? '0px';
    const curTransform = styles['transform'] ?? 'none';
    switch (c) {
      case 'top':
        onPatch('top', curTop === 'auto' ? '0px' : curTop);
        onPatch('bottom', 'auto');
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
      case 'bottom':
        onPatch('bottom', curBottom === 'auto' ? '0px' : curBottom);
        onPatch('top', 'auto');
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
      case 'center':
        onPatch('top', '50%');
        onPatch('bottom', 'auto');
        // BUG-4 fix: compose translateY, preserving other transform functions.
        onPatch('transform', withTranslateFn(curTransform, 'translateY', '-50%'));
        break;
      case 'top+bottom':
        onPatch('top',    curTop    === 'auto' ? '0px' : curTop);
        onPatch('bottom', curBottom === 'auto' ? '0px' : curBottom);
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
      case 'scale':
        onPatch('height', '100%');
        onPatch('top', '0px');
        onPatch('bottom', 'auto');
        onPatch('transform', withoutTranslateFns(curTransform));
        break;
    }
  }

  // The 3×3 grid encodes:
  //   Row/col 0 = start (left/top)
  //   Row/col 1 = center
  //   Row/col 2 = end (right/bottom)
  // Both H and V dots share the same grid; the horizontal line represents H constraints
  // and the vertical line represents V constraints.
  //
  //  TL  T  TR     ← these dots are the 9 "anchor" positions
  //   L  C   R
  //  BL  B  BR

  type GridPos = [number, number]; // [col, row]

  const hPositions: Array<{ pos: GridPos; h: HConstraint; label: string }> = [
    { pos: [0, 1], h: 'left',       label: 'Pin left' },
    { pos: [1, 1], h: 'center',     label: 'Center horizontally' },
    { pos: [2, 1], h: 'right',      label: 'Pin right' },
  ];

  const vPositions: Array<{ pos: GridPos; v: VConstraint; label: string }> = [
    { pos: [1, 0], v: 'top',        label: 'Pin top' },
    { pos: [1, 1], v: 'center',     label: 'Center vertically' },
    { pos: [1, 2], v: 'bottom',     label: 'Pin bottom' },
  ];

  const cornerLabels: Record<string, string> = {
    '0,0': 'Pin top-left',    '1,0': '',             '2,0': 'Pin top-right',
    '0,1': '',                '1,1': '',             '2,1': '',
    '0,2': 'Pin bottom-left', '1,2': '',             '2,2': 'Pin bottom-right',
  };

  return (
    <>
      <SectionHeader label="Constraints" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '8px 14px 12px' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* 3×3 dot grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 10px)',
                gridTemplateRows: 'repeat(3, 10px)',
                gap: 7,
                position: 'relative',
              }}
            >
              {/* Guide lines inside the grid */}
              <div style={{
                position: 'absolute',
                left: '50%', top: 4, bottom: 4,
                width: 1, background: 'rgba(255,255,255,0.08)',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute',
                top: '50%', left: 4, right: 4,
                height: 1, background: 'rgba(255,255,255,0.08)',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }} />

              {/* Render 9 dots */}
              {[0, 1, 2].flatMap(row =>
                [0, 1, 2].map(col => {
                  const key = `${col},${row}`;
                  const hMatch = hPositions.find(p => p.pos[0] === col && p.pos[1] === row);
                  const vMatch = vPositions.find(p => p.pos[0] === col && p.pos[1] === row);
                  const isActiveH = hMatch ? hConstraint === hMatch.h : false;
                  const isActiveV = vMatch ? vConstraint === vMatch.v : false;
                  const isActive  = isActiveH || isActiveV;
                  const label = hMatch?.label ?? vMatch?.label ?? cornerLabels[key] ?? '';
                  return (
                    <ConstraintDot
                      key={key}
                      active={isActive}
                      label={label}
                      onClick={() => {
                        if (hMatch) applyH(hMatch.h);
                        if (vMatch) applyV(vMatch.v);
                      }}
                    />
                  );
                })
              )}
            </div>

            {/* Text labels for current constraints */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.5rem', color: T.dim, width: 18, flexShrink: 0,
                }}>H</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['left', 'center', 'right', 'left+right', 'scale'] as HConstraint[]).map(c => (
                    <button
                      key={c}
                      onClick={() => applyH(c)}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.5rem',
                        padding: '2px 5px',
                        borderRadius: 3,
                        border: `1px solid ${hConstraint === c ? T.accent : 'rgba(255,255,255,0.12)'}`,
                        background: hConstraint === c ? `${T.accent}22` : 'transparent',
                        color: hConstraint === c ? T.accent : T.dim,
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c === 'left+right' ? '↔' : c === 'scale' ? '%' : c}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.5rem', color: T.dim, width: 18, flexShrink: 0,
                }}>V</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['top', 'center', 'bottom', 'top+bottom', 'scale'] as VConstraint[]).map(c => (
                    <button
                      key={c}
                      onClick={() => applyV(c)}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.5rem',
                        padding: '2px 5px',
                        borderRadius: 3,
                        border: `1px solid ${vConstraint === c ? T.accent : 'rgba(255,255,255,0.12)'}`,
                        background: vConstraint === c ? `${T.accent}22` : 'transparent',
                        color: vConstraint === c ? T.accent : T.dim,
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c === 'top+bottom' ? '↕' : c === 'scale' ? '%' : c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <HSep />
    </>
  );
}
