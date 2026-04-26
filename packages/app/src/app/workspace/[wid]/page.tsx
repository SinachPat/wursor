import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '@/lib/supabase';
import { AppHeader } from '@/components/shell/AppHeader';
import { ProjectCard } from '@/components/shell/ProjectCard';
import { DesignLanguageUpload } from '@/components/shell/DesignLanguageUpload';
import { getActiveDesignLanguageFile } from '@originmain/origin-graph';
import type { Workspace, Project } from '@originmain/origin-graph';

export async function generateMetadata({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const db = serverClient();
  const result = (await db.from('workspaces').select('name').eq('id', wid).single()) as unknown as { data: { name: string } | null };
  return { title: `${result.data?.name ?? 'Workspace'} — Originmain` };
}

export default async function WorkspacePage({ params }: { params: Promise<{ wid: string }> }) {
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

  // Fetch workspace + projects + design language in parallel
  const [{ data: wsData }, { data: projectsData }, designLanguage] = await Promise.all([
    db.from('workspaces').select('*').eq('id', wid).single(),
    db.from('projects').select('*').eq('workspace_id', wid).order('created_at', { ascending: true }),
    getActiveDesignLanguageFile(db, wid).catch(() => null),
  ]);

  if (!wsData) redirect('/workspaces');

  const workspace = wsData as Workspace;
  const projects = (projectsData ?? []) as Project[];

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader breadcrumbs={[
        { label: 'Workspaces', href: '/workspaces' },
        { label: workspace.name },
      ]} />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#0A0A0A', margin: 0 }}>
              Projects
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#71717A' }}>
              {projects.length === 0
                ? 'No projects yet — connect your first app to get started'
                : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link href={`/workspace/${wid}/project/new`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#0A0A0A', color: '#FFFFFF',
            fontSize: '0.875rem', fontWeight: 600,
            padding: '9px 18px', borderRadius: 9,
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            New project
          </Link>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div style={{
            background: '#FFFFFF', border: '1px dashed rgba(0,0,0,0.12)',
            borderRadius: 16, padding: '56px 40px', textAlign: 'center',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(0,102,255,0.07)', border: '1px solid rgba(0,102,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="4" width="18" height="14" rx="2.5" stroke="#0066FF" strokeWidth="1.5"/>
                <path d="M7 9.5l2.5 2.5L15 7" stroke="#0066FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0A0A0A', margin: '0 0 8px' }}>
              Connect your first app
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#71717A', margin: '0 0 24px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              A project connects to your running application — local or staging — so you can inspect components and ship intent-level diffs.
            </p>
            <Link href={`/workspace/${wid}/project/new`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#0066FF', color: '#FFFFFF',
              fontSize: '0.875rem', fontWeight: 600,
              padding: '10px 20px', borderRadius: 9, textDecoration: 'none',
            }}>
              Create a project →
            </Link>
          </div>
        )}

        {/* Project cards */}
        {projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                workspaceId={wid}
                projectId={project.id}
                name={project.name}
                framework={project.framework}
                appUrl={project.app_url}
                description={project.description}
              />
            ))}
          </div>
        )}
        {/* Design Language */}
        <DesignLanguageUpload workspaceId={wid} current={designLanguage} />

      </main>
    </div>
  );
}
