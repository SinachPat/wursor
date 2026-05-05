'use client';

/**
 * IsolationFrame — Phase 3 full implementation
 *
 * Renders an isolated view of a single React component inside an iframe.
 * The CLI proxy serves the isolation page at:
 *   `/__om_isolation__?component=<name>&file=<path>`
 *
 * When the indexer is not ready, shows an informative placeholder. When it is
 * ready, renders the isolation iframe. The host sends UPDATE_ISOLATION_PROPS
 * messages so the designer can tweak props live from the Inspector.
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 3 §3.5 "Component Isolation"
 */

import { useRef, useEffect, useCallback } from 'react';
import { useCanvas }      from '@/store/canvas';
import { useCanvasTheme } from '@/store/canvasTheme';
import { createHostEnvelope } from '@originmain/renderer';

interface IsolationFrameProps {
  /** Artboard ID (used for message routing). */
  artboardId: string;
  /** Display name of the component to isolate — passed as ?component= param. */
  componentName: string;
  /** Workspace-relative source file path — passed as ?file= param. */
  componentFile: string;
  /** Base URL of the CLI proxy (e.g. "http://localhost:4170"). */
  proxyUrl: string;
  /** Current prop overrides to forward into the isolation page. */
  isolationProps?: Record<string, unknown>;
  width: number;
  height: number;
}

/** Builds the isolation page URL from the proxy base and component params. */
function buildIsolationUrl(
  proxyUrl: string,
  componentName: string,
  componentFile: string,
): string {
  const base = proxyUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    component: componentName,
    file:      componentFile,
  });
  return `${base}/__om_isolation__?${params.toString()}`;
}

export function IsolationFrame({
  artboardId,
  componentName,
  componentFile,
  proxyUrl,
  isolationProps,
  width,
  height,
}: IsolationFrameProps) {
  const T = useCanvasTheme();
  const { indexerStatus } = useCanvas();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Forward prop overrides to the isolation iframe ─────────────────────────
  // Sends UPDATE_ISOLATION_PROPS whenever isolationProps changes so the
  // component re-renders with the new values without a full page reload.
  const sendIsolationProps = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const msg = createHostEnvelope(artboardId, {
        type:  'UPDATE_ISOLATION_PROPS',
        props: isolationProps ?? {},
      });
      iframe.contentWindow.postMessage(msg, '*');
    } catch { /* iframe may not be ready yet — will retry on next onLoad */ }
  }, [artboardId, isolationProps]);

  useEffect(() => {
    sendIsolationProps();
  }, [sendIsolationProps]);

  // ── Indexer not running — show placeholder ─────────────────────────────────
  if (indexerStatus !== 'ready') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '32px 20px',
          background: T.bgDeep,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          textAlign: 'center',
          width, height,
          boxSizing: 'border-box',
        }}
      >
        {/* Isolation icon */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.3 }}>
          <rect x="3" y="3" width="22" height="22" rx="4" stroke="white" strokeWidth="1.3" strokeDasharray="4 2.5"/>
          <rect x="9" y="9" width="10" height="10" rx="2" stroke="white" strokeWidth="1.3"/>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: '0.5875rem',
            color: T.fgMuted,
            letterSpacing: '0.02em',
          }}>
            Isolation mode requires CLI indexer
          </span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.5625rem',
            color: T.dim,
            lineHeight: 1.55,
          }}>
            Run{' '}
            <code style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: '#FFBA7B',
              fontSize: '0.5rem',
              background: 'rgba(255,186,123,0.08)',
              borderRadius: 3,
              padding: '1px 4px',
            }}>
              npx @originmain/cli dev
            </code>
            {' '}to enable component isolation.
          </span>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${T.sep}`,
          borderRadius: 5,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: T.dim, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5rem',
            color: T.dim,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Indexer offline
          </span>
        </div>
      </div>
    );
  }

  // ── Indexer ready — render isolation iframe ────────────────────────────────
  const src = buildIsolationUrl(proxyUrl, componentName, componentFile);

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={src}
        width={width}
        height={height}
        style={{
          display: 'block',
          border: 'none',
          background: 'white',
        }}
        title={`${componentName} — isolation`}
        // The isolation page is served by the CLI proxy (localhost).
        // allow="*" is safe here because it's a locally-served page.
        allow="*"
        onLoad={sendIsolationProps}
      />

      {/* Isolation indicator badge */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: 'rgba(51,133,255,0.12)',
        border: '1px solid rgba(51,133,255,0.3)',
        borderRadius: 4,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#3385FF', flexShrink: 0,
          animation: 'om-pulse 2s infinite',
        }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5rem',
          color: '#3385FF',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          isolation
        </span>
      </div>

      {/* Subtle top border to distinguish from route artboards */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 2,
        background: 'linear-gradient(90deg, rgba(51,133,255,0.6) 0%, rgba(51,133,255,0) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
