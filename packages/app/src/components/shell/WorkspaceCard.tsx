'use client';

import Link from 'next/link';

interface WorkspaceCardProps {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
}

const PLAN_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  FREE:       { label: 'Free',       bg: 'rgba(0,0,0,0.05)',        color: '#52525B' },
  TEAM:       { label: 'Team',       bg: 'rgba(0,102,255,0.08)',    color: '#0066FF' },
  ENTERPRISE: { label: 'Enterprise', bg: 'rgba(124,58,237,0.08)',   color: '#7C3AED' },
};

export function WorkspaceCard({ id, name, plan, createdAt }: WorkspaceCardProps) {
  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE['FREE']!;

  return (
    <Link href={`/workspace/${id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 14,
          padding: '20px 22px',
          cursor: 'pointer',
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(51,133,255,0.35)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)';
        }}
      >
        {/* Workspace icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(0,102,255,0.07)', border: '1px solid rgba(0,102,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1.5" fill="#0066FF" opacity="0.7"/>
            <rect x="10" y="1.5" width="6.5" height="6.5" rx="1.5" fill="#0066FF" opacity="0.4"/>
            <rect x="1.5" y="10" width="6.5" height="6.5" rx="1.5" fill="#0066FF" opacity="0.4"/>
            <rect x="10" y="10" width="6.5" height="6.5" rx="1.5" fill="#0066FF" opacity="0.2"/>
          </svg>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--card-text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
            {name}
          </span>
          <span style={{
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
            textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99,
            background: badge.bg, color: badge.color, flexShrink: 0,
          }}>
            {badge.label}
          </span>
        </div>

        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--card-muted)' }}>
          Created {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8125rem', color: '#0066FF', fontWeight: 500 }}>
            Open workspace →
          </span>
        </div>
      </div>
    </Link>
  );
}
