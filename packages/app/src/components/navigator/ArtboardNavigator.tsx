'use client';

import {
  Tree,
  TreeItem,
  TreeItemLayout,
  Text,
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
  { id: 'user-profile',   label: 'UserProfile' },
  { id: 'nav-sidebar',    label: 'NavSidebar' },
  { id: 'data-table',     label: 'DataTable' },
];

export function ArtboardNavigator() {
  const { selectedArtboardId, selectArtboard } = useCanvas();

  return (
    <div
      style={{
        gridColumn: 1,
        gridRow: 2,
        background: '#fafafa',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Artboards section */}
      <SectionLabel>Artboards</SectionLabel>
      <Tree aria-label="Artboards" size="small" style={{ padding: '0 4px' }}>
        {ARTBOARDS.map((ab) => (
          <TreeItem
            key={ab.id}
            itemType="leaf"
            value={ab.id}
            style={{
              background: selectedArtboardId === ab.id ? 'rgba(15,82,186,0.08)' : undefined,
              borderRadius: 4,
            }}
            onClick={() => selectArtboard(ab.id)}
          >
            <TreeItemLayout iconBefore={<SquareRegular style={{ color: '#0F52BA', fontSize: 12 }} />}>
              <Text size={200}>{ab.label}</Text>
            </TreeItemLayout>
          </TreeItem>
        ))}
      </Tree>

      <Divider />

      {/* Codebase section */}
      <SectionLabel>Files</SectionLabel>
      <Tree aria-label="Codebase" size="small" style={{ padding: '0 4px' }}>
        <TreeItem itemType="branch" value="src">
          <TreeItemLayout iconBefore={<FolderOpenRegular style={{ fontSize: 12 }} />}>
            <Text size={200}>src</Text>
          </TreeItemLayout>
          <Tree>
            <TreeItem itemType="branch" value="components">
              <TreeItemLayout iconBefore={<FolderRegular style={{ fontSize: 12 }} />}>
                <Text size={200}>components</Text>
              </TreeItemLayout>
              <Tree>
                {ARTBOARDS.map((ab) => (
                  <TreeItem key={ab.id} itemType="leaf" value={`file-${ab.id}`}>
                    <TreeItemLayout iconBefore={<DocumentRegular style={{ fontSize: 12 }} />}>
                      <Text size={200} style={{ color: 'rgba(0,0,0,0.55)' }}>
                        {ab.label}.tsx
                      </Text>
                    </TreeItemLayout>
                  </TreeItem>
                ))}
              </Tree>
            </TreeItem>
            <TreeItem itemType="leaf" value="app-page">
              <TreeItemLayout iconBefore={<DocumentRegular style={{ fontSize: 12 }} />}>
                <Text size={200} style={{ color: 'rgba(0,0,0,0.55)' }}>page.tsx</Text>
              </TreeItemLayout>
            </TreeItem>
          </Tree>
        </TreeItem>
      </Tree>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: '10px 12px 4px',
        fontSize: '0.625rem',
        fontFamily: 'monospace',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.35)',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '6px 0' }} />;
}
