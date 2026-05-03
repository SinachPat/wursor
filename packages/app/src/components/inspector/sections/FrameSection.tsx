'use client';

// ── Frame Section — Position & Size ──────────────────────────────────────────
// Shows X, Y (read-only for static; editable for absolute/fixed), W, H,
// rotation, and corner radius.

import { useState } from 'react';
import { useCanvasTheme } from '@/store/canvasTheme';
import { NumInput, FieldLabel, SectionHeader, HSep } from '../DesignInputs';

// ── Rotation helpers ──────────────────────────────────────────────────────────
// We use the CSS Transforms Level 2 `rotate` property rather than the
// `transform` shorthand. This keeps rotation orthogonal to any
// translateX(-50%) centering applied by the Constraints section.
//
// For display purposes we also try to parse an existing `transform: matrix(…)`
// so pre-existing rotated elements show their angle on first selection.

/** Extract rotation degrees from the CSS `rotate` property or a `matrix()` transform. */
function readRotationDeg(styles: Record<string, string>): string {
  // CSS Transforms Level 2: `rotate: 45deg` — use this if present.
  const rotateProp = styles['rotate'];
  if (rotateProp && rotateProp !== 'none') {
    const m = rotateProp.match(/^(-?[\d.]+)deg$/);
    if (m) return m[1] ?? '0';
  }
  // Fallback: extract angle from a computed matrix(a,b,c,d,tx,ty).
  const transform = styles['transform'];
  if (transform && transform.startsWith('matrix(')) {
    const parts = transform.slice(7, -1).split(',');
    const a = parseFloat(parts[0] ?? '1');
    const b = parseFloat(parts[1] ?? '0');
    const deg = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    return String(deg);
  }
  return '0';
}

interface FrameSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

export function FrameSection({ styles, onPatch }: FrameSectionProps) {
  const T        = useCanvasTheme();
  const [open, setOpen] = useState(true);
  const isPositioned = styles['position'] === 'absolute' || styles['position'] === 'fixed';

  // Corner radius: parse uniform value
  const borderRadius = styles['border-radius'] ?? '0px';

  return (
    <>
      <SectionHeader label="Frame" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {/* X / Y */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>X</FieldLabel>
              <NumInput
                value={styles['left'] ?? '0px'}
                propKey="left"
                onPatch={onPatch}
                inputWidth={80}
                readOnly={!isPositioned}
                {...(!isPositioned && { title: 'Set position: absolute to edit' })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Y</FieldLabel>
              <NumInput
                value={styles['top'] ?? '0px'}
                propKey="top"
                onPatch={onPatch}
                inputWidth={80}
                readOnly={!isPositioned}
                {...(!isPositioned && { title: 'Set position: absolute to edit' })}
              />
            </div>
          </div>

          {/* W / H */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>W</FieldLabel>
              <NumInput value={styles['width'] ?? '0px'} propKey="width" onPatch={onPatch} inputWidth={80} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>H</FieldLabel>
              <NumInput value={styles['height'] ?? '0px'} propKey="height" onPatch={onPatch} inputWidth={80} />
            </div>
          </div>

          {/* Rotation — writes to the `rotate` CSS property (Transforms Level 2)
               so it doesn't clobber translateX(-50%) from Constraints centering. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Rotation °</FieldLabel>
              <NumInput
                value={readRotationDeg(styles) + 'deg'}
                propKey="rotate"
                onPatch={onPatch}
                inputWidth={80}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Radius</FieldLabel>
              <NumInput value={borderRadius} propKey="border-radius" onPatch={onPatch} inputWidth={80} />
            </div>
          </div>

          {/* Overflow / clip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FieldLabel>Overflow</FieldLabel>
            <select
              value={styles['overflow'] ?? 'visible'}
              onChange={e => onPatch('overflow', e.target.value)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.5875rem',
                background: T.bgDeep,
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                color: T.fg,
                padding: '3px 5px',
                outline: 'none',
              }}
            >
              <option value="visible">visible</option>
              <option value="hidden">hidden</option>
              <option value="auto">auto</option>
              <option value="scroll">scroll</option>
            </select>
          </div>
        </div>
      )}
      <HSep />
    </>
  );
}
