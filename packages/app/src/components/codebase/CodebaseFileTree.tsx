'use client';

import { useFileTree, FileTree } from '@pierre/trees/react';
import { themeToTreeStyles } from '@pierre/trees';
import type { GitStatusEntry } from '@pierre/trees';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CodebaseFileTreeProps {
  /** Flat list of file paths, relative to repo root */
  paths: string[];
  /** Array of git status entries (matches @pierre/trees FileTreeOptions.gitStatus) */
  gitStatus?: readonly GitStatusEntry[];
  /** Initial directory expansion depth (default: 1) */
  initialExpansion?: number;
  /** Collapse single-child directory chains (default: true) */
  flattenEmptyDirectories?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Dark panel tokens — match ArtboardNavigator palette
const treeThemeStyles = themeToTreeStyles({
  type: 'dark',
  bg: '#111115',
  fg: 'rgba(255,255,255,0.42)',
  colors: {
    'editor.selectionBackground':       'rgba(51,133,255,0.14)',
    'list.activeSelectionBackground':   'rgba(51,133,255,0.14)',
    'list.inactiveSelectionBackground': 'rgba(51,133,255,0.08)',
    'list.hoverBackground':             'rgba(255,255,255,0.04)',
    'list.activeSelectionForeground':   'rgba(255,255,255,0.88)',
    'editorIndentGuide.background':     'rgba(255,255,255,0.04)',
  },
});

// ── Component ─────────────────────────────────────────────────────────────────

export function CodebaseFileTree({
  paths,
  gitStatus,
  initialExpansion = 1,
  flattenEmptyDirectories = true,
  className,
  style,
}: CodebaseFileTreeProps) {
  const { model } = useFileTree({
    paths,
    ...(gitStatus !== undefined ? { gitStatus } : {}),
    initialExpansion,
    flattenEmptyDirectories,
    density: 'compact',
    icons: 'minimal',
    fileTreeSearchMode: 'expand-matches',
  });

  return (
    <div
      className={className}
      style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        background: '#111115',
        ...style,
      }}
    >
      <FileTree
        model={model}
        style={{
          ...treeThemeStyles,
          height: '100%',
          width: '100%',
          '--trees-item-height': '26px',
          '--trees-indent-width': '14px',
        } as React.CSSProperties}
      />
    </div>
  );
}
