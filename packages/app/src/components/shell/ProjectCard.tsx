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
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 14, padding: '20px 22px', cursor: 'pointer',
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.12)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.07)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: '#0A0A0A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem', color: '#FFFFFF', fontWeight: 700, flexShrink: 0,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.01em' }}>
            {name}
          </span>
        </div>

        {appUrl && (
          <p style={{
            margin: '0 0 6px',
            fontSize: '0.75rem', fontFamily: 'monospace',
            color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {appUrl}
          </p>
        )}

        {description && (
          <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#71717A', lineHeight: 1.5 }}>
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
