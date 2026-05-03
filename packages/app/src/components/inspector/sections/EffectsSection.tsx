'use client';

// ── Effects Section — Box Shadow & Filters ────────────────────────────────────
// Surfaces box-shadow (drop shadow / inner shadow), filter: blur, backdrop-filter.

import { useState } from 'react';
import { NumInput, ColorInput, FieldLabel, SectionHeader, HSep } from '../DesignInputs';
import { useCanvasTheme } from '@/store/canvasTheme';

// ── Filter helpers ────────────────────────────────────────────────────────────
// BUG-9 fix: naive .replace('blur(','') breaks for multi-function filter
// strings like "brightness(1.1) blur(4px)". Use regex-based extraction and
// surgical replacement instead.

/** Extract the numeric argument of blur() from a CSS filter string. */
function extractBlurValue(filter: string): string {
  const m = filter.match(/\bblur\(([\d.]+[a-z%]*)\)/);
  return m?.[1] ?? '0px';
}

/** Replace (or insert) the blur() function in a filter string, preserving others. */
function patchBlurInFilter(filter: string, newVal: string): string {
  const fn = `blur(${newVal})`;
  if (!filter || filter === 'none') return fn;
  if (/\bblur\(/.test(filter)) return filter.replace(/\bblur\([^)]*\)/, fn);
  return `${filter} ${fn}`;
}

interface EffectsSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

export function EffectsSection({ styles, onPatch }: EffectsSectionProps) {
  const T = useCanvasTheme();
  const [open, setOpen] = useState(false);

  const boxShadow      = styles['box-shadow'] ?? '';
  const filterBlur     = styles['filter'] ?? '';
  const backdropBlur   = styles['backdrop-filter'] ?? '';

  const hasEffect = boxShadow && boxShadow !== 'none'
    || filterBlur && filterBlur !== 'none'
    || backdropBlur && backdropBlur !== 'none';

  return (
    <>
      <SectionHeader label="Effects" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {/* Box shadow display */}
          {boxShadow && boxShadow !== 'none' ? (
            <div style={{ marginBottom: 8 }}>
              <FieldLabel>Shadow</FieldLabel>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.5rem',
                  color: T.fgMuted,
                  background: T.bgDeep,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  padding: '4px 6px',
                  wordBreak: 'break-all',
                }}
              >
                {boxShadow}
              </div>
              <button
                onClick={() => onPatch('box-shadow', 'none')}
                style={{
                  marginTop: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,80,80,0.7)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Remove shadow
              </button>
            </div>
          ) : (
            <button
              onClick={() => onPatch('box-shadow', '0 2px 8px rgba(0,0,0,0.3)')}
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
                marginBottom: 8,
              }}
            >
              + Add shadow
            </button>
          )}

          {/* Layer blur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FieldLabel>Layer blur</FieldLabel>
            <NumInput
              value={extractBlurValue(filterBlur)}
              propKey="filter"
              onPatch={(_, v) => onPatch('filter', patchBlurInFilter(filterBlur, v))}
              inputWidth={52}
            />
          </div>

          {/* Background blur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FieldLabel>BG blur</FieldLabel>
            <NumInput
              value={extractBlurValue(backdropBlur)}
              propKey="backdrop-filter"
              onPatch={(_, v) => onPatch('backdrop-filter', patchBlurInFilter(backdropBlur, v))}
              inputWidth={52}
            />
          </div>
        </div>
      )}
      <HSep />
    </>
  );
}
