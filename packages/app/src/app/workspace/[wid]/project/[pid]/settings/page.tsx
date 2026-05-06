import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { AppHeader } from '@/components/shell/AppHeader';
import { ProjectSettingsForm } from '@/components/shell/ProjectSettingsForm';

export async function generateMetadata({ params }: { params: Promise<{ wid: string; pid: string }> }) {
  const { pid } = await params;
  const db = serverClient();
  const { data } = await db.from('projects').select('name').eq('id', pid).single() as unknown as {
    data: { name: string } | null;
  };
  return { title: `${data?.name ?? 'Project'} Settings — Originmain` };
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ wid: string; pid: string }>;
}) {
  const { wid, pid } = await params;
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const email = user.primaryEmailAddress?.emailAddress ?? '';
  const db = serverClient();

  // Verify membership and role
  const { data: member } = await db
    .from('team_members')
    .select('role')
    .eq('workspace_id', wid)
    .eq('email', email)
    .limit(1)
    .single() as unknown as { data: { role: string } | null };

  if (!member) redirect('/workspaces');

  // Fetch workspace name + project
  type WsRow  = { data: { name: string } | null };
  type ProjRow = { data: { id: string; name: string; description: string | null; app_url: string | null; framework: string | null } | null };

  const [wsResult, projResult] = await Promise.all([
    db.from('workspaces').select('name').eq('id', wid).single() as unknown as Promise<WsRow>,
    db.from('projects').select('id, name, description, app_url, framework').eq('id', pid).eq('workspace_id', wid).single() as unknown as Promise<ProjRow>,
  ]);

  if (!projResult.data) redirect(`/workspace/${wid}`);

  const project = projResult.data;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--page-bg)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      transition: 'background 0.2s',
    }}>
      <AppHeader breadcrumbs={[
        { label: 'Workspaces', href: '/workspaces' },
        { label: wsResult.data?.name ?? 'Workspace', href: `/workspace/${wid}` },
        { label: project.name, href: `/workspace/${wid}/project/${pid}` },
        { label: 'Settings' },
      ]} />

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--page-text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Project settings
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--card-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>
          Configure your project name, URL, and framework.
        </p>

        <ProjectSettingsForm
          workspaceId={wid}
          projectId={pid}
          initialName={project.name}
          initialDescription={project.description ?? ''}
          initialAppUrl={project.app_url ?? ''}
          initialFramework={project.framework ?? ''}
          memberRole={member.role}
        />
      </div>
    </div>
  );
}
