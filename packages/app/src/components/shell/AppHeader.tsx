'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

interface Crumb { label: string; href?: string }

interface AppHeaderProps {
  breadcrumbs?: Crumb[];
}

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 56,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,0,0,0.07)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      gap: 0,
    }}>
      {/* Logo */}
      <Link href="/workspaces" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0A0A0A' }}>
          Origin<span style={{ color: '#0066FF' }}>main</span>
        </span>
      </Link>

      {/* Breadcrumbs */}
      {breadcrumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ margin: '0 8px', color: '#D4D4D8', fontSize: '0.875rem' }}>/</span>
          {crumb.href ? (
            <Link href={crumb.href} style={{
              fontSize: '0.875rem', fontWeight: 500,
              color: '#71717A', textDecoration: 'none',
              transition: 'color 0.1s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0A0A0A')}
              onMouseLeave={e => (e.currentTarget.style.color = '#71717A')}
            >
              {crumb.label}
            </Link>
          ) : (
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0A0A0A' }}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}

      <div style={{ flex: 1 }} />

      <UserButton />
    </header>
  );
}
