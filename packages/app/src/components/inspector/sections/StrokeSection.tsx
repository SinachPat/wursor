'use client';

// ── Stroke Section — Border ────────────────────────────────────────────────────

import { useState } from 'react';
import { ColorInput, NumInput, FieldLabel, SectionHeader, CssSelect, HSep } from '../DesignInputs';

interface StrokeSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

export function StrokeSection({ styles, onPatch }: StrokeSectionProps) {
  const [open, setOpen] = useState(false);
  // M-3 fix: getComputedStyle returns `border-width` as a 4-value shorthand
  // (e.g., "0px 0px 0px 0px" or "1px 1px 1px 1px"), not a single value.
  // Read the more reliable `border-top-width` longhand for the presence check,
  // and display the top width (uniform borders are by far the common case).
  const bw = styles['border-top-width'] ?? styles['border-width'] ?? '0px';
  // A border exists when any individual side width is non-zero.
  const hasBorder = bw !== '' && bw !== '0px' && !bw.split(' ').every(v => v === '0px' || v === '0');

  return (
    <>
      <SectionHeader label="Stroke" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {!hasBorder ? (
            <button
              onClick={() => { onPatch('border-width', '1px'); onPatch('border-style', 'solid'); onPatch('border-color', 'rgba(0,0,0,1)'); }}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.5rem',
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 4,
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              + Add stroke
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ColorInput value={styles['border-color'] ?? ''} propKey="border-color" onPatch={onPatch} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FieldLabel>Width</FieldLabel>
                  <NumInput value={bw} propKey="border-width" onPatch={onPatch} inputWidth={72} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FieldLabel>Style</FieldLabel>
                  <CssSelect
                    value={styles['border-style'] ?? 'solid'}
                    propKey="border-style"
                    options={[
                      { val: 'solid',  label: 'Solid'  },
                      { val: 'dashed', label: 'Dashed' },
                      { val: 'dotted', label: 'Dotted' },
                      { val: 'none',   label: 'None'   },
                    ]}
                    onPatch={onPatch}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <HSep />
    </>
  );
}
