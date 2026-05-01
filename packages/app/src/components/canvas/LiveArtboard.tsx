'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  createHostEnvelope,
  isRendererEnvelope,
} from '@originmain/renderer';
import type { FiberNode, RendererMessage } from '@originmain/renderer';
import { useCanvas } from '@/store/canvas';

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
  /** Called when the iframe responds with computed CSS properties for a selected element. */
  onComponentStylesUpdate?: (nodeId: string, styles: Record<string, string>) => void;
  /** Called when the iframe discovers routes in the running app. */
  onRoutesDiscovered?: (routes: Array<{ path: string; label: string }>) => void;
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
  style,
}: LiveArtboardProps) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  // Track whether the iframe has sent READY so we don't send messages too early.
  const isReadyRef = useRef(false);

  // Reset ready state whenever src changes.  Without this, isReadyRef stays
  // true from the previous page, causing design-token / selection effects to
  // fire against a half-loaded iframe between navigation and the new READY.
  useEffect(() => {
    isReadyRef.current = false;
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
          // Push current design tokens into the iframe immediately.
          if (designTokens) sendMessage('SET_DESIGN_TOKENS', { tokens: designTokens });
          // Restore any active selection that existed before the iframe loaded.
          if (selectedComponentId) {
            sendMessage('SELECT_COMPONENT', { nodeId: selectedComponentId });
          }
          onReady?.();
          break;
        case 'FIBER_TREE_UPDATE':
          onFiberTreeUpdate?.(msg.root);
          break;
        case 'COMPONENT_SELECTED':
          onComponentSelected?.(msg.nodeId);
          // Request computed styles so the Design tab can populate immediately.
          sendMessage('REQUEST_ELEMENT_STYLES', { nodeId: msg.nodeId });
          break;
        case 'COMPONENT_DESELECTED':
          // Renderer clicked empty space — clear the host-side selection.
          onComponentSelected?.('');
          break;
        case 'ELEMENT_STYLES':
          onComponentStylesUpdate?.(msg.nodeId, msg.styles);
          break;
        case 'ROUTES_DISCOVERED':
          onRoutesDiscovered?.(msg.routes);
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, designTokens, selectedComponentId, sendMessage, onReady, onFiberTreeUpdate, onComponentSelected, onComponentStylesUpdate, onRoutesDiscovered]);

  // ── Push updated design tokens whenever they change ───────────────────────
  useEffect(() => {
    if (!isReadyRef.current || !designTokens) return;
    sendMessage('SET_DESIGN_TOKENS', { tokens: designTokens });
  }, [designTokens, sendMessage]);

  // ── Style edit mailbox ─────────────────────────────────────────────────────
  // Watches the Zustand mailbox for PATCH_ELEMENT_STYLE events addressed to
  // this artboard and forwards them to the iframe immediately.
  const styleEditEvent = useCanvas((s) => s.styleEditEvent);
  const clearStyleEdit = useCanvas((s) => s.clearStyleEdit);
  const removeElementEvent = useCanvas((s) => s.removeElementEvent);
  const clearRemoveElement = useCanvas((s) => s.clearRemoveElement);

  useEffect(() => {
    if (styleEditEvent?.artboardId === id && isReadyRef.current) {
      sendMessage('PATCH_ELEMENT_STYLE', {
        nodeId: styleEditEvent.nodeId,
        property: styleEditEvent.property,
        value: styleEditEvent.value,
      });
      clearStyleEdit();
    }
  }, [id, styleEditEvent, sendMessage, clearStyleEdit]);

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
