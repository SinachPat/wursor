'use client';

// ── Layout Section — Display / Flex / Grid / Padding ─────────────────────────
// Adapts to the element's display mode: block (collapsed), flex, grid.

import { useState, useEffect, useRef } from 'react';
import { NumInput, TextInput, FieldLabel, SectionHeader, CssSelect, IconToggleGroup, HSep } from '../DesignInputs';

interface LayoutSectionProps {
  styles: Record<string, string>;
  onPatch: (prop: string, val: string) => void;
}

export function LayoutSection({ styles, onPatch }: LayoutSectionProps) {
  const display = styles['display'] ?? 'block';
  // BUG-20 fix: useState only runs its initialiser once. When the user selects
  // a different component the `display` prop changes but `open` would stay
  // stale. We sync it on display changes while preserving explicit user
  // toggles: if display changes (new component selected), auto-open for
  // flex/grid, auto-close for block.
  const [open, setOpen] = useState(display === 'flex' || display === 'grid' || display === 'inline-flex');
  const prevDisplayRef = useRef(display);
  useEffect(() => {
    if (prevDisplayRef.current !== display) {
      prevDisplayRef.current = display;
      setOpen(display === 'flex' || display === 'grid' || display === 'inline-flex' || display === 'inline-grid');
    }
  }, [display]);

  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid' || display === 'inline-grid';

  return (
    <>
      <SectionHeader label="Layout" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {/* Display mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <FieldLabel>Display</FieldLabel>
            <CssSelect
              value={display}
              propKey="display"
              options={[
                { val: 'block',        label: 'block'        },
                { val: 'flex',         label: 'flex'         },
                { val: 'inline-flex',  label: 'inline-flex'  },
                { val: 'grid',         label: 'grid'         },
                { val: 'inline-grid',  label: 'inline-grid'  },
                { val: 'inline-block', label: 'inline-block' },
                { val: 'inline',       label: 'inline'       },
                { val: 'none',         label: 'none'         },
              ]}
              onPatch={onPatch}
            />
          </div>

          {/* Flex-specific controls */}
          {isFlex && (
            <>
              {/* Direction + Wrap */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Direction</FieldLabel>
                <IconToggleGroup
                  value={styles['flex-direction'] ?? 'row'}
                  options={[
                    { val: 'row',            icon: '→', title: 'Row'            },
                    { val: 'column',         icon: '↓', title: 'Column'         },
                    { val: 'row-reverse',    icon: '←', title: 'Row reverse'    },
                    { val: 'column-reverse', icon: '↑', title: 'Column reverse' },
                  ]}
                  onPatch={v => onPatch('flex-direction', v)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Wrap</FieldLabel>
                <IconToggleGroup
                  value={styles['flex-wrap'] ?? 'nowrap'}
                  options={[
                    { val: 'nowrap', icon: '⟷', title: 'No wrap' },
                    { val: 'wrap',   icon: '↩', title: 'Wrap'    },
                  ]}
                  onPatch={v => onPatch('flex-wrap', v)}
                />
              </div>

              {/* Align items */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Align</FieldLabel>
                <CssSelect
                  value={styles['align-items'] ?? 'stretch'}
                  propKey="align-items"
                  options={[
                    { val: 'flex-start', label: 'start'    },
                    { val: 'center',     label: 'center'   },
                    { val: 'flex-end',   label: 'end'      },
                    { val: 'stretch',    label: 'stretch'  },
                    { val: 'baseline',   label: 'baseline' },
                  ]}
                  onPatch={onPatch}
                />
              </div>

              {/* Justify content */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Justify</FieldLabel>
                <CssSelect
                  value={styles['justify-content'] ?? 'flex-start'}
                  propKey="justify-content"
                  options={[
                    { val: 'flex-start',    label: 'start'   },
                    { val: 'center',        label: 'center'  },
                    { val: 'flex-end',      label: 'end'     },
                    { val: 'space-between', label: 'between' },
                    { val: 'space-around',  label: 'around'  },
                    { val: 'space-evenly',  label: 'evenly'  },
                  ]}
                  onPatch={onPatch}
                />
              </div>

              {/* Gap */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Gap</FieldLabel>
                <NumInput value={styles['gap'] ?? '0px'} propKey="gap" onPatch={onPatch} inputWidth={60} />
              </div>
            </>
          )}

          {/* Grid-specific controls */}
          {isGrid && (
            <>
              <div style={{ marginBottom: 6 }}>
                <FieldLabel>Columns</FieldLabel>
                <TextInput value={styles['grid-template-columns'] ?? ''} propKey="grid-template-columns" onPatch={onPatch} fullWidth placeholder="1fr 1fr" />
              </div>
              <div style={{ marginBottom: 6 }}>
                <FieldLabel>Rows</FieldLabel>
                <TextInput value={styles['grid-template-rows'] ?? ''} propKey="grid-template-rows" onPatch={onPatch} fullWidth placeholder="auto" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Col gap</FieldLabel>
                <NumInput value={styles['column-gap'] ?? '0px'} propKey="column-gap" onPatch={onPatch} inputWidth={60} />
                <FieldLabel>Row gap</FieldLabel>
                <NumInput value={styles['row-gap'] ?? '0px'} propKey="row-gap" onPatch={onPatch} inputWidth={60} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <FieldLabel>Align</FieldLabel>
                <CssSelect
                  value={styles['align-items'] ?? 'stretch'}
                  propKey="align-items"
                  options={[
                    { val: 'flex-start', label: 'start'   },
                    { val: 'center',     label: 'center'  },
                    { val: 'flex-end',   label: 'end'     },
                    { val: 'stretch',    label: 'stretch' },
                  ]}
                  onPatch={onPatch}
                />
              </div>
            </>
          )}

          {/* Padding (always shown) */}
          <div style={{ marginTop: 8 }}>
            <FieldLabel>Padding</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 6px', marginTop: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FieldLabel>Top</FieldLabel>
                <NumInput value={styles['padding-top'] ?? '0px'} propKey="padding-top" onPatch={onPatch} inputWidth={72} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FieldLabel>Right</FieldLabel>
                <NumInput value={styles['padding-right'] ?? '0px'} propKey="padding-right" onPatch={onPatch} inputWidth={72} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FieldLabel>Bottom</FieldLabel>
                <NumInput value={styles['padding-bottom'] ?? '0px'} propKey="padding-bottom" onPatch={onPatch} inputWidth={72} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FieldLabel>Left</FieldLabel>
                <NumInput value={styles['padding-left'] ?? '0px'} propKey="padding-left" onPatch={onPatch} inputWidth={72} />
              </div>
            </div>
          </div>
        </div>
      )}
      <HSep />
    </>
  );
}
