'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  createHostEnvelope,
  isRendererEnvelope,
} from '@originmain/renderer';
import type { FiberNode, RendererMessage } from '@originmain/renderer';
import { useCanvas } from '@/store/canvas';
import { artboardIframeMap } from '@/lib/artboard-iframe-map';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveArtboardProps {
  id: string;
  /** URL of the connected application route to render.
   *  For live dev: the CLI proxy URL (e.g., http://localhost:4170)
   *  For previews: the Vercel/Netlify preview URL (with @originmain/live SDK) */
  src: string;
  width?: number;
  height?: number;
  /** DLF design tokens to inject into the iframe as CSS custom properties. */
  designTokens?: Record<string, string>;
  /** The currently selected component node ID (from the canvas store).
   *  When set, sends SELECT_COMPONENT to the iframe so the fiber hook renders
   *  a blue highlight ring over that component's DOM element. */
  selectedComponentId?: string | null;
  onReady?: () => void;
  onFiberTreeUpdate?: (root: FiberNode) => void;
  onComponentSelected?: (nodeId: string) => void;
  /** Called when the iframe responds with computed CSS properties for a selected element.
   *  Also carries structural flags from the ELEMENT_STYLES message. */
  onComponentStylesUpdate?: (nodeId: string, styles: Record<string, string>, hasDirectText: boolean, hasParagraphChildren: boolean) => void;
  /** Called when the iframe discovers routes in the running app. */
  onRoutesDiscovered?: (routes: Array<{ path: string; label: string }>) => void;
  /** Called when READY fires but no React commits arrive within 4 s — signals a
   *  static HTML page where the fiber hook can't find a React runtime. */
  onStaticPageDetected?: () => void;
  /** Phase 0: Called when the renderer responds to CAPTURE_THUMBNAIL with a JPEG data URL (or null on failure). */
  onThumbnailReady?: (dataUrl: string | null) => void;
  /** Phase 4: Called when the renderer responds to CAPTURE_SNAPSHOT with a PNG data URL (or null on failure). */
  onSnapshotReady?: (dataUrl: string | null, nodeId: string) => void;
  style?: React.CSSProperties;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveArtboard({
  id,
  src,
  width = 1280,
  height = 720,
  designTokens,
  selectedComponentId,
  onReady,
  onFiberTreeUpdate,
  onComponentSelected,
  onComponentStylesUpdate,
  onRoutesDiscovered,
  onStaticPageDetected,
  onThumbnailReady,
  onSnapshotReady,
  style,
}: LiveArtboardProps) {
  const { setArtboardRootFontSize } = useCanvas();
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  // Track whether the iframe has sent READY so we don't send messages too early.
  const isReadyRef = useRef(false);
  // Whether a React commit (FIBER_TREE_UPDATE) has been received for this src.
  const hasReactRef = useRef(false);
  // Timer that fires if READY arrives but no React commits follow — static page.
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After READY fires the nodeMap inside the iframe is still empty — we can't
  // request styles until after the first FIBER_TREE_UPDATE (which populates it).
  // This ref holds the nodeId to re-request styles for after that first commit.
  const pendingStylesFetchRef = useRef<string | null>(null);

  // Reset ready state whenever src changes.  Without this, isReadyRef stays
  // true from the previous page, causing design-token / selection effects to
  // fire against a half-loaded iframe between navigation and the new READY.
  useEffect(() => {
    isReadyRef.current = false;
    hasReactRef.current = false;
    pendingStylesFetchRef.current = null;
    if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
    staticTimerRef.current = null;
  }, [src]);

  // ── Send a typed message to the iframe ───────────────────────────────────
  const sendMessage = useCallback(
    (type: Parameters<typeof createHostEnvelope>[1]['type'], payload?: Record<string, unknown>) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const envelope = createHostEnvelope(
        id,
        { type, ...(payload ?? {}) } as Parameters<typeof createHostEnvelope>[1],
      );
      iframe.contentWindow.postMessage(envelope, '*');
    },
    [id],
  );

  // ── Handle messages from the renderer iframe ──────────────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isRendererEnvelope(event.data)) return;
      if (event.data.artboardId !== id) return;

      const msg: RendererMessage = event.data.message;
      switch (msg.type) {
        case 'READY':
          isReadyRef.current = true;
          // Store the root font size for rem→px normalisation in the token resolver.
          if (typeof msg.rootFontSizePx === 'number') {
            setArtboardRootFontSize(id, msg.rootFontSizePx);
          }
          // Push current design tokens into the iframe immediately.
          if (designTokens) sendMessage('SET_DESIGN_TOKENS', { tokens: designTokens });
          // Restore the highlight ring for any active selection.
          // We cannot send REQUEST_ELEMENT_STYLES here — nodeMap is empty until
          // the first React commit fires FIBER_TREE_UPDATE. Defer it via ref.
          if (selectedComponentId) {
            sendMessage('SELECT_COMPONENT', { nodeId: selectedComponentId });
            pendingStylesFetchRef.current = selectedComponentId;
          }
          onReady?.();
          // Start an 8-second timer: if React never commits (including the
          // 2-second retroactive captureExistingTree safety net), this is
          // genuinely a static page.
          if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
          staticTimerRef.current = setTimeout(() => {
            if (!hasReactRef.current) onStaticPageDetected?.();
          }, 8000);
          break;
        case 'FIBER_TREE_UPDATE':
          // Mark that this iframe contains a live React app.
          hasReactRef.current = true;
          if (staticTimerRef.current) {
            clearTimeout(staticTimerRef.current);
            staticTimerRef.current = null;
          }
          onFiberTreeUpdate?.(msg.root);
          // If READY deferred a style fetch (nodeMap was empty at that point),
          // the first commit has now populated nodeMap — request styles now.
          if (pendingStylesFetchRef.current) {
            sendMessage('REQUEST_ELEMENT_STYLES', { nodeId: pendingStylesFetchRef.current });
            pendingStylesFetchRef.current = null;
          }
          break;
        case 'COMPONENT_SELECTED':
          onComponentSelected?.(msg.nodeId);
          break;
        case 'COMPONENT_DESELECTED':
          // Renderer clicked empty space — clear the host-side selection.
          onComponentSelected?.('');
          break;
        case 'ELEMENT_STYLES':
          onComponentStylesUpdate?.(msg.nodeId, msg.styles, msg.hasDirectText, msg.hasParagraphChildren);
          break;
        case 'ROUTES_DISCOVERED':
          onRoutesDiscovered?.(msg.routes);
          break;
        case 'THUMBNAIL_READY':
          // Phase 0: store base64 JPEG for the far-state placeholder in Artboard.tsx.
          onThumbnailReady?.(msg.dataUrl);
          break;
        case 'SNAPSHOT_READY':
          // Phase 4: PNG of the selected element for the Code Preview diff in Inspector.
          onSnapshotReady?.(msg.dataUrl, msg.nodeId);
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, designTokens, selectedComponentId, sendMessage, onReady, onFiberTreeUpdate, onComponentSelected, onComponentStylesUpdate, onRoutesDiscovered, onThumbnailReady, onSnapshotReady]);

  // ── Push updated design tokens whenever they change ───────────────────────
  useEffect(() => {
    if (!isReadyRef.current || !designTokens) return;
    sendMessage('SET_DESIGN_TOKENS', { tokens: designTokens });
  }, [designTokens, sendMessage]);

  // ── Style edit queue ───────────────────────────────────────────────────────
  // Drains all PATCH_ELEMENT_STYLE events addressed to this artboard and
  // forwards them to the iframe. Uses a queue (not a single slot) so that
  // simultaneous width + height patches from resize are both delivered.
  const styleEditQueue = useCanvas((s) => s.styleEditQueue);
  const clearStyleEdits = useCanvas((s) => s.clearStyleEdits);
  const childrenStyleEditQueue = useCanvas((s) => s.childrenStyleEditQueue);
  const clearChildrenStyleEdits = useCanvas((s) => s.clearChildrenStyleEdits);
  const removeElementEvent = useCanvas((s) => s.removeElementEvent);
  const clearRemoveElement = useCanvas((s) => s.clearRemoveElement);

  useEffect(() => {
    const mine = styleEditQueue.filter((e) => e.artboardId === id);
    if (mine.length === 0 || !isReadyRef.current) return;
    for (const e of mine) {
      sendMessage('PATCH_ELEMENT_STYLE', { nodeId: e.nodeId, property: e.property, value: e.value });
    }
    clearStyleEdits(id);
  }, [id, styleEditQueue, sendMessage, clearStyleEdits]);

  // ── Children style edit queue (PATCH_CHILDREN_STYLE — paragraph spacing etc.) ──
  useEffect(() => {
    const mine = childrenStyleEditQueue.filter((e) => e.artboardId === id);
    if (mine.length === 0 || !isReadyRef.current) return;
    for (const e of mine) {
      sendMessage('PATCH_CHILDREN_STYLE', { parentNodeId: e.parentNodeId, selector: e.selector, property: e.property, value: e.value });
    }
    clearChildrenStyleEdits(id);
  }, [id, childrenStyleEditQueue, sendMessage, clearChildrenStyleEdits]);

  useEffect(() => {
    if (removeElementEvent?.artboardId === id && isReadyRef.current) {
      sendMessage('REMOVE_ELEMENT', { nodeId: removeElementEvent.nodeId });
      clearRemoveElement();
    }
  }, [id, removeElementEvent, sendMessage, clearRemoveElement]);

  // ── Sync selection changes into the iframe ────────────────────────────────
  // Sends SELECT_COMPONENT on every selectedComponentId change so the blue
  // highlight ring stays in sync with the canvas selection store.
  useEffect(() => {
    if (!isReadyRef.current) return;
    if (selectedComponentId) {
      sendMessage('SELECT_COMPONENT', { nodeId: selectedComponentId });
      sendMessage('REQUEST_ELEMENT_STYLES', { nodeId: selectedComponentId });
    } else {
      sendMessage('DESELECT');
    }
  }, [selectedComponentId, sendMessage]);

  // ── Register / deregister in the artboardIframeMap singleton ────────────────
  // This allows canvas-level dispatch (e.g. CompletionZone, CodeTab send-to-agent)
  // to reach the correct iframe without going through React state or Zustand.
  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    artboardIframeMap.set(id, el);
    return () => { artboardIframeMap.delete(id); };
  }, [id]);

  return (
    <iframe
      ref={iframeRef}
      // The name attribute carries the artboard ID to the fiber hook.
      // The hook reads window.name to tag postMessage envelopes and to
      // guard against activating outside Originmain iframes.
      // Format: "om:<artboardId>"
      name={`om:${id}`}
      src={src}
      title={`artboard-${id}`}
      // Security: allow-scripts required for React; allow-same-origin required
      // for postMessage origin validation. Do NOT add allow-top-navigation or
      // allow-popups unless explicitly needed — principle of least privilege.
      sandbox="allow-scripts allow-same-origin allow-forms"
      style={{
        width,
        height,
        border: 'none',
        display: 'block',
        ...style,
      }}
    />
  );
}
