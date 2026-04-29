'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/shell/AppHeader';

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    const ws = await res.json();
    router.push(`/workspace/${ws.id}`);
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader breadcrumbs={[{ label: 'Workspaces', href: '/workspaces' }, { label: 'New workspace' }]} />

      <main style={{ maxWidth: 480, margin: '64px auto', padding: '0 24px' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '36px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)', transition: 'background 0.2s' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--card-text)', margin: '0 0 6px' }}>
            New workspace
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--card-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
            A workspace holds your projects and team. Give it a name — usually your company or team name.
          </p>

          <form onSubmit={handleCreate}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--card-text)', marginBottom: 6 }}>
              Workspace name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Acme Inc."
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', fontSize: '0.9375rem',
                border: '1px solid var(--input-border)', borderRadius: 8,
                color: 'var(--input-text)', background: 'var(--input-bg)',
                fontFamily: 'inherit',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--input-border)')}
            />

            {error && (
              <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <Link href="/workspaces" style={{
                flex: 1, textAlign: 'center',
                padding: '10px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
                color: 'var(--btn-idle-fg)', background: 'var(--card-subtle)', textDecoration: 'none',
              }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8,
                  fontSize: '0.875rem', fontWeight: 600,
                  background: name.trim() && !loading ? 'var(--btn-bg)' : 'var(--card-subtle)',
                  color: name.trim() && !loading ? 'var(--btn-fg)' : 'var(--card-muted)',
                  border: 'none', cursor: name.trim() && !loading ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                }}
              >
                {loading ? 'Creating…' : 'Create workspace →'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
