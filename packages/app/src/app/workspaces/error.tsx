'use client';

import { useEffect } from 'react';
import { AppHeader } from '@/components/shell/AppHeader';

export default function WorkspacesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[WorkspacesError]', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader />
      <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0A0A0A', margin: '0 0 8px' }}>
          Failed to load workspaces
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#71717A', margin: '0 0 24px', lineHeight: 1.6 }}>
          {error.message}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '9px 20px', borderRadius: 8, fontSize: '0.875rem',
            fontWeight: 600, background: '#0A0A0A', color: '#FFFFFF',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      </main>
    </div>
  );
}
