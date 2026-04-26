'use client';

import { PatchDiff } from '@pierre/diffs/react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CodeDiffPanelProps {
  /** Unified diff string produced by the diff-engine's generatePatch() */
  patch: string;
  /** Render mode: 'split' shows before/after columns, 'unified' stacks them */
  layout?: 'split' | 'unified';
  className?: string;
  style?: React.CSSProperties;
}

// PatchDiff options — dark theme, Shiki syntax highlighting
// Note: typed 'as const' to avoid widening to BaseDiffOptions (which includes
// 'custom' hunkSeparator that FileDiffOptions excludes).
const DARK_OPTIONS = {
  theme: 'github-dark-dimmed',
  diffIndicators: 'bars',
  disableBackground: false,
  expandUnchanged: false,
  collapsedContextThreshold: 3,
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function CodeDiffPanel({
  patch,
  layout = 'split',
  className,
  style,
}: CodeDiffPanelProps) {
  if (!patch) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.625rem',
          color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.06em',
          background: '#111115',
          ...style,
        }}
      >
        No diff available
      </div>
    );
  }

  const options = {
    ...DARK_OPTIONS,
    diffStyle: layout,
  } as const;

  return (
    <div
      className={className}
      style={{
        overflow: 'auto',
        background: '#111115',
        // Map Fluent 2 neutral surface tokens into @pierre/diffs CSS custom properties
        '--diffs-background': '#111115',
        '--diffs-gutter-background': '#0D0D11',
        '--diffs-addition-background': 'rgba(70,220,120,0.06)',
        '--diffs-deletion-background': 'rgba(255,70,70,0.06)',
        '--diffs-addition-gutter': 'rgba(70,220,120,0.15)',
        '--diffs-deletion-gutter': 'rgba(255,70,70,0.15)',
        ...style,
      } as React.CSSProperties}
    >
      <PatchDiff patch={patch} options={options} />
    </div>
  );
}
