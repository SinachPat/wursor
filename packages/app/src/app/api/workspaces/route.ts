// GET  /api/workspaces  — list every workspace the signed-in user belongs to
// POST /api/workspaces  — create a new workspace + add creator as OWNER

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import type { Workspace, InsertWorkspace } from '@originmain/origin-graph';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const db = serverClient();

  // Fetch all workspace IDs the user is a member of, then join workspaces.
  const { data: memberships, error: mErr } = await db
    .from('team_members')
    .select('workspace_id')
    .eq('email', email);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const ids = (memberships ?? []).map((m) => (m as { workspace_id: string }).workspace_id);
  if (ids.length === 0) return NextResponse.json([]);

  const { data: workspaces, error: wErr } = await db
    .from('workspaces')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: true });

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

  return NextResponse.json(workspaces as Workspace[]);
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim()
    : null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const db = serverClient();

  const insert: InsertWorkspace = {
    owner_email: email,
    name,
    plan: 'FREE',
    settings_jsonb: {},
  };

  const { data: created, error: insertErr } = await db
    .from('workspaces')
    .insert(insert)
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const workspace = created as Workspace;

  // Add creator as OWNER team member so GET /api/workspaces can find it.
  await db.from('team_members').insert({
    workspace_id: workspace.id,
    email,
    role: 'OWNER',
  });

  return NextResponse.json(workspace, { status: 201 });
}
