import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { AppHeader } from '@/components/shell/AppHeader';
import { WorkspaceSettingsForm } from '@/components/shell/WorkspaceSettingsForm';
import type { Workspace } from '@originmain/origin-graph';

export async function generateMetadata({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const db = serverClient();
  const result = (await db.from('workspaces').select('name').eq('id', wid).single()) as unknown as { data: { name: string } | null };
  return { title: `${result.data?.name ?? 'Workspace'} Settings — Originmain` };
}

export default async function WorkspaceSettingsPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const db = serverClient();

  // Verify membership
  const { data: member } = await db
    .from('team_members')
    .select('id, role')
    .eq('workspace_id', wid)
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!member) redirect('/workspaces');

  const { data: wsData } = await db.from('workspaces').select('*').eq('id', wid).single();
  if (!wsData) redirect('/workspaces');

  const workspace = wsData as Workspace;
  const memberRole = (member as { role: string }).role;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader breadcrumbs={[
        { label: 'Workspaces', href: '/workspaces' },
        { label: workspace.name, href: `/workspace/${wid}` },
        { label: 'Settings' },
      ]} />

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#0A0A0A', margin: '0 0 4px' }}>
          Workspace settings
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: '0.875rem', color: '#71717A' }}>
          Manage {workspace.name}
        </p>

        <WorkspaceSettingsForm
          workspaceId={wid}
          workspaceName={workspace.name}
          memberRole={memberRole}
        />
      </main>
    </div>
  );
}
