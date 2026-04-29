import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '@/lib/supabase';
import { AppHeader } from '@/components/shell/AppHeader';
import type { Workspace } from '@originmain/origin-graph';

export async function generateMetadata({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const db = serverClient();
  const result = (await db.from('workspaces').select('name').eq('id', wid).single()) as unknown as { data: { name: string } | null };
  return { title: `Plugins — ${result.data?.name ?? 'Workspace'} — Originmain` };
}

export default async function WorkspacePluginsPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const db = serverClient();

  // Verify membership
  const { data: member } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', wid)
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!member) redirect('/workspaces');

  const { data: ws } = await db.from('workspaces').select('*').eq('id', wid).single();
  const workspace = ws as Workspace | null;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <AppHeader workspaceName={workspace?.name ?? 'Workspace'} workspaceId={wid} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, fontSize: '0.8125rem', color: '#71717A' }}>
          <Link href="/workspaces" style={{ color: '#71717A', textDecoration: 'none' }}>Workspaces</Link>
          <span>/</span>
          <Link href={`/workspace/${wid}`} style={{ color: '#71717A', textDecoration: 'none' }}>{workspace?.name ?? 'Workspace'}</Link>
          <span>/</span>
          <span style={{ color: '#09090B' }}>Plugins</span>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#09090B', margin: '0 0 8px' }}>
          Plugins
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#52525B', margin: '0 0 40px', lineHeight: 1.6 }}>
          Extend Originmain with custom completion zones, ingestion connectors, and design tools.
        </p>

        {/* Coming soon card */}
        <div style={{
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
          padding: '40px 36px', textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(51,133,255,0.08)', border: '1px solid rgba(51,133,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            {/* Puzzle icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v3h1a2 2 0 0 1 0 4h-1v3a1 1 0 0 1-1 1h-3v1a2 2 0 0 1-4 0v-1H7a1 1 0 0 1-1-1v-3H5a2 2 0 0 1 0-4h1V6a1 1 0 0 1 1-1h3V4a2 2 0 0 1 2-2z" stroke="#3385FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#09090B', margin: '0 0 10px', letterSpacing: '-0.015em' }}>
            Plugin marketplace — coming in Phase 4
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#71717A', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.65 }}>
            The plugin API lets teams register custom AI completion zones, custom webhook ingesters, and design-language extensions — all sandboxed and permission-scoped.
          </p>

          {/* Permissions preview */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
            {[
              'artboards:read', 'artboards:write', 'diffs:read', 'diffs:export',
              'completion-zones:register', 'ingesters:register', 'design-language:read',
            ].map(scope => (
              <span key={scope} style={{
                fontSize: '0.6875rem', fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                background: 'rgba(51,133,255,0.07)', color: '#3385FF',
                border: '1px solid rgba(51,133,255,0.18)',
                borderRadius: 6, padding: '3px 8px',
                letterSpacing: '-0.01em',
              }}>
                {scope}
              </span>
            ))}
          </div>

          <Link
            href={`/workspace/${wid}/settings`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.875rem', fontWeight: 500, color: '#3385FF',
              textDecoration: 'none',
            }}
          >
            Back to settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
