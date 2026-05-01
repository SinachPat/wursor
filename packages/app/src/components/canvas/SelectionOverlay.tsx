'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useHistory } from '@/store/history';
import { useCanvas } from '@/store/canvas';
import type { FiberNode, DOMRectLike } from '@originmain/renderer';
import type { PropChange } from '@originmain/diff-engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectionState {
  nodeId: string;
  nodeName: string;
  rect: DOMRectLike;
}

export interface SelectionOverlayProps {
  artboardId: string;
  /** Fiber tree from the live renderer (if connected) */
  fiberRoot?: FiberNode;
  /** Width and height must match the artboard frame exactly */
  width: number;
  height: number;
  onSelectionChange?: (selection: SelectionState | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SelectionOverlay({
  artboardId,
  fiberRoot,
  width,
  height,
  onSelectionChange,
}: SelectionOverlayProps) {
  const [selected, setSelected] = useState<SelectionState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pushEdit = useHistory(s => s.pushEdit);
  const { dispatchRemoveElement } = useCanvas();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!fiberRoot) {
        setSelected(null);
        onSelectionChange?.(null);
        return;
      }

      const overlayRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const clickX = e.clientX - overlayRect.left;
      const clickY = e.clientY - overlayRect.top;

      const hit = hitTestFiber(fiberRoot, clickX, clickY);
      if (hit) {
        const sel: SelectionState = { nodeId: hit.id, nodeName: hit.name, rect: hit.domRect! };
        setSelected(sel);
        onSelectionChange?.(sel);
      } else {
        setSelected(null);
        onSelectionChange?.(null);
      }
    },
    [fiberRoot, onSelectionChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!fiberRoot) return;
      const overlayRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - overlayRect.left;
      const y = e.clientY - overlayRect.top;
      const hit = hitTestFiber(fiberRoot, x, y);
      setHoveredId(hit?.id ?? null);
    },
    [fiberRoot]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
        onSelectionChange?.(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        dispatchRemoveElement(artboardId, selected.nodeId);
        setSelected(null);
        onSelectionChange?.(null);
      }
    },
    [onSelectionChange, selected, artboardId, dispatchRemoveElement]
  );

  return (
    <div
      role="presentation"
      tabIndex={-1}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredId(null)}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        zIndex: 5,
        cursor: 'default',
        outline: 'none',
      }}
    >
      {hoveredId && hoveredId !== selected?.nodeId && fiberRoot && (
        <HoverHighlight fiberRoot={fiberRoot} nodeId={hoveredId} />
      )}

      {selected && (
        <SelectionHandles
          artboardId={artboardId}
          selection={selected}
          onSelectionChange={(s) => { setSelected(s); onSelectionChange?.(s); }}
          onResizeCommit={(changes) => {
            pushEdit(artboardId, {
              componentId: selected.nodeId,
              componentName: selected.nodeName,
              changes,
              timestamp: Date.now(),
            });
          }}
        />
      )}
    </div>
  );
}

// ── Hover highlight ───────────────────────────────────────────────────────────

