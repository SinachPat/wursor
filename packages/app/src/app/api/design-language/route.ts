// GET  /api/design-language?workspaceId=<uuid>         → active design language file
// GET  /api/design-language?workspaceId=<uuid>&all=1   → all versions (history)
// POST /api/design-language                            → upload new version (deactivates prior)

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { getActiveDesignLanguageFile } from '@originmain/origin-graph';
import type { InsertDesignLanguageFile, DesignLanguageFile } from '@originmain/origin-graph';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

  const db = serverClient();

  // Guard: caller must be a member of the target workspace.
  const { data: member } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ?all=1 returns the full version history, newest first.
  if (req.nextUrl.searchParams.get('all') === '1') {
    const { data, error } = await (db
      .from('design_language_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false }) as unknown as Promise<{
        data: DesignLanguageFile[];
        error: { message: string } | null;
      }>);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  // Default: return the single active file.
  try {
    const file = await getActiveDesignLanguageFile(db, workspaceId);
    if (!file) return NextResponse.json(null);
    return NextResponse.json(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: InsertDesignLanguageFile & { is_active?: boolean };
  try {
    body = (await req.json()) as InsertDesignLanguageFile & { is_active?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.workspace_id || !body.name || !body.schema_jsonb) {
    return NextResponse.json(
      { error: 'Missing required fields: workspace_id, name, schema_jsonb' },
      { status: 400 },
    );
  }

  const db = serverClient();

  // Guard: caller must be a member of the target workspace.
  const { data: postMember } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', body.workspace_id)
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (!postMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ── Compute next version number ────────────────────────────────────────────
  const existing = await getActiveDesignLanguageFile(db, body.workspace_id);
  const version  = existing ? existing.version + 1 : 1;

  // ── Deactivate all prior versions for this workspace ───────────────────────
  // This must happen before the insert so the partial unique index
  // (only one is_active = true per workspace) is not violated.
  if (existing) {
    const { error: deactivateError } = await (db
      .from('design_language_files')
      .update({ is_active: false })
      .eq('workspace_id', body.workspace_id) as unknown as Promise<{
        data: unknown;
        error: { message: string } | null;
      }>);
    if (deactivateError) {
      return NextResponse.json(
        { error: `Failed to deactivate previous version: ${deactivateError.message}` },
        { status: 500 },
      );
    }
  }

  // ── Insert new version as the active one ───────────────────────────────────
  const { data, error } = await (db
    .from('design_language_files')
    .insert({
      ...body,
      version,
      is_active:  true,
      created_by: userId,
    })
    .select()
    .single() as unknown as Promise<{
      data: DesignLanguageFile;
      error: { message: string } | null;
    }>);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
