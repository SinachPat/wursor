import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { AppChrome } from '@/components/chrome/AppChrome';

export async function generateMetadata({ params }: { params: Promise<{ wid: string; pid: string }> }) {
  const { pid } = await params;
  const db = serverClient();
  const { data } = await db.from('projects').select('name').eq('id', pid).single() as unknown as Promise<{ data: { name: string } | null }> as unknown as { data: { name: string } | null };
  return { title: `${data?.name ?? 'Canvas'} — Originmain` };
}

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ wid: string; pid: string }>;
}) {
  const { wid, pid } = await params;
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

  // Fetch workspace name + project name for the breadcrumb
  type NameRow = { data: { name: string } | null };
  const [wsResult, projResult] = await Promise.all([
    db.from('workspaces').select('name').eq('id', wid).single() as unknown as Promise<NameRow>,
    db.from('projects').select('name').eq('id', pid).single() as unknown as Promise<NameRow>,
  ]);

  if (!projResult.data) redirect(`/workspace/${wid}`);

  return (
    <AppChrome
      workspaceId={wid}
      projectId={pid}
      workspaceName={wsResult.data?.name ?? 'Workspace'}
      projectName={projResult.data.name}
    />
  );
}
