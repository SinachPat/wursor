'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/store/theme';

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { mode, toggle } = useTheme();

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
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--page-bg)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      padding: '24px',
      position: 'relative',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: mode === 'dark' ? 'rgba(255,255,255,0.4)' : '#A1A1AA',
          padding: '7px', display: 'flex', alignItems: 'center', borderRadius: 8,
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = mode === 'dark' ? 'rgba(255,255,255,0.85)' : '#0A0A0A';
          e.currentTarget.style.background = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = mode === 'dark' ? 'rgba(255,255,255,0.4)' : '#A1A1AA';
          e.currentTarget.style.background = 'none';
        }}
      >
        {mode === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M12 8.5A5.5 5.5 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {/* Logo */}
      <div style={{ marginBottom: 40, fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--page-text)' }}>
        Origin<span style={{ color: '#0066FF' }}>main</span>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 20, padding: '44px 48px', maxWidth: 460, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)', transition: 'background 0.2s',
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

        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--card-text)', margin: '0 0 8px' }}>
          Welcome, {firstName}!
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--card-muted)', lineHeight: 1.6, margin: '0 0 28px' }}>
          Let's create your workspace. A workspace holds your projects and team — usually named after your company or product.
        </p>

        <form onSubmit={handleCreate}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--card-text)', marginBottom: 6 }}>
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
              border: '1px solid var(--input-border)', borderRadius: 9,
              color: 'var(--input-text)', background: 'var(--input-bg)',
              fontFamily: 'inherit',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--input-border)')}
          />
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--card-muted)' }}>
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
              background: loading ? 'var(--card-subtle)' : 'var(--btn-bg)',
              color: loading ? 'var(--card-muted)' : 'var(--btn-fg)', border: 'none',
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
