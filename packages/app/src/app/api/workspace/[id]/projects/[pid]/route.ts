// GET    /api/workspace/:id/projects/:pid  → fetch single project
// PATCH  /api/workspace/:id/projects/:pid  → update name / app_url / framework / description
// DELETE /api/workspace/:id/projects/:pid  → permanently delete project

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { updateProject, deleteProject } from '@originmain/origin-graph';
import type { InsertProject, Project } from '@originmain/origin-graph';

type Ctx = { params: Promise<{ id: string; pid: string }> };

async function assertMember(workspaceId: string, email: string): Promise<boolean> {
  const db = serverClient();
  const { data } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .limit(1)
    .single();
  return !!data;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const { id: workspaceId, pid } = await params;
  if (!(await assertMember(workspaceId, email)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await serverClient()
    .from('projects')
    .select('*')
    .eq('id', pid)
    .eq('workspace_id', workspaceId)
    .single() as unknown as { data: Project | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const { id: workspaceId, pid } = await params;
  if (!(await assertMember(workspaceId, email)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<InsertProject>;
  const patch: Partial<InsertProject> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if ('description' in body) patch.description = body.description ?? null;
  if ('app_url' in body) patch.app_url = body.app_url ?? null;
  if ('framework' in body) patch.framework = body.framework ?? null;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  try {
    const updated = await updateProject(serverClient(), pid, patch);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const { id: workspaceId, pid } = await params;
  if (!(await assertMember(workspaceId, email)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await deleteProject(serverClient(), pid);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
