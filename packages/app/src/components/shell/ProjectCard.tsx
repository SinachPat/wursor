'use client';

import Link from 'next/link';

interface ProjectCardProps {
  workspaceId: string;
  projectId: string;
  name: string;
  framework?: string | null;
  appUrl?: string | null;
  description?: string | null;
}

const FRAMEWORK_ICON: Record<string, string> = {
  next:    '▲',
  react:   '⚛',
  vue:     'V',
  svelte:  'S',
  angular: 'A',
  nuxt:    'N',
};

export function ProjectCard({ workspaceId, projectId, name, framework, appUrl, description }: ProjectCardProps) {
  const icon = framework ? (FRAMEWORK_ICON[framework.toLowerCase()] ?? '◻') : '◻';

  return (
    <Link href={`/workspace/${workspaceId}/project/${projectId}`} style={{ textDecoration: 'none' }}>
      <div
        data-tour="project-card"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 14, padding: '20px 22px', cursor: 'pointer',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: 'var(--card-icon-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem', color: 'var(--card-icon-fg)', fontWeight: 700, flexShrink: 0,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--card-text)', letterSpacing: '-0.01em' }}>
            {name}
          </span>
        </div>

        {appUrl && (
          <p style={{
            margin: '0 0 6px',
            fontSize: '0.75rem', fontFamily: 'monospace',
            color: 'var(--card-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {appUrl}
          </p>
        )}

        {description && (
          <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--card-muted)', lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8125rem', color: '#0066FF', fontWeight: 500 }}>
            Open canvas →
          </span>
        </div>
      </div>
    </Link>
  );
}
