// GET /api/workspace
// Returns the authenticated user's workspace. Auto-creates one on first visit
// (FREE plan, name derived from Clerk user display name or email).

import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import type { Workspace, InsertWorkspace } from '@originmain/origin-graph';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const db = serverClient();

  // Look up an existing workspace where this user is a member.
  const { data: existing } = await db
    .from('team_members')
    .select('workspace_id')
    .eq('email', email)
    .limit(1)
    .single() as unknown as { data: { workspace_id: string } | null };

  if (existing) {
    const { data: ws, error } = await db
      .from('workspaces')
      .select('*')
      .eq('id', existing.workspace_id)
      .single();
    if (!error && ws) return NextResponse.json(ws as Workspace);
  }

  // No workspace yet — auto-create one with a friendly name.
  const name = user.fullName ?? email;

  const insert: InsertWorkspace = {
    owner_email: email,
    name,
    plan: 'FREE',
    settings_jsonb: {},
  };

  const { data: created, error: insertError } = await db
    .from('workspaces')
    .insert(insert)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Add the owner as a team member so GET /api/workspaces can find it.
  await db.from('team_members').insert({
    workspace_id: (created as Workspace).id,
    email,
    role: 'OWNER',
  });

  return NextResponse.json(created as Workspace, { status: 201 });
}
