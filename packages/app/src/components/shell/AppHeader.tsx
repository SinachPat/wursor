'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { useTheme } from '@/store/theme';
import { useWalkthrough } from '@/store/walkthrough';

interface Crumb { label: string; href?: string }

interface AppHeaderProps {
  breadcrumbs?: Crumb[];
  /** @deprecated Pass breadcrumbs instead */
  workspaceName?: string;
  /** @deprecated Pass breadcrumbs instead */
  workspaceId?: string;
}

export function AppHeader({ breadcrumbs = [], workspaceName, workspaceId }: AppHeaderProps) {
  const { mode, toggle } = useTheme();
  const startTour = useWalkthrough((s) => s.start);

  // Back-compat: if old props are passed without breadcrumbs, synthesise them
  const crumbs: Crumb[] = breadcrumbs.length > 0
    ? breadcrumbs
    : workspaceName
      ? [
          { label: 'Workspaces', href: '/workspaces' as string },
          ...(workspaceId
            ? [{ label: workspaceName, href: `/workspace/${workspaceId}` as string }]
            : [{ label: workspaceName }]),
        ]
      : [];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 56,
      background: mode === 'dark' ? 'rgba(12,12,16,0.92)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: mode === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      gap: 0,
    }}>
      {/* Logo */}
      <Link href="/workspaces" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: mode === 'dark' ? '#FAFAFA' : '#0A0A0A' }}>
          Origin<span style={{ color: '#0066FF' }}>main</span>
        </span>
      </Link>

      {/* Breadcrumbs */}
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ margin: '0 8px', color: mode === 'dark' ? 'rgba(255,255,255,0.2)' : '#D4D4D8', fontSize: '0.875rem' }}>/</span>
          {crumb.href ? (
            <Link href={crumb.href} style={{
              fontSize: '0.875rem', fontWeight: 500,
              color: mode === 'dark' ? 'rgba(255,255,255,0.45)' : '#71717A',
              textDecoration: 'none',
              transition: 'color 0.1s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = mode === 'dark' ? 'rgba(255,255,255,0.85)' : '#0A0A0A')}
              onMouseLeave={e => (e.currentTarget.style.color = mode === 'dark' ? 'rgba(255,255,255,0.45)' : '#71717A')}
            >
              {crumb.label}
            </Link>
          ) : (
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: mode === 'dark' ? '#FAFAFA' : '#0A0A0A' }}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}

      <div style={{ flex: 1 }} />

      {/* Tour trigger */}
      <button
        onClick={startTour}
        title="Start product tour"
        aria-label="Start product tour"
        style={{
          background: 'none', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
          cursor: 'pointer',
          color: mode === 'dark' ? 'rgba(255,255,255,0.4)' : '#A1A1AA',
          width: 26, height: 26, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 600, marginRight: 8,
          transition: 'color 0.12s, background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#3385FF';
          e.currentTarget.style.borderColor = 'rgba(51,133,255,0.45)';
          e.currentTarget.style.background = 'rgba(51,133,255,0.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = mode === 'dark' ? 'rgba(255,255,255,0.4)' : '#A1A1AA';
          e.currentTarget.style.borderColor = mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
          e.currentTarget.style.background = 'none';
        }}
      >
        ?
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: mode === 'dark' ? 'rgba(255,255,255,0.4)' : '#A1A1AA',
          padding: '6px 8px', marginRight: 8,
          display: 'flex', alignItems: 'center', borderRadius: 6,
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
          /* Sun */
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        ) : (
          /* Moon */
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <path d="M12 8.5A5.5 5.5 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <UserButton />
    </header>
  );
}
