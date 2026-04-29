// GET    /api/workspace/:id  → fetch workspace (any member)
// PATCH  /api/workspace/:id  → rename workspace (owner only)
// DELETE /api/workspace/:id  → delete workspace and all its data (owner only)

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { deleteWorkspace } from '@originmain/origin-graph';
import type { Workspace } from '@originmain/origin-graph';

type RouteContext = { params: Promise<{ id: string }> };

async function assertOwner(db: ReturnType<typeof import('@/lib/supabase').serverClient>, workspaceId: string, userId: string) {
  const { data } = await db
    .from('team_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .limit(1)
    .single();
  return (data as { role: string } | null)?.role === 'OWNER';
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = serverClient();

  // Verify membership
  const { data: member } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', id)
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await db.from('workspaces').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data as Workspace);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = serverClient();

  const isOwner = await assertOwner(db, id, userId);
  if (!isOwner) return NextResponse.json({ error: 'Only workspace owners can rename' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await db
    .from('workspaces')
    .update({ name: body.name.trim() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });

  return NextResponse.json(data as Workspace);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = serverClient();

  const isOwner = await assertOwner(db, id, userId);
  if (!isOwner) return NextResponse.json({ error: 'Only workspace owners can delete' }, { status: 403 });

  try {
    await deleteWorkspace(db, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
