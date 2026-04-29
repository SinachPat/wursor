'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/shell/AppHeader';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[WorkspaceError]', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader breadcrumbs={[{ label: 'Workspaces', href: '/workspaces' }]} />
      <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0A0A0A', margin: '0 0 8px' }}>
          Failed to load workspace
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#71717A', margin: '0 0 24px', lineHeight: 1.6 }}>
          {error.message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
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
          <Link
            href="/workspaces"
            style={{
              padding: '9px 20px', borderRadius: 8, fontSize: '0.875rem',
              fontWeight: 600, background: '#F4F4F5', color: '#3F3F46',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}
          >
            All workspaces
          </Link>
        </div>
      </main>
    </div>
  );
}
