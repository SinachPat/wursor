'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  buildFiberHookScript,
  createHostEnvelope,
  isRendererEnvelope,
} from '@originmain/renderer';
import type { FiberNode, RendererMessage } from '@originmain/renderer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveArtboardProps {
  id: string;
  /** URL of the connected application route to render */
  src: string;
  width?: number;
  height?: number;
  designTokens?: Record<string, string>;
  onReady?: () => void;
  onFiberTreeUpdate?: (root: FiberNode) => void;
  onComponentSelected?: (nodeId: string) => void;
  style?: React.CSSProperties;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveArtboard({
  id,
  src,
  width = 1280,
  height = 720,
  designTokens,
  onReady,
  onFiberTreeUpdate,
  onComponentSelected,
  style,
}: LiveArtboardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send a message to the iframe via the typed protocol
  const sendMessage = useCallback(
    (type: Parameters<typeof createHostEnvelope>[1]['type'], payload?: Record<string, unknown>) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const envelope = createHostEnvelope(id, { type, ...(payload ?? {}) } as Parameters<typeof createHostEnvelope>[1]);
      iframe.contentWindow.postMessage(envelope, '*');
    },
    [id]
  );

  // Handle messages from the renderer iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isRendererEnvelope(event.data)) return;
      if (event.data.artboardId !== id) return;

      const msg: RendererMessage = event.data.message;
      switch (msg.type) {
        case 'READY':
          // Inject fiber hook after the renderer signals it's ready
          injectFiberHook(iframeRef.current, id);
          if (designTokens) sendMessage('SET_DESIGN_TOKENS', { tokens: designTokens });
          onReady?.();
          break;
        case 'FIBER_TREE_UPDATE':
          onFiberTreeUpdate?.(msg.root);
          break;
        case 'COMPONENT_SELECTED':
          onComponentSelected?.(msg.nodeId);
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, designTokens, sendMessage, onReady, onFiberTreeUpdate, onComponentSelected]);

  // Push updated design tokens whenever they change
  useEffect(() => {
    if (!designTokens) return;
    sendMessage('SET_DESIGN_TOKENS', { tokens: designTokens });
  }, [designTokens, sendMessage]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={`artboard-${id}`}
      // Security: allow-scripts required to run React; allow-same-origin required
      // for postMessage with targeted origin validation. Do NOT combine these with
      // untrusted third-party content.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function injectFiberHook(iframe: HTMLIFrameElement | null, artboardId: string) {
  if (!iframe?.contentDocument) return;
  try {
    const script = iframe.contentDocument.createElement('script');
    script.textContent = buildFiberHookScript(artboardId);
    iframe.contentDocument.head.appendChild(script);
  } catch {
    // Cross-origin or sandboxing prevents injection — renderer must include the
    // hook script itself in that case.
  }
}
