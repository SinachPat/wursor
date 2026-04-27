import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '@/lib/supabase';
import { AppHeader } from '@/components/shell/AppHeader';
import { WorkspaceCard } from '@/components/shell/WorkspaceCard';
import type { Workspace } from '@originmain/origin-graph';

export const metadata = { title: 'Workspaces — Originmain' };

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
    <div style={{ minHeight: '100dvh', background: '#FAFAFA', fontFamily: "'Inter', -apple-system, sans-serif" }}>
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
          {workspaces.map(ws => (
            <WorkspaceCard
              key={ws.id}
              id={ws.id}
              name={ws.name}
              plan={ws.plan}
              createdAt={ws.created_at}
            />
          ))}
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
