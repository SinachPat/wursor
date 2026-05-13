'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useViewport } from '@/store/viewport';
import { useCanvas } from '@/store/canvas';
import { useArtboards, createArtboardMutation } from '@/hooks/useArtboards';
import { useCanvasTheme } from '@/store/canvasTheme';
import { Artboard } from './Artboard';
import { CompletionZone } from './CompletionZone';
import { artboardIframeMap } from '@/lib/artboard-iframe-map';
import { createHostEnvelope } from '@originmain/renderer';

export function Canvas() {
  const T             = useCanvasTheme();
  const containerRef  = useRef<HTMLDivElement>(null);
  const panX          = useViewport((s) => s.panX);
  const panY          = useViewport((s) => s.panY);
  const zoom          = useViewport((s) => s.zoom);
  const { activeTool, setActiveTool, selectArtboard, selectedArtboardId, workspaceId, projectId, setDiscoveredRoutes } = useCanvas();
  const { artboards } = useArtboards(workspaceId ?? undefined, projectId ?? undefined);
  const queryClient   = useQueryClient();

  const isPanning  = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const spaceDown  = useRef(false);

  // ── Viewport culling (spec Phase 0 §3.2) ─────────────────────────────────
  // Classifies each artboard as 'active' | 'near' | 'far' based on whether it
  // overlaps with the current viewport. Updated 100ms after pan/zoom settles.
  // 'active'/'near' → full LiveArtboard iframe; 'far' → placeholder thumbnail.
  const [renderPriorities, setRenderPriorities] = useState<Record<string, 'active' | 'near' | 'far'>>({});
  const cullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track previous priorities so we can detect Active/Near → Far transitions
  // and request a thumbnail snapshot before the iframe is unmounted.
  const prevPrioritiesRef = useRef<Record<string, 'active' | 'near' | 'far'>>({});

  useEffect(() => {
    function computeCulling() {
      const el = containerRef.current;
      if (!el) return;
      const { panX, panY, zoom } = useViewport.getState();
      const vpW = el.clientWidth;
      const vpH = el.clientHeight;

      // Viewport bounds in world space
      const vpLeft   = -panX / zoom;
      const vpTop    = -panY / zoom;
      const vpRight  = vpLeft + vpW / zoom;
      const vpBottom = vpTop  + vpH / zoom;

      // Near zone: 1 viewport width/height of padding beyond the visible edge
      const nearPadX = vpW / zoom;
      const nearPadY = vpH / zoom;

      const next: Record<string, 'active' | 'near' | 'far'> = {};
      for (const ab of artboards) {
        const al = ab.x;
        const at = ab.y;
        const ar = ab.x + ab.width;
        const ab_ = ab.y + ab.height;

        const overlapsViewport =
          ar > vpLeft && al < vpRight && ab_ > vpTop && at < vpBottom;

        const overlapsNear =
          ar > vpLeft - nearPadX && al < vpRight + nearPadX &&
          ab_ > vpTop - nearPadY && at < vpBottom + nearPadY;

        next[ab.id] = overlapsViewport ? 'active' : overlapsNear ? 'near' : 'far';
      }

      // Detect transitions to 'far' and request a thumbnail before the iframe unmounts.
      const prev = prevPrioritiesRef.current;
      for (const abId of Object.keys(next)) {
        const wasVisible = prev[abId] !== 'far';
        const nowFar     = next[abId] === 'far';
        if (wasVisible && nowFar) {
          const iframe = artboardIframeMap.get(abId);
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(createHostEnvelope(abId, { type: 'CAPTURE_THUMBNAIL' }), '*');
          }
        }
      }
      prevPrioritiesRef.current = next;

      setRenderPriorities(next);
    }

    function scheduleCull() {
      if (cullTimerRef.current) clearTimeout(cullTimerRef.current);
      cullTimerRef.current = setTimeout(computeCulling, 100);
    }

    // Run immediately when artboards list changes, then subscribe to viewport changes
    computeCulling();

    // Subscribe to viewport store updates
    const unsub = useViewport.subscribe(scheduleCull);
    return () => {
      unsub();
      if (cullTimerRef.current) clearTimeout(cullTimerRef.current);
    };
  }, [artboards]);

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

      // Persist all discovered routes in the canvas store so the Routes tab can display them
      setDiscoveredRoutes(sourceArtboardId, routes);

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
    [artboards, workspaceId, projectId, queryClient, setDiscoveredRoutes],
  );

  // Zone tool: drag to draw a completion zone
  const zoneStart   = useRef<{ x: number; y: number } | null>(null);
  const [zonePreview, setZonePreview]   = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoneDone,    setZoneDone]      = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Completion preview: AI result overlaid on the artboard at zone coords (spec Layer 6)
  const [completionPreview, setCompletionPreview] = useState<{
    result: string;
    bounds: { x: number; y: number; w: number; h: number };
  } | null>(null);

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
      data-canvas-viewport="true"
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
          <Artboard
            key={ab.id}
            {...ab}
            onRoutesDiscovered={handleRoutesDiscovered}
            renderPriority={renderPriorities[ab.id] ?? 'active'}
          />
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

        {/* AI completion preview — rendered in artboard space at zone bounds.
            Spec Layer 6: "A preview overlay showing the AI-generated completion
            on the artboard." Positioned inside the transform layer so it tracks
            pan/zoom automatically with no coordinate conversion needed. */}
        {completionPreview && (
          <div
            style={{
              position:     'absolute',
              left:         completionPreview.bounds.x,
              top:          completionPreview.bounds.y,
              width:        completionPreview.bounds.w,
              height:       completionPreview.bounds.h,
              background:   'rgba(20,22,30,0.82)',
              border:       '1.5px solid rgba(51,133,255,0.55)',
              borderRadius: 6,
              backdropFilter: 'blur(6px)',
              padding:      '10px 12px',
              boxSizing:    'border-box',
              pointerEvents: 'none',
              overflow:     'hidden',
            }}
          >
            {/* "AI" badge */}
            <div style={{
              display:       'flex',
              alignItems:    'center',
              gap:           5,
              marginBottom:  6,
            }}>
              <span style={{
                fontFamily:      "'JetBrains Mono', monospace",
                fontSize:        '0.45rem',
                fontWeight:      700,
                letterSpacing:   '0.1em',
                textTransform:   'uppercase',
                color:           'rgba(51,133,255,0.9)',
                background:      'rgba(51,133,255,0.12)',
                border:          '1px solid rgba(51,133,255,0.3)',
                borderRadius:    3,
                padding:         '1px 4px',
              }}>
                ⚡ AI Preview
              </span>
              {/* Dismiss button */}
              <button
                onMouseDown={e => { e.stopPropagation(); setCompletionPreview(null); }}
                style={{
                  marginLeft:  'auto',
                  background:  'none',
                  border:      'none',
                  color:       'rgba(255,255,255,0.3)',
                  cursor:      'pointer',
                  fontSize:    10,
                  padding:     0,
                  lineHeight:  1,
                  pointerEvents: 'auto',
                }}
              >
                ✕
              </button>
            </div>
            <p style={{
              fontFamily:   'sans-serif',
              fontSize:     '0.625rem',
              color:        'rgba(255,255,255,0.75)',
              lineHeight:   1.55,
              margin:       0,
              whiteSpace:   'pre-wrap',
              wordBreak:    'break-word',
            }}>
              {completionPreview.result}
            </p>
          </div>
        )}
      </div>

      {/* Completion zone popup — shown after a zone drag completes.
          Lives in screen space (outside the transform layer) so the input
          isn't scaled by zoom. */}
      {zoneDone && (
        <CompletionZone
          bounds={zoneDone}
          artboardId={selectedArtboardId}
          panX={panX} panY={panY} zoom={zoom}
          onClose={() => { setZoneDone(null); }}
          onResult={(result, bounds) => setCompletionPreview({ result, bounds })}
        />
      )}

      {/* Empty canvas onboarding — shown only when the project has no artboards yet */}
      {artboards.length === 0 && (
        <UrlOnboardingOverlay
          workspaceId={workspaceId}
          projectId={projectId}
          queryClient={queryClient}
        />
      )}
    </div>
  );
}

