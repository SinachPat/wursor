// POST   /api/workspace/:id/invite  → add a member by Clerk userId
// DELETE /api/workspace/:id/invite  → remove a member by Clerk userId (owners only)

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { addTeamMember, removeTeamMember } from '@originmain/origin-graph';
import type { TeamRole } from '@originmain/origin-graph';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  // Only workspace owners can invite
  const { data: owner } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single();

  if (!owner) return NextResponse.json({ error: 'Forbidden — only owners can invite members' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { userId?: string; role?: TeamRole };
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  const role: TeamRole = body.role ?? 'DESIGNER';

  // Check if already a member
  const { data: existing } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', body.userId)
    .limit(1)
    .single();

  if (existing) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });

  try {
    const member = await addTeamMember(db, {
      workspace_id: workspaceId,
      user_id: body.userId,
      role,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  // Only owners can remove; a member can remove themselves
  const { data: owner } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single();

  if (!owner && body.userId !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await removeTeamMember(db, workspaceId, body.userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
