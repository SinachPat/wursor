// POST /api/workspace/:id/tokens
// Issues a signed HMAC workspace token for IDE integrations (Cursor, Claude Code).
// Returns the token plus ready-to-paste config snippets for each IDE.

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import {
  issueWorkspaceToken,
  generateCursorConfig,
  generateClaudeCodeConfig,
} from '@originmain/agent-bridge';
import type { AgentType } from '@originmain/agent-bridge';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const { id: workspaceId } = await params;
  const db = serverClient();

  // Verify membership.
  const { data: member } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .limit(1)
    .single();

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    agentType?: AgentType;
    workspaceName?: string;
    projectName?: string;
  };

  const agentType: AgentType = body.agentType ?? 'GENERIC';
  const workspaceName = body.workspaceName ?? 'My Workspace';

  try {
    const token = issueWorkspaceToken(workspaceId, agentType);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const mcpServerUrl = `${appUrl}/api/agent-bridge`;

    const cursorConfig = generateCursorConfig({ mcpServerUrl, workspaceToken: token, workspaceName });
    const claudeCodeConfig = generateClaudeCodeConfig({
      mcpServerUrl,
      workspaceToken: token,
      workspaceName,
      ...(body.projectName !== undefined ? { projectName: body.projectName } : {}),
    });

    return NextResponse.json({ token, cursorConfig, claudeCodeConfig });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