function HoverHighlight({ fiberRoot, nodeId }: { fiberRoot: FiberNode; nodeId: string }) {
  const node = findNode(fiberRoot, nodeId);
  if (!node?.domRect) return null;
  const { x, y, width, height } = node.domRect;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: '1.5px solid rgba(51,133,255,0.5)',
        borderRadius: 2,
        background: 'rgba(51,133,255,0.04)',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Selection handles ─────────────────────────────────────────────────────────

interface SelectionHandlesProps {
  artboardId: string;
  selection: SelectionState;
  onSelectionChange: (s: SelectionState | null) => void;
  onResizeCommit: (changes: PropChange[]) => void;
}

function SelectionHandles({ artboardId, selection, onSelectionChange, onResizeCommit }: SelectionHandlesProps) {
  const { rect, nodeName, nodeId } = selection;
  const startRect = useRef<DOMRectLike | null>(null);
  const liveRectRef = useRef<DOMRectLike>(rect);
  const [liveRect, setLiveRect] = useState(rect);
  const onResizeCommitRef = useRef(onResizeCommit);
  useEffect(() => { onResizeCommitRef.current = onResizeCommit; });

  const { patchStyleEdit, dispatchRemoveElement } = useCanvas();

  // Sync rect when selection changes to a different element
  useEffect(() => {
    liveRectRef.current = rect;
    setLiveRect(rect);
  }, [rect]);

  const dragListenersRef = useRef<{
    move: (e: MouseEvent) => void;
    up: (e: MouseEvent) => void;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        window.removeEventListener('mousemove', dragListenersRef.current.move);
        window.removeEventListener('mouseup', dragListenersRef.current.up);
        dragListenersRef.current = null;
      }
    };
  }, []);

  const makeResizeHandle = useCallback(
    (corner: 'tl' | 'tr' | 'bl' | 'br') =>
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        startRect.current = { ...liveRectRef.current };
        const startX = e.clientX;
        const startY = e.clientY;

        const onMouseMove = (ev: MouseEvent) => {
          if (!startRect.current) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          const next = adjustRect(startRect.current, corner, dx, dy);
          liveRectRef.current = next;
          setLiveRect(next);

          // Live patch into iframe for instant visual feedback
          patchStyleEdit(artboardId, nodeId, 'width',  `${Math.round(next.width)}px`);
          patchStyleEdit(artboardId, nodeId, 'height', `${Math.round(next.height)}px`);
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          dragListenersRef.current = null;

          if (!startRect.current) return;
          const widthChange  = liveRectRef.current.width  - startRect.current.width;
          const heightChange = liveRectRef.current.height - startRect.current.height;

          const changes: PropChange[] = [];
          if (Math.abs(widthChange) > 0.5) {
            changes.push({ key: 'width',  before: startRect.current.width,  after: liveRectRef.current.width,  changeType: 'modified' });
          }
          if (Math.abs(heightChange) > 0.5) {
            changes.push({ key: 'height', before: startRect.current.height, after: liveRectRef.current.height, changeType: 'modified' });
          }
          if (changes.length > 0) onResizeCommitRef.current(changes);
          startRect.current = null;
        };

        dragListenersRef.current = { move: onMouseMove, up: onMouseUp };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      },
    [artboardId, nodeId, patchStyleEdit]
  );

  const { x, y, width, height } = liveRect;
  const H = 8; // handle size

  // Edge midpoints for the 4 side handles
  const edgeHandles: Array<{ id: string; left: number; top: number; cursor: string }> = [
    { id: 'top',    left: x + width / 2 - H / 2, top: y - H / 2,          cursor: 'ns-resize'   },
    { id: 'right',  left: x + width - H / 2,      top: y + height / 2 - H / 2, cursor: 'ew-resize' },
    { id: 'bottom', left: x + width / 2 - H / 2,  top: y + height - H / 2, cursor: 'ns-resize'  },
    { id: 'left',   left: x - H / 2,              top: y + height / 2 - H / 2, cursor: 'ew-resize' },
  ];

  return (
    <>
      {/* Selection frame */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height,
          border: '2px solid #3385FF',
          borderRadius: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Label + action bar */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: Math.max(0, y - 28),
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          color: '#3385FF',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {nodeName}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9,
          color: 'rgba(51,133,255,0.55)',
          whiteSpace: 'nowrap',
        }}>
          {Math.round(width)} × {Math.round(height)}
        </span>

        {/* Delete button */}
        <button
          title="Delete element (⌫)"
          onClick={(e) => {
            e.stopPropagation();
            dispatchRemoveElement(artboardId, nodeId);
            onSelectionChange(null);
          }}
          style={{
            background: 'rgba(255,70,70,0.15)',
            border: '1px solid rgba(255,70,70,0.35)',
            borderRadius: 4,
            color: '#FF6060',
            fontSize: 9,
            padding: '1px 5px',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.03em',
            lineHeight: 1.6,
          }}
        >
          ✕ delete
        </button>
      </div>

      {/* Corner resize handles */}
      {(['tl', 'tr', 'bl', 'br'] as const).map(corner => {
        const cx = corner.includes('l') ? x - H / 2 : x + width - H / 2;
        const cy = corner.includes('t') ? y - H / 2 : y + height - H / 2;
        return (
          <div
            key={corner}
            onMouseDown={makeResizeHandle(corner)}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              width: H,
              height: H,
              background: '#fff',
              border: '2px solid #3385FF',
              borderRadius: 2,
              cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
              zIndex: 10,
            }}
          />
        );
      })}

      {/* Edge handles */}
      {edgeHandles.map((eh) => (
        <div
          key={eh.id}
          style={{
            position: 'absolute',
            left: eh.left,
            top: eh.top,
            width: H,
            height: H,
            background: '#fff',
            border: '2px solid #3385FF',
            borderRadius: 1,
            cursor: eh.cursor,
            zIndex: 9,
          }}
        />
      ))}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hitTestFiber(node: FiberNode, x: number, y: number): FiberNode | null {
  for (const child of [...node.children].reverse()) {
    const hit = hitTestFiber(child, x, y);
    if (hit) return hit;
  }
  if (!node.domRect) return null;
  const { x: nx, y: ny, width, height } = node.domRect;
  if (x >= nx && x <= nx + width && y >= ny && y <= ny + height) return node;
  return null;
}

function findNode(root: FiberNode, id: string): FiberNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function adjustRect(
  rect: DOMRectLike,
  corner: 'tl' | 'tr' | 'bl' | 'br',
  dx: number,
  dy: number
): DOMRectLike {
  let { x, y, width, height } = rect;
  if (corner.includes('l')) { x += dx; width  = Math.max(8, width  - dx); }
  else                       {           width  = Math.max(8, width  + dx); }
  if (corner.includes('t')) { y += dy; height = Math.max(8, height - dy); }
  else                       {           height = Math.max(8, height + dy); }
  return { x, y, width, height };
}
