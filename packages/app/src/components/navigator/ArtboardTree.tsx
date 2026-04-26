'use client';

import { useState } from 'react';
import {
  Tree,
  TreeItem,
  TreeItemLayout,
  type TreeOpenChangeData,
  type TreeOpenChangeEvent,
} from '@fluentui/react-components';
import { SquareRegular, FolderRegular, FolderOpenRegular } from '@fluentui/react-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArtboardNode {
  id: string;
  name: string;
  children?: ArtboardNode[];
}

export interface ArtboardTreeProps {
  nodes: ArtboardNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArtboardTree({ nodes, selectedId, onSelect }: ArtboardTreeProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  function handleOpenChange(_e: TreeOpenChangeEvent, data: TreeOpenChangeData) {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (data.open) next.add(String(data.value));
      else next.delete(String(data.value));
      return next;
    });
  }

  return (
    <Tree
      aria-label="Artboard hierarchy"
      size="small"
      openItems={openItems}
      onOpenChange={handleOpenChange}
      style={{ background: 'transparent', padding: '2px 0' }}
    >
      {nodes.map(node => (
        <ArtboardTreeNode
          key={node.id}
          node={node}
          selectedId={selectedId}
          openItems={openItems}
          onSelect={onSelect}
        />
      ))}
    </Tree>
  );
}

// ── Recursive node ─────────────────────────────────────────────────────────────

function ArtboardTreeNode({
  node,
  selectedId,
  openItems,
  onSelect,
}: {
  node: ArtboardNode;
  selectedId: string | null | undefined;
  openItems: Set<string>;
  onSelect: ((id: string) => void) | undefined;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = openItems.has(node.id);
  const isSelected = selectedId === node.id;

  const icon = hasChildren ? (
    isOpen ? (
      <FolderOpenRegular style={{ fontSize: 13 }} />
    ) : (
      <FolderRegular style={{ fontSize: 13 }} />
    )
  ) : (
    <SquareRegular style={{ fontSize: 11 }} />
  );

  return (
    <TreeItem
      value={node.id}
      itemType={hasChildren ? 'branch' : 'leaf'}
      style={{
        background: isSelected ? 'rgba(51,133,255,0.12)' : undefined,
        borderRadius: 4,
      }}
    >
      <TreeItemLayout
        iconBefore={icon}
        onClick={() => !hasChildren && onSelect?.(node.id)}
        style={{
          fontSize: '0.75rem',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          color: isSelected ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.55)',
          fontWeight: isSelected ? 500 : 400,
          cursor: hasChildren ? 'default' : 'pointer',
        }}
      >
        {node.name}
      </TreeItemLayout>
      {hasChildren &&
        node.children!.map(child => (
          <ArtboardTreeNode
            key={child.id}
            node={child}
            selectedId={selectedId}
            openItems={openItems}
            onSelect={onSelect}
          />
        ))}
    </TreeItem>
  );
}
