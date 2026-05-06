'use client';

// ── Typography Section ────────────────────────────────────────────────────────
// Shown only when the element has direct text content (hasDirectText === true).
// Includes font family, size, weight, line height, letter spacing, paragraph
// spacing (when hasParagraphChildren), text-align, decoration, transform, color.

import { useState } from 'react';
import { NumInput, TextInput, FieldLabel, SectionHeader, CssSelect, ColorInput, IconToggleGroup, HSep } from '../DesignInputs';

interface TypographySectionProps {
  styles: Record<string, string>;
  hasDirectText: boolean;
  hasParagraphChildren: boolean;
  /** Fires PATCH_ELEMENT_STYLE for normal properties */
  onPatch: (prop: string, val: string) => void;
  /** Fires PATCH_CHILDREN_STYLE for paragraph-spacing */
  onPatchChildren: (selector: string, prop: string, val: string) => void;
}

export function TypographySection({
  styles,
  hasDirectText,
  hasParagraphChildren,
  onPatch,
  onPatchChildren,
}: TypographySectionProps) {
  const [open, setOpen] = useState(true);

  // Only show this section when the element has direct text content
  if (!hasDirectText) return null;

  return (
    <>
      <SectionHeader label="Typography" expanded={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {/* Font family */}
          <div style={{ marginBottom: 6 }}>
            <FieldLabel>Family</FieldLabel>
            <TextInput
              value={styles['font-family'] ?? ''}
              propKey="font-family"
              onPatch={onPatch}
              fullWidth
            />
          </div>

          {/* Size / Weight / Line height */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 6px', marginBottom: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Size</FieldLabel>
              <NumInput value={styles['font-size'] ?? '14px'} propKey="font-size" onPatch={onPatch} tokenAware />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Weight</FieldLabel>
              <NumInput value={styles['font-weight'] ?? '400'} propKey="font-weight" onPatch={onPatch} tokenAware />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Line H</FieldLabel>
              <NumInput value={styles['line-height'] ?? 'normal'} propKey="line-height" onPatch={onPatch} tokenAware />
            </div>
          </div>

          {/* Letter spacing + text align */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Tracking</FieldLabel>
              <NumInput value={styles['letter-spacing'] ?? '0px'} propKey="letter-spacing" onPatch={onPatch} inputWidth={52} />
            </div>
            <IconToggleGroup
              value={styles['text-align'] ?? 'left'}
              options={[
                { val: 'left',    icon: 'L', title: 'Left'    },
                { val: 'center',  icon: 'C', title: 'Center'  },
                { val: 'right',   icon: 'R', title: 'Right'   },
                { val: 'justify', icon: 'J', title: 'Justify' },
              ]}
              onPatch={v => onPatch('text-align', v)}
            />
          </div>

          {/* Color */}
          <div style={{ marginBottom: 6 }}>
            <FieldLabel>Color</FieldLabel>
            <ColorInput value={styles['color'] ?? '#000000'} propKey="color" onPatch={onPatch} tokenAware />
          </div>

          {/* Decoration + Transform */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Decoration</FieldLabel>
              <CssSelect
                value={styles['text-decoration'] ?? 'none'}
                propKey="text-decoration"
                options={[
                  { val: 'none',         label: 'None'          },
                  { val: 'underline',    label: 'Underline'     },
                  { val: 'line-through', label: 'Strikethrough' },
                  { val: 'overline',     label: 'Overline'      },
                ]}
                onPatch={onPatch}
              />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Transform</FieldLabel>
              <CssSelect
                value={styles['text-transform'] ?? 'none'}
                propKey="text-transform"
                options={[
                  { val: 'none',       label: 'None'       },
                  { val: 'uppercase',  label: 'Uppercase'  },
                  { val: 'lowercase',  label: 'Lowercase'  },
                  { val: 'capitalize', label: 'Capitalize' },
                ]}
                onPatch={onPatch}
              />
            </div>
          </div>

          {/* Paragraph spacing — only when <p> children exist */}
          {hasParagraphChildren && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FieldLabel>Paragraph spacing (applies to &lt;p&gt; children)</FieldLabel>
              <NumInput
                value={styles['margin-bottom'] ?? '0px'}
                propKey="p-margin-bottom"
                onPatch={(_, val) => onPatchChildren('p', 'margin-bottom', val)}
                inputWidth={72}
              />
            </div>
          )}
        </div>
      )}
      <HSep />
    </>
  );
}
