'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useHistory } from '@/store/history';
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
    },
    [onSelectionChange]
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
        cursor: 'crosshair',
      }}
    >
      {hoveredId && fiberRoot && (
        <HoverHighlight fiberRoot={fiberRoot} nodeId={hoveredId} />
      )}

      {selected && (
        <SelectionHandles
          artboardId={artboardId}
          selection={selected}
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
        border: '1px solid rgba(51,133,255,0.4)',
        borderRadius: 2,
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Selection handles ─────────────────────────────────────────────────────────

interface SelectionHandlesProps {
  artboardId: string;
  selection: SelectionState;
  onResizeCommit: (changes: PropChange[]) => void;
}

function SelectionHandles({ selection, onResizeCommit }: SelectionHandlesProps) {
  const { rect, nodeName } = selection;
  const startRect = useRef<DOMRectLike | null>(null);
  // liveRectRef tracks the running rect without stale-closure issues.
  // liveRect is the React state for rendering only.
  const liveRectRef = useRef<DOMRectLike>(rect);
  const [liveRect, setLiveRect] = useState(rect);
  // onResizeCommitRef ensures onMouseUp always calls the latest callback even if
  // the parent re-renders between mousedown and mouseup.
  const onResizeCommitRef = useRef(onResizeCommit);
  useEffect(() => { onResizeCommitRef.current = onResizeCommit; });

  // Track registered drag listeners so we can clean them up on unmount.
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
        // Capture the rect at drag-start from the ref (always current).
        startRect.current = { ...liveRectRef.current };
        const startX = e.clientX;
        const startY = e.clientY;

        const onMouseMove = (ev: MouseEvent) => {
          if (!startRect.current) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          // Always apply delta from the START rect, not the previous frame's rect.
          // Applying to prev causes exponential drift over the course of a drag.
          const next = adjustRect(startRect.current, corner, dx, dy);
          liveRectRef.current = next;
          setLiveRect(next);
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          dragListenersRef.current = null;

          if (!startRect.current) return;
          // Read final dimensions from the ref — not from the stale liveRect closure.
          const widthChange = liveRectRef.current.width - startRect.current.width;
          const heightChange = liveRectRef.current.height - startRect.current.height;

          const changes: PropChange[] = [];
          if (Math.abs(widthChange) > 0.5) {
            changes.push({
              key: 'width',
              before: startRect.current.width,
              after: liveRectRef.current.width,
              changeType: 'modified',
            });
          }
          if (Math.abs(heightChange) > 0.5) {
            changes.push({
              key: 'height',
              before: startRect.current.height,
              after: liveRectRef.current.height,
              changeType: 'modified',
            });
          }
          if (changes.length > 0) onResizeCommitRef.current(changes);
          startRect.current = null;
        };

        dragListenersRef.current = { move: onMouseMove, up: onMouseUp };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      },
    [] // No reactive deps — all values read from refs
  );

  const { x, y, width, height } = liveRect;
  const HANDLE = 8;

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
      {/* Label */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y - 20,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          color: '#3385FF',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {nodeName}
      </div>
      {/* Corner handles */}
      {(['tl', 'tr', 'bl', 'br'] as const).map(corner => {
        const cx = corner.includes('l') ? x - HANDLE / 2 : x + width - HANDLE / 2;
        const cy = corner.includes('t') ? y - HANDLE / 2 : y + height - HANDLE / 2;
        return (
          <div
            key={corner}
            onMouseDown={makeResizeHandle(corner)}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              width: HANDLE,
              height: HANDLE,
              background: '#fff',
              border: '2px solid #3385FF',
              borderRadius: 2,
              cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
              zIndex: 10,
            }}
          />
        );
      })}
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
  if (corner.includes('l')) { x += dx; width = Math.max(8, width - dx); }
  else { width = Math.max(8, width + dx); }
  if (corner.includes('t')) { y += dy; height = Math.max(8, height - dy); }
  else { height = Math.max(8, height + dy); }
  return { x, y, width, height };
}
