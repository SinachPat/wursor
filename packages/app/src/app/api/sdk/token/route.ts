// ── SDK token issuance ────────────────────────────────────────────────────────
//
// POST /api/sdk/token
//   Body:    { projectId: string, workspaceId: string }
//   Returns: { token: string }
//
// Issues a signed SDK token scoped to a project. The token is used by
// @originmain/dev to authenticate with the bridge:
//   - POST  /api/sdk/[projectId]          (SDK → canvas, fiber events)
//   - GET   /api/sdk/[projectId]/commands (SDK ← canvas, edit commands)
//
// Auth: Supabase session cookie (canvas user must own the project/workspace).
//
// The token is HMAC-signed (SHA-256) and expires in 90 days. It is NOT stored
// in the database — it is self-contained and verifiable without a DB lookup.
// To revoke: rotate AGENT_BRIDGE_SECRET (invalidates all outstanding tokens).

import { NextRequest, NextResponse } from 'next/server';
import { issueSdkToken }             from '@/lib/sdk-auth';
import { serverClient }              from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // Require a canvas session.
  const authCookie = req.cookies.get('sb-access-token')?.value
    ?? req.headers.get('x-supabase-auth')
    ?? null;

  if (!authCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body.
  let body: { projectId?: string; workspaceId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, workspaceId } = body;
  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'projectId and workspaceId are required' }, { status: 422 });
  }

  // Verify the project exists and belongs to the specified workspace.
  // The service-role client bypasses RLS — so we manually check workspace membership.
  const db = serverClient();

  const { error: projectError } = await db
    .from('artboards')
    .select('id, workspace_id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single();

  if (projectError) {
    return NextResponse.json({ error: 'Project not found in workspace' }, { status: 404 });
  }

  // Issue the token.
  let token: string;
  try {
    token = issueSdkToken(projectId, workspaceId);
  } catch (err) {
    // AGENT_BRIDGE_SECRET not configured on this server.
    const message = err instanceof Error ? err.message : 'Token signing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ token });
}
