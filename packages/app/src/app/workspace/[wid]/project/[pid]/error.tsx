'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CanvasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ wid: string }>();

  useEffect(() => {
    console.error('[CanvasError]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0C0C10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 6v4M10 14h.01" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="8.5" stroke="#DC2626" strokeWidth="1.5"/>
          </svg>
        </div>
        <h1
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.88)',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Canvas failed to load
        </h1>
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'rgba(255,255,255,0.38)',
            margin: '0 0 28px',
            lineHeight: 1.6,
          }}
        >
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
          <Link
            href={params?.wid ? `/workspace/${params.wid}` : '/workspaces'}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              background: 'transparent',
              color: 'rgba(255,255,255,0.42)',
              border: '1px solid rgba(255,255,255,0.07)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Back to workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
