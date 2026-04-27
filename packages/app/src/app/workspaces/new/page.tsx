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
    <div style={{ minHeight: '100dvh', background: '#FAFAFA', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader breadcrumbs={[{ label: 'Workspaces', href: '/workspaces' }, { label: 'New workspace' }]} />

      <main style={{ maxWidth: 480, margin: '64px auto', padding: '0 24px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '36px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0A0A0A', margin: '0 0 6px' }}>
            New workspace
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#71717A', margin: '0 0 28px', lineHeight: 1.5 }}>
            A workspace holds your projects and team. Give it a name — usually your company or team name.
          </p>

          <form onSubmit={handleCreate}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#3F3F46', marginBottom: 6 }}>
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
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
                color: '#0A0A0A', background: '#FFFFFF',
                fontFamily: 'inherit',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
            />

            {error && (
              <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <Link href="/workspaces" style={{
                flex: 1, textAlign: 'center',
                padding: '10px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
                color: '#3F3F46', background: '#F4F4F5', textDecoration: 'none',
              }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8,
                  fontSize: '0.875rem', fontWeight: 600,
                  background: name.trim() && !loading ? '#0A0A0A' : '#D4D4D8',
                  color: '#FFFFFF', border: 'none', cursor: name.trim() && !loading ? 'pointer' : 'default',
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
