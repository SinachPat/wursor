import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '@/lib/supabase';
import { AppHeader } from '@/components/shell/AppHeader';
import type { Workspace } from '@originmain/origin-graph';

export const metadata = { title: 'Workspaces — Originmain' };

const PLAN_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  FREE:       { label: 'Free',       bg: 'rgba(0,0,0,0.05)',        color: '#52525B' },
  TEAM:       { label: 'Team',       bg: 'rgba(0,102,255,0.08)',    color: '#0066FF' },
  ENTERPRISE: { label: 'Enterprise', bg: 'rgba(124,58,237,0.08)',   color: '#7C3AED' },
};

async function getWorkspaces(userId: string): Promise<Workspace[]> {
  const db = serverClient();
  const { data: memberships } = await db
    .from('team_members')
    .select('workspace_id')
    .eq('user_id', userId);

  const ids = (memberships ?? []).map((m) => (m as { workspace_id: string }).workspace_id);
  if (ids.length === 0) return [];

  const { data } = await db
    .from('workspaces')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: true });

  return (data ?? []) as Workspace[];
}

export default async function WorkspacesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspaces = await getWorkspaces(userId);

  // New user with no workspaces yet → send to onboarding
  if (workspaces.length === 0) redirect('/onboarding');

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>

        {/* Page title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#0A0A0A', margin: 0 }}>
              Workspaces
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#71717A' }}>
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </p>
          </div>
          <NewWorkspaceButton />
        </div>

        {/* Workspace cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {workspaces.map(ws => {
            const badge = PLAN_BADGE[ws.plan] ?? PLAN_BADGE['FREE']!;
            return (
              <Link key={ws.id} href={`/workspace/${ws.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(0,0,0,0.07)',
                  borderRadius: 14,
                  padding: '20px 22px',
                  cursor: 'pointer',
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
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                      {ws.name}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
                      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99,
                      background: badge.bg, color: badge.color, flexShrink: 0,
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#A1A1AA' }}>
                    Created {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>

                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8125rem', color: '#0066FF', fontWeight: 500 }}>
                      Open workspace →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// Client button for creating a new workspace (needs interactivity)
function NewWorkspaceButton() {
  return (
    <Link href="/workspaces/new" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#0A0A0A', color: '#FFFFFF',
      fontSize: '0.875rem', fontWeight: 600,
      padding: '9px 18px', borderRadius: 9,
      textDecoration: 'none', letterSpacing: '-0.01em',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      New workspace
    </Link>
  );
}
