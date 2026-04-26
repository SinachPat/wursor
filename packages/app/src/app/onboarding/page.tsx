'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const defaultName = isLoaded
    ? `${user?.firstName ?? user?.emailAddresses[0]?.emailAddress?.split('@')[0] ?? 'My'}'s Workspace`
    : '';

  const [name, setName]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const workspaceName = name.trim() || defaultName;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: workspaceName }),
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

  if (!isLoaded) return null;

  const firstName = user?.firstName ?? user?.emailAddresses[0]?.emailAddress?.split('@')[0] ?? 'there';

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAFA',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0A0A0A' }}>
        Origin<span style={{ color: '#0066FF' }}>main</span>
      </div>

      {/* Card */}
      <div style={{
        background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 20, padding: '44px 48px', maxWidth: 460, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 13,
          background: 'rgba(0,102,255,0.07)', border: '1px solid rgba(0,102,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="1.5" y="1.5" width="8.5" height="8.5" rx="2" fill="#0066FF" opacity="0.7"/>
            <rect x="12" y="1.5" width="8.5" height="8.5" rx="2" fill="#0066FF" opacity="0.3"/>
            <rect x="1.5" y="12" width="8.5" height="8.5" rx="2" fill="#0066FF" opacity="0.3"/>
            <rect x="12" y="12" width="8.5" height="8.5" rx="2" fill="#0066FF" opacity="0.15"/>
          </svg>
        </div>

        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#0A0A0A', margin: '0 0 8px' }}>
          Welcome, {firstName}!
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#71717A', lineHeight: 1.6, margin: '0 0 28px' }}>
          Let's create your workspace. A workspace holds your projects and team — usually named after your company or product.
        </p>

        <form onSubmit={handleCreate}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#3F3F46', marginBottom: 6 }}>
            Workspace name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={defaultName}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 13px', fontSize: '0.9375rem',
              border: '1px solid rgba(0,0,0,0.12)', borderRadius: 9,
              outline: 'none', color: '#0A0A0A', background: '#FFFFFF',
              fontFamily: 'inherit',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
          />
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#A1A1AA' }}>
            Leave blank to use "{defaultName}"
          </p>

          {error && <p style={{ margin: '10px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 24, width: '100%',
              padding: '12px', borderRadius: 9,
              fontSize: '0.9375rem', fontWeight: 600,
              background: loading ? '#D4D4D8' : '#0A0A0A',
              color: '#FFFFFF', border: 'none',
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? 'Creating workspace…' : (
              <>
                Create workspace
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: '0.8125rem', color: '#A1A1AA' }}>
        Already have a workspace?{' '}
        <a href="/workspaces" style={{ color: '#0066FF', textDecoration: 'none' }}>View all workspaces</a>
      </p>
    </main>
  );
}
