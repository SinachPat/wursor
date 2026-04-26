'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useViewport } from '@/store/viewport';
import { useCanvas } from '@/store/canvas';
import { useArtboards, createArtboardMutation } from '@/hooks/useArtboards';
import { Artboard } from './Artboard';

export function Canvas() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const panX          = useViewport((s) => s.panX);
  const panY          = useViewport((s) => s.panY);
  const zoom          = useViewport((s) => s.zoom);
  const { activeTool, setActiveTool, selectArtboard, workspaceId, projectId } = useCanvas();
  const { artboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const queryClient   = useQueryClient();

  const isPanning = useRef(false);
  const lastPos   = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);

  // Wheel: pan or pinch-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panX, panY, setPan, setZoom } = useViewport.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        setZoom(zoom * (e.deltaY > 0 ? 0.92 : 1.09), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setPan(panX - e.deltaX, panY - e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Space bar temporary pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && e.target === document.body) spaceDown.current = true; };
    const up   = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const startPan = e.button === 1 || spaceDown.current || activeTool === 'pan';

    if (startPan) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Artboard creation tool: click on canvas to place a new artboard
    if (activeTool === 'artboard' && e.target === e.currentTarget && workspaceId) {
      const rect = containerRef.current!.getBoundingClientRect();
      // Convert screen → canvas space (invert matrix(zoom,0,0,zoom,panX,panY))
      const { panX, panY, zoom } = useViewport.getState();
      const canvasX = Math.round((e.clientX - rect.left - panX) / zoom);
      const canvasY = Math.round((e.clientY - rect.top  - panY) / zoom);

      const label = `Artboard ${Date.now().toString(36).slice(-4).toUpperCase()}`;
      createArtboardMutation({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        name: label,
        origin_id: null,
        parent_artboard_id: null,
        metadata_jsonb: { x: canvasX, y: canvasY, width: 360, height: 240 },
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
        setActiveTool('select');
      }).catch((err: unknown) => {
        console.error('[Canvas] Failed to create artboard', err);
      });
      return;
    }

    if (e.target === e.currentTarget) {
      selectArtboard(null);
    }
  }, [activeTool, setActiveTool, selectArtboard, workspaceId, projectId, queryClient]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const { panX, panY, setPan } = useViewport.getState();
    setPan(panX + dx, panY + dy);
  }, []);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // Dot grid that shifts with pan and scales with zoom
  const gridSpacing = Math.max(6, 20 * zoom);
  const cursor =
    activeTool === 'pan' || isPanning.current ? 'grab' :
    activeTool === 'artboard' ? 'crosshair' :
    'default';

  return (
    <div
      ref={containerRef}
      style={{
        gridColumn: 2,
        gridRow: 2,
        position: 'relative',
        overflow: 'hidden',
        background: '#0C0C10',
        cursor,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Dot grid — scales and shifts with viewport */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
          backgroundPosition: `${panX % gridSpacing}px ${panY % gridSpacing}px`,
          pointerEvents: 'none',
        }}
      />

      {/* Subtle radial vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Transform layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `matrix(${zoom},0,0,${zoom},${panX},${panY})`,
          transformOrigin: '0 0',
          zIndex: 2,
        }}
      >
        {artboards.map((ab) => (
          <Artboard key={ab.id} {...ab} />
        ))}
      </div>
    </div>
  );
}
