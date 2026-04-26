// GET  /api/workspace/[id]/projects  — list projects in a workspace
// POST /api/workspace/[id]/projects  — create a new project

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import type { Project, InsertProject } from '@originmain/origin-graph';

async function assertMember(db: ReturnType<typeof serverClient>, workspaceId: string, userId: string) {
  const { data } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .limit(1)
    .single();
  return !!data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  if (!(await assertMember(db, workspaceId, userId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data as Project[]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  if (!(await assertMember(db, workspaceId, userId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const insert: InsertProject = {
    workspace_id: workspaceId,
    name,
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
    app_url:     typeof body.app_url === 'string'     ? body.app_url.trim()     || null : null,
    framework:   typeof body.framework === 'string'   ? body.framework.trim()   || null : null,
  };

  const { data, error } = await db
    .from('projects')
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data as Project, { status: 201 });
}
