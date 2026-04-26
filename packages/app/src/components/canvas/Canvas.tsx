'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
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

  const isPanning  = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const spaceDown  = useRef(false);

  // Zone tool: drag to draw a completion zone
  const zoneStart   = useRef<{ x: number; y: number } | null>(null);
  const [zonePreview, setZonePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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

    const rect = containerRef.current!.getBoundingClientRect();
    const { panX, panY, zoom } = useViewport.getState();
    const canvasX = Math.round((e.clientX - rect.left - panX) / zoom);
    const canvasY = Math.round((e.clientY - rect.top  - panY) / zoom);

    // Zone tool: start drag to define completion zone bounds
    if (activeTool === 'zone') {
      zoneStart.current = { x: canvasX, y: canvasY };
      setZonePreview({ x: canvasX, y: canvasY, w: 0, h: 0 });
      return;
    }

    // Artboard creation tool: click on canvas to place a new artboard
    if (activeTool === 'artboard' && e.target === e.currentTarget && workspaceId) {
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
    if (isPanning.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      const { panX, panY, setPan } = useViewport.getState();
      setPan(panX + dx, panY + dy);
      return;
    }

    // Zone tool: update preview rectangle while dragging
    if (activeTool === 'zone' && zoneStart.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const { panX, panY, zoom } = useViewport.getState();
      const cx = Math.round((e.clientX - rect.left - panX) / zoom);
      const cy = Math.round((e.clientY - rect.top  - panY) / zoom);
      setZonePreview({
        x: Math.min(zoneStart.current.x, cx),
        y: Math.min(zoneStart.current.y, cy),
        w: Math.abs(cx - zoneStart.current.x),
        h: Math.abs(cy - zoneStart.current.y),
      });
    }
  }, [activeTool]);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;

    // Zone tool: finalise zone on mouse-up (clear preview; zone result is handled elsewhere)
    if (activeTool === 'zone' && zoneStart.current) {
      zoneStart.current = null;
      setZonePreview(null);
      setActiveTool('select');
    }
  }, [activeTool, setActiveTool]);

  // Dot grid that shifts with pan and scales with zoom
  const gridSpacing = Math.max(6, 20 * zoom);
  const cursor =
    activeTool === 'pan' || isPanning.current ? 'grab' :
    activeTool === 'artboard' || activeTool === 'zone' ? 'crosshair' :
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

        {/* Zone tool: live drag preview rectangle */}
        {zonePreview && zonePreview.w > 4 && zonePreview.h > 4 && (
          <div style={{
            position: 'absolute',
            left: zonePreview.x, top: zonePreview.y,
            width: zonePreview.w, height: zonePreview.h,
            border: '1.5px dashed rgba(51,133,255,0.8)',
            background: 'rgba(51,133,255,0.06)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', top: -20, left: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.5625rem', color: 'rgba(51,133,255,0.9)',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            }}>
              {zonePreview.w} × {zonePreview.h}
            </span>
          </div>
        )}
      </div>

      {/* Empty canvas hint — shown only when workspace has no artboards yet */}
      {artboards.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 3,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            opacity: 0.4,
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="4" y="4" width="12" height="12" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeDasharray="3 2"/>
              <rect x="20" y="4" width="12" height="12" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeDasharray="3 2"/>
              <rect x="4" y="20" width="12" height="12" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeDasharray="3 2"/>
              <rect x="20" y="20" width="12" height="12" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeDasharray="3 2"/>
            </svg>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.5625rem', color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Press A to create an artboard
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
