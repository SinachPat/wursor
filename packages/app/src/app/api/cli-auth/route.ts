// GET /api/cli-auth?callback=<url>
//
// Browser-initiated CLI auth endpoint. The user arrives here after `originmain
// login` opens their browser. Authenticates via Clerk, issues a HMAC workspace
// token, and redirects to the CLI's local callback server with the credentials.
//
// Query params:
//   callback      — The local CLI callback URL (must be localhost).
//   workspace_id  — Optional. If omitted, uses the user's first workspace.
//
// Redirect target: <callback>?token=X&workspaceId=Y&bridgeUrl=Z
//                  or <callback>?error=<message> on failure.
//
// Security:
//   • callback must be a localhost URL — external URLs are rejected.
//   • Requires Clerk authentication; unauthenticated users are redirected to sign-in.
//
// spec: SOURCE-AWARE-CANVAS.md Phase 5 §8.6

import { auth }         from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { issueWorkspaceToken } from '@originmain/agent-bridge';

const DEFAULT_BRIDGE_URL = process.env['ORIGINMAIN_BRIDGE_URL'] ?? 'http://localhost:4172';
const APP_URL            = process.env['NEXT_PUBLIC_APP_URL']   ?? 'http://localhost:3000';

/** Only localhost callback URLs are accepted — prevents open-redirect attacks. */
function isLocalhostCallback(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return false;
  }
}

function errorRedirect(callbackUrl: string, message: string): NextResponse {
  const target = new URL(callbackUrl);
  target.searchParams.set('error', message);
  return NextResponse.redirect(target.toString());
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const callbackUrl = searchParams.get('callback');
  const workspaceIdParam = searchParams.get('workspace_id');

  // ── Validate callback URL ─────────────────────────────────────────────────
  if (!callbackUrl) {
    return NextResponse.json({ error: '`callback` query param is required' }, { status: 400 });
  }

  if (!isLocalhostCallback(callbackUrl)) {
    return NextResponse.json(
      { error: '`callback` must be a localhost URL' },
      { status: 400 },
    );
  }

  // ── Require authentication ────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    // Redirect to sign-in, then back here after login
    const signInUrl = new URL('/sign-in', APP_URL);
    signInUrl.searchParams.set('redirect_url', req.nextUrl.toString());
    return NextResponse.redirect(signInUrl.toString());
  }

  // ── Resolve workspace ─────────────────────────────────────────────────────
  const db = serverClient();
  let workspaceId = workspaceIdParam;

  if (!workspaceId) {
    // Use the user's first workspace membership
    const { data: member } = await db
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .single() as unknown as { data: { workspace_id: string } | null; error: unknown };

    if (!member) {
      return errorRedirect(callbackUrl, 'No workspace found for this account. Create a workspace at ' + APP_URL);
    }
    workspaceId = member.workspace_id;
  } else {
    // Verify the user is a member of the requested workspace
    const { data: member } = await db
      .from('team_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!member) {
      return errorRedirect(callbackUrl, `You are not a member of workspace ${workspaceId}`);
    }
  }

  // ── Issue workspace token ─────────────────────────────────────────────────
  let token: string;
  try {
    token = issueWorkspaceToken(workspaceId, 'GENERIC');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token generation failed';
    return errorRedirect(callbackUrl, msg);
  }

  // ── Redirect to CLI callback ──────────────────────────────────────────────
  const target = new URL(callbackUrl);
  target.searchParams.set('token',       token);
  target.searchParams.set('workspaceId', workspaceId);
  target.searchParams.set('bridgeUrl',   DEFAULT_BRIDGE_URL);

  return NextResponse.redirect(target.toString());
}
