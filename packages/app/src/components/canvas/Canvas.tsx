'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useViewport } from '@/store/viewport';
import { useCanvas } from '@/store/canvas';
import { useArtboards, createArtboardMutation } from '@/hooks/useArtboards';
import { useCanvasTheme } from '@/store/canvasTheme';
import { Artboard } from './Artboard';

export function Canvas() {
  const T             = useCanvasTheme();
  const containerRef  = useRef<HTMLDivElement>(null);
  const panX          = useViewport((s) => s.panX);
  const panY          = useViewport((s) => s.panY);
  const zoom          = useViewport((s) => s.zoom);
  const { activeTool, setActiveTool, selectArtboard, selectedArtboardId, workspaceId, projectId } = useCanvas();
  const { artboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const queryClient   = useQueryClient();

  const isPanning  = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const spaceDown  = useRef(false);

  // ── Route discovery: auto-create screen grid ──────────────────────────────
  // When a live artboard discovers routes we don't have artboards for yet,
  // this creates them in a horizontal row to the right of all existing frames.
  const pendingRouteCreation = useRef(false);

  const handleRoutesDiscovered = useCallback(
    (sourceArtboardId: string, routes: Array<{ path: string; label: string }>) => {
      if (!workspaceId || pendingRouteCreation.current) return;
      const source = artboards.find((ab) => ab.id === sourceArtboardId);
      if (!source?.renderUrl) return;

      // Find routes we don't already have an artboard for
      const existingRoutes = new Set(artboards.map((ab) => ab.route ?? '/'));
      const newRoutes = routes.filter((r) => !existingRoutes.has(r.path));
      if (newRoutes.length === 0) return;

      pendingRouteCreation.current = true;

      // Position new artboards in a row to the right of all existing frames
      const GAP = 80;
      const rightEdge = artboards.reduce(
        (max, ab) => Math.max(max, ab.x + ab.width),
        source.x + source.width,
      );

      const creations = newRoutes.map((r, i) => ({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        name: r.label,
        origin_id: null,
        parent_artboard_id: null,
        metadata_jsonb: {
          x: rightEdge + GAP + i * (source.width + GAP),
          y: source.y,
          width: source.width,
          height: source.height,
          renderUrl: source.renderUrl,
          route: r.path,
        },
      }));

      Promise.all(creations.map((c) => createArtboardMutation(c)))
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: ['artboards', workspaceId, projectId ?? undefined],
          });
        })
        .catch(console.error)
        .finally(() => { pendingRouteCreation.current = false; });
    },
    [artboards, workspaceId, projectId, queryClient],
  );

  // Zone tool: drag to draw a completion zone
  const zoneStart   = useRef<{ x: number; y: number } | null>(null);
  const [zonePreview, setZonePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoneDone, setZoneDone] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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

    // Artboard creation tool: click on canvas to place a new artboard.
    // Note: existing artboards stop propagation on mousedown so this path
    // only fires on empty canvas space.
    if (activeTool === 'artboard' && workspaceId) {
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

    // Zone tool: finalise zone — keep the bounds and show prompt popup
    if (activeTool === 'zone' && zoneStart.current && zonePreview) {
      const bounds = { ...zonePreview };
      zoneStart.current = null;
      setZonePreview(null);
      setActiveTool('select');
      if (bounds.w > 8 && bounds.h > 8) setZoneDone(bounds);
    }
  }, [activeTool, setActiveTool, zonePreview]);

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
        background: T.canvasBg,
        transition: 'background 0.2s',
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
          backgroundImage: `radial-gradient(circle, ${T.dotColor} 1px, transparent 1px)`,
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
          <Artboard key={ab.id} {...ab} onRoutesDiscovered={handleRoutesDiscovered} />
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

      {/* Zone prompt overlay — shown after a zone drag completes */}
      {zoneDone && (
        <ZonePromptOverlay
          bounds={zoneDone}
          artboardId={selectedArtboardId}
          panX={panX} panY={panY} zoom={zoom}
          onClose={() => setZoneDone(null)}
        />
      )}

      {/* Empty canvas onboarding — shown only when the project has no artboards yet */}
      {artboards.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 3,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            opacity: 0.55, maxWidth: 320,
          }}>
            {/* Icon */}
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="3" y="3" width="15" height="15" rx="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeDasharray="3.5 2"/>
              <rect x="22" y="3" width="15" height="15" rx="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeDasharray="3.5 2"/>
              <rect x="3" y="22" width="15" height="15" rx="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeDasharray="3.5 2"/>
              <rect x="22" y="22" width="15" height="15" rx="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeDasharray="3.5 2"/>
            </svg>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Get started
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                Live render your running app into design frames
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
              {[
                { n: '1', text: 'Press A and click the canvas to place a screen' },
                { n: '2', text: 'Start the CLI proxy pointing at your dev server', code: 'npx @originmain/cli dev --target http://localhost:3000' },
                { n: '3', text: "Paste the proxy URL into the screen's Connect field" },
              ].map(({ n, text, code }) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: '1px solid rgba(51,133,255,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.5rem', color: 'rgba(51,133,255,0.9)',
                    fontWeight: 600,
                  }}>
                    {n}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>
                      {text}
                    </div>
                    {code && (
                      <div style={{
                        marginTop: 5,
                        padding: '4px 8px',
                        background: 'rgba(51,133,255,0.1)',
                        border: '1px solid rgba(51,133,255,0.2)',
                        borderRadius: 5,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.5625rem',
                        color: 'rgba(51,133,255,0.85)',
                        letterSpacing: '-0.01em',
                      }}>
                        {code}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Zone prompt overlay ──────────────────────────────────── */
function ZonePromptOverlay({
  bounds, artboardId, panX, panY, zoom, onClose,
}: {
  bounds: { x: number; y: number; w: number; h: number };
  artboardId: string | null;
  panX: number; panY: number; zoom: number;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState('');

  // Convert canvas → screen coordinates (relative to canvas container)
  const screenX = bounds.x * zoom + panX;
  const screenY = (bounds.y + bounds.h) * zoom + panY + 10; // 10px below zone

  const submit = useCallback(async () => {
    if (!prompt.trim() || !artboardId) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/ai/completion-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artboard_id: artboardId,
          bounds: { x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h },
          prompt: prompt.trim(),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { completion?: string; result?: string };
      setResult(data.completion ?? data.result ?? 'Done');
      setStatus('done');
    } catch (e) {
      console.error('[ZonePrompt]', e);
      setStatus('error');
    }
  }, [prompt, artboardId, bounds]);

  return (
    <div
      style={{
        position: 'absolute',
        left: Math.max(8, screenX),
        top: Math.max(8, screenY),
        zIndex: 50,
        width: 280,
        background: '#1A1A20',
        border: '1px solid rgba(51,133,255,0.35)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        padding: '12px 14px',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'rgba(51,133,255,0.9)', letterSpacing: '-0.01em' }}>
          ⚡ Completion zone · {bounds.w}×{bounds.h}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
      </div>

      {status === 'done' ? (
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 10 }}>
          {result}
        </div>
      ) : (
        <>
          <textarea
            autoFocus
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
              if (e.key === 'Escape') onClose();
              e.stopPropagation();
            }}
            placeholder="Describe what to generate in this zone…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '8px 10px',
              fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)',
              fontFamily: 'inherit', resize: 'none', outline: 'none',
              marginBottom: 8,
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3385FF')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
          {status === 'error' && (
            <p style={{ fontSize: '0.625rem', color: '#FF8080', margin: '0 0 6px' }}>Request failed — try again</p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => void submit()}
              disabled={status === 'loading' || !prompt.trim() || !artboardId}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 6,
                background: !prompt.trim() || !artboardId ? 'rgba(51,133,255,0.3)' : '#3385FF',
                border: 'none', color: '#fff',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', opacity: status === 'loading' ? 0.7 : 1,
              }}
            >
              {status === 'loading' ? 'Generating…' : 'Generate ⌘↵'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '7px 12px', borderRadius: 6,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {status === 'done' && (
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '7px 0', borderRadius: 6,
            background: 'rgba(255,255,255,0.07)', border: 'none',
            color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}