/* ── URL onboarding overlay ───────────────────────────────── */
// Shown when the canvas has no artboards. Lets the user paste their app URL
// (Vercel, Netlify, or any deployment where @originmain/live is installed).
// Route discovery fires after the first React commit and populates remaining
// pages automatically.
function UrlOnboardingOverlay({
  workspaceId,
  projectId,
  queryClient,
}: {
  workspaceId: string | null;
  projectId: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConnect = useCallback(async () => {
    if (!workspaceId) return;
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
    } catch {
      setErrorMsg('Enter a valid http:// or https:// URL');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      await createArtboardMutation({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        name: 'Home',
        origin_id: null,
        parent_artboard_id: null,
        metadata_jsonb: { x: 100, y: 100, width: 1280, height: 800, renderUrl: trimmed, route: '/' },
      });
      queryClient.invalidateQueries({ queryKey: ['artboards', workspaceId, projectId ?? undefined] });
    } catch (e) {
      console.error('[Canvas] Failed to create artboard', e);
      setStatus('error');
      setErrorMsg('Failed to create artboard — try again');
    }
  }, [url, workspaceId, projectId, queryClient]);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 3,
    }}>
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          maxWidth: 360, pointerEvents: 'auto',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
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
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            Connect your app
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
            Paste your app URL — all your pages will be auto-rendered as artboards
          </div>
        </div>

        {/* SDK install hint */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            padding: '6px 10px',
            background: 'rgba(51,133,255,0.08)', border: '1px solid rgba(51,133,255,0.18)',
            borderRadius: 6, fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5625rem', color: 'rgba(51,133,255,0.75)', letterSpacing: '-0.01em',
          }}>
            npm install @originmain/live
          </div>
          <div style={{
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5625rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.01em',
          }}>
            {'// layout.tsx — must be before React'}
            <br />
            {'import "@originmain/live";'}
          </div>
        </div>

        {/* URL input */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setErrorMsg(''); }}
              onKeyDown={e => { if (e.key === 'Enter') void handleConnect(); e.stopPropagation(); }}
              placeholder="https://your-app.vercel.app"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
                padding: '8px 10px', fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none', letterSpacing: '-0.01em',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3385FF')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
            <button
              onClick={() => void handleConnect()}
              disabled={status === 'loading' || !url.trim()}
              style={{
                padding: '8px 14px', borderRadius: 6,
                background: !url.trim() ? 'rgba(51,133,255,0.3)' : '#3385FF',
                border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                cursor: status === 'loading' || !url.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                opacity: status === 'loading' ? 0.7 : 1, whiteSpace: 'nowrap',
              }}
            >
              {status === 'loading' ? 'Connecting…' : 'Connect →'}
            </button>
          </div>
          {errorMsg && (
            <p style={{ margin: 0, fontSize: '0.625rem', color: '#FF8080', fontFamily: "'Inter', sans-serif" }}>
              {errorMsg}
            </p>
          )}
        </div>

        <div style={{
          fontFamily: "'Inter', sans-serif", fontSize: '0.625rem',
          color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, textAlign: 'center',
        }}>
          Or press{' '}
          <kbd style={{ fontFamily: "'JetBrains Mono', monospace", padding: '1px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>A</kbd>
          {' '}and click the canvas to place a screen manually
        </div>
      </div>
    </div>
  );
}

// ZonePromptOverlay extracted to ./CompletionZone.tsx (spec Layer 6.4)
