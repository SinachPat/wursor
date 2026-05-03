'use client';

// ── Fill Section — Background Color & Opacity ─────────────────────────────────
// Shows fill color, opacity, and a "no fill" empty state.

import { useState } from 'react';
import { isTransparent, ColorInput, NumInput, FieldLabel, SectionHeader, HSep } from '../DesignInputs';

interface FillSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

export function FillSection({ styles, onPatch }: FillSectionProps) {
  const [open, setOpen] = useState(true);
  const bg = styles['background-color'] ?? '';

  return (
    <>
      <SectionHeader label="Fill" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {isTransparent(bg) ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onPatch('background-color', '#ffffff')}
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
                + Add fill
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ColorInput value={bg} propKey="background-color" onPatch={onPatch} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <FieldLabel>Opacity</FieldLabel>
                <NumInput
                  value={styles['opacity'] !== undefined ? `${Math.round(parseFloat(styles['opacity'] ?? '1') * 100)}%` : '100%'}
                  propKey="_opacity"
                  onPatch={(_, v) => {
                    const pct = parseFloat(v.replace('%', ''));
                    if (!isNaN(pct)) onPatch('opacity', String(Math.min(1, Math.max(0, pct / 100))));
                  }}
                  inputWidth={44}
                />
              </div>
            </div>
          )}
        </div>
      )}
      <HSep />
    </>
  );
}
