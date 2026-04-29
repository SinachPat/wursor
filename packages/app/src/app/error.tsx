'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--page-bg)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        padding: 24,
      }}>
        <div style={{
          background: 'var(--card-bg)', border: '1px solid rgba(220,38,38,0.15)',
          borderRadius: 16, padding: '44px 48px', maxWidth: 480, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center',
          transition: 'background 0.2s',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 6v4M10 14h.01" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="10" cy="10" r="8.5" stroke="#DC2626" strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--card-text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--card-muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                padding: '9px 20px', borderRadius: 8,
                fontSize: '0.875rem', fontWeight: 600,
                background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
            <a
              href="/workspaces"
              style={{
                padding: '9px 20px', borderRadius: 8,
                fontSize: '0.875rem', fontWeight: 600,
                background: 'var(--card-subtle)', color: 'var(--btn-idle-fg)',
                border: 'none', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              Back to workspaces
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
