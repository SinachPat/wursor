'use client';

import {
  Tree,
  TreeItem,
  TreeItemLayout,
} from '@fluentui/react-components';
import {
  SquareRegular,
  DocumentRegular,
  FolderRegular,
  FolderOpenRegular,
} from '@fluentui/react-icons';
import { useCanvas } from '@/store/canvas';

const ARTBOARDS = [
  { id: 'dashboard-card', label: 'DashboardCard' },
  { id: 'user-profile',   label: 'UserProfile'   },
  { id: 'nav-sidebar',    label: 'NavSidebar'    },
  { id: 'data-table',     label: 'DataTable'     },
];

// Dark panel tokens
const T = {
  bg:       '#111115',
  border:   'rgba(255,255,255,0.055)',
  label:    'rgba(255,255,255,0.22)',
  item:     'rgba(255,255,255,0.42)',
  itemHov:  'rgba(255,255,255,0.72)',
  selBg:    'rgba(51,133,255,0.12)',
  selFg:    'rgba(255,255,255,0.88)',
  accent:   '#3385FF',
  sep:      'rgba(255,255,255,0.04)',
};

export function ArtboardNavigator() {
  const { selectedArtboardId, selectArtboard } = useCanvas();

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
      {/* Artboards section */}
      <SectionLabel icon="⬜">Artboards</SectionLabel>
      <div style={{ padding: '2px 6px 0' }}>
        {ARTBOARDS.map((ab) => (
          <div
            key={ab.id}
            onClick={() => selectArtboard(ab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 5,
              cursor: 'pointer',
              background: selectedArtboardId === ab.id ? T.selBg : 'transparent',
              color: selectedArtboardId === ab.id ? T.selFg : T.item,
              fontSize: '0.75rem',
              letterSpacing: '-0.01em',
              fontWeight: selectedArtboardId === ab.id ? 500 : 400,
              transition: 'background 0.1s, color 0.1s',
              userSelect: 'none',
              marginBottom: 1,
            }}
            onMouseEnter={e => {
              if (selectedArtboardId !== ab.id) {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLDivElement).style.color = T.itemHov;
              }
            }}
            onMouseLeave={e => {
              if (selectedArtboardId !== ab.id) {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                (e.currentTarget as HTMLDivElement).style.color = T.item;
              }
            }}
          >
            <SquareRegular
              style={{
                fontSize: 11,
                color: selectedArtboardId === ab.id ? T.accent : 'rgba(255,255,255,0.25)',
                flexShrink: 0,
              }}
            />
            {ab.label}
            {selectedArtboardId === ab.id && (
              <span
                style={{
                  marginLeft: 'auto',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: T.accent,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <HSep />

      {/* Files section */}
      <SectionLabel icon="📁">Files</SectionLabel>
      <Tree
        aria-label="Codebase"
        size="small"
        style={{ padding: '2px 6px' }}
      >
        <TreeItem
          itemType="branch"
          value="src"
          style={{ color: T.item }}
        >
          <TreeItemLayout
            iconBefore={<FolderOpenRegular style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} />}
            style={{ fontSize: '0.75rem', color: T.item, padding: '4px 4px' }}
          >
            src
          </TreeItemLayout>
          <Tree>
            <TreeItem itemType="branch" value="components">
              <TreeItemLayout
                iconBefore={<FolderRegular style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }} />}
                style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', padding: '4px 4px' }}
              >
                components
              </TreeItemLayout>
              <Tree>
                {ARTBOARDS.map((ab) => (
                  <TreeItem key={ab.id} itemType="leaf" value={`file-${ab.id}`}>
                    <TreeItemLayout
                      iconBefore={<DocumentRegular style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }} />}
                      style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)', padding: '3px 4px' }}
                    >
                      {ab.label}.tsx
                    </TreeItemLayout>
                  </TreeItem>
                ))}
              </Tree>
            </TreeItem>
            <TreeItem itemType="leaf" value="app-page">
              <TreeItemLayout
                iconBefore={<DocumentRegular style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }} />}
                style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)', padding: '3px 4px' }}
              >
                page.tsx
              </TreeItemLayout>
            </TreeItem>
          </Tree>
        </TreeItem>
      </Tree>

      <HSep />

      {/* Graph nodes indicator */}
      <SectionLabel icon="◉">Graph</SectionLabel>
      <div
        style={{
          padding: '4px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <GraphStat label="nodes" value="284" color="#3385FF" />
        <GraphStat label="components" value="47" color="rgba(255,255,255,0.45)" />
        <GraphStat label="tokens" value="112" color="rgba(255,255,255,0.45)" />
      </div>
    </div>
  );
}

function SectionLabel({ children, icon }: { children: string; icon: string }) {
  return (
    <div
      style={{
        padding: '12px 12px 5px',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: '0.5625rem',
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.22)',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}

function HSep() {
  return (
    <div
      style={{
        height: 1,
        background: 'rgba(255,255,255,0.04)',
        margin: '8px 0',
        flexShrink: 0,
      }}
    />
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
