// POST   /api/workspace/:id/invite  → add a member by email address
// DELETE /api/workspace/:id/invite  → remove a member by email address (owners only)

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { addTeamMember, removeTeamMember } from '@originmain/origin-graph';
import type { TeamRole } from '@originmain/origin-graph';

type Ctx = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: Ctx) {
  const caller = await currentUser();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const callerEmail = caller.primaryEmailAddress?.emailAddress;
  if (!callerEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  // Only workspace owners can invite.
  const { data: ownerRow } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_email', callerEmail)
    .single();

  if (!ownerRow)
    return NextResponse.json({ error: 'Forbidden — only owners can invite members' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: TeamRole };

  if (!body.email || !EMAIL_RE.test(body.email))
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });

  const inviteEmail = body.email.toLowerCase().trim();
  const role: TeamRole = body.role ?? 'DESIGNER';

  // Check if already a member.
  const { data: existing } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', inviteEmail)
    .limit(1)
    .single();

  if (existing) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });

  try {
    const member = await addTeamMember(db, {
      workspace_id: workspaceId,
      email: inviteEmail,
      role,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const caller = await currentUser();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const callerEmail = caller.primaryEmailAddress?.emailAddress;
  if (!callerEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  if (!body.email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const targetEmail = body.email.toLowerCase().trim();

  // Owners can remove anyone; members can remove themselves.
  const { data: ownerRow } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_email', callerEmail)
    .single();

  if (!ownerRow && targetEmail !== callerEmail)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await removeTeamMember(db, workspaceId, targetEmail);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
