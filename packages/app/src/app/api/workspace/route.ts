// GET /api/workspace
// Returns the authenticated user's workspace. Auto-creates one on first visit
// (FREE plan, name derived from Clerk user display name or email).

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import type { Workspace, InsertWorkspace } from '@originmain/origin-graph';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = serverClient();

  // Look up an existing workspace owned by this Clerk user.
  const { data: existing, error: findError } = await db
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json(existing as Workspace);
  }

  // No workspace yet — auto-create one. Fetch the Clerk user for a friendly name.
  const user = await currentUser();
  const name =
    user?.fullName ??
    user?.emailAddresses[0]?.emailAddress ??
    'My Workspace';

  const insert: InsertWorkspace = {
    owner_id: userId,
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

  // Also add the owner as a team member.
  await db.from('team_members').insert({
    workspace_id: (created as Workspace).id,
    user_id: userId,
    role: 'OWNER',
  });

  return NextResponse.json(created as Workspace, { status: 201 });
}
