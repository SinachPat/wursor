'use client';

import { useState } from 'react';
import { useFileTree, FileTree } from '@pierre/trees/react';
import { themeToTreeStyles } from '@pierre/trees';
import { SquareRegular } from '@fluentui/react-icons';
import { useCanvas } from '@/store/canvas';
import { useArtboards } from '@/hooks/useArtboards';

const T = {
  bg:      '#111115',
  border:  'rgba(255,255,255,0.055)',
  item:    'rgba(255,255,255,0.42)',
  itemHov: 'rgba(255,255,255,0.72)',
  selBg:   'rgba(51,133,255,0.12)',
  selFg:   'rgba(255,255,255,0.88)',
  accent:  '#3385FF',
  dim:     'rgba(255,255,255,0.22)',
  sep:     'rgba(255,255,255,0.04)',
};

// Map the panel's dark theme into Trees' CSS custom properties
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

export function ArtboardNavigator() {
  const { selectedArtboardId, selectArtboard, workspaceId, projectId } = useCanvas();
  const { artboards, rawArtboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);

  // Build file tree paths from artboard names (strip .tsx suffix if present, else use name as path)
  const filePaths = rawArtboards.length > 0
    ? rawArtboards.map((ab) => `artboards/${ab.name}`)
    : ['artboards/(no artboards yet)'];

  const { model } = useFileTree({
    paths: filePaths,
    initialExpansion: 2,
    density: 'compact',
    icons: 'minimal',
  });

  return (
    <div
      style={{
        gridColumn: 1,
        gridRow: 2,
        background: T.bg,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      {/* ── Artboards ── */}
      <SectionLabel>Artboards</SectionLabel>
      <div style={{ padding: '2px 6px 0' }}>
        {artboards.map((ab) => {
          const sel = selectedArtboardId === ab.id;
          return (
            <NavRow
              key={ab.id}
              selected={sel}
              onClick={() => selectArtboard(ab.id)}
              icon={
                <SquareRegular
                  style={{ fontSize: 11, color: sel ? T.accent : 'rgba(255,255,255,0.2)', flexShrink: 0 }}
                />
              }
              label={ab.label}
              after={sel && <ActiveDot />}
            />
          );
        })}
      </div>

      <HSep />

      {/* ── Files — @pierre/trees ── */}
      <SectionLabel>Files</SectionLabel>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <FileTree
          model={model}
          style={{
            ...treeThemeStyles,
            height: '100%',
            width: '100%',
            // Fine-tune item sizing to match our panel density
            '--trees-item-height': '26px',
            '--trees-indent-width': '14px',
          } as React.CSSProperties}
        />
      </div>

      <HSep />

      {/* ── Graph stats ── */}
      <SectionLabel>Graph</SectionLabel>
      <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <GraphStat label="artboards"  value={String(rawArtboards.length || artboards.length)} color={T.accent} />
        <GraphStat label="components" value="—"  color="rgba(255,255,255,0.45)" />
        <GraphStat label="tokens"     value="—"  color="rgba(255,255,255,0.45)" />
      </div>
    </div>
  );
}

/* ── Artboard row ─────────────────────────────────────────── */
function NavRow({
  selected = false,
  onClick,
  icon,
  label,
  after,
}: {
  selected?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  after?: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 10px',
        borderRadius: 5,
        cursor: 'pointer',
        background: selected ? T.selBg : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        color:      selected ? T.selFg : hov ? T.itemHov : T.item,
        fontSize: '0.75rem',
        letterSpacing: '-0.01em',
        fontWeight: selected ? 500 : 400,
        userSelect: 'none',
        marginBottom: 1,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {after}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      padding: '12px 12px 5px',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: '0.5625rem',
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: T.dim,
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function HSep() {
  return <div style={{ height: 1, background: T.sep, margin: '6px 0', flexShrink: 0 }} />;
}

function ActiveDot() {
  return (
    <span style={{
      marginLeft: 'auto',
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: T.accent,
      flexShrink: 0,
      display: 'block',
    }} />
  );
}

function GraphStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: 'rgba(255,255,255,0.28)' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
