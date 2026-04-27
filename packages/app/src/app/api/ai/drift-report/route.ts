// POST /api/ai/drift-report
// Accepts { artboard_id } — fetches artboard metadata + workspace DLF from DB,
// then calls generateDriftReport. Screenshots are optional; text-only analysis runs
// when the artboard has no renderUrl or the screenshot is not provided by the client.

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, generateDriftReport } from '@originmain/ai-layer';
import { serverClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    artboard_id?: string;
    /** Optional — client may pass a base64 screenshot captured from the live iframe */
    screenshot_base64?: string;
  };

  if (!body.artboard_id) {
    return NextResponse.json({ error: 'artboard_id is required' }, { status: 400 });
  }

  const db = serverClient();

  // Fetch artboard + verify the caller is a workspace member
  const { data: artboard } = await db
    .from('artboards')
    .select('id, name, workspace_id, project_id, metadata_jsonb')
    .eq('id', body.artboard_id)
    .single() as unknown as {
      data: {
        id: string;
        name: string;
        workspace_id: string;
        project_id: string | null;
        metadata_jsonb: Record<string, unknown>;
      } | null;
    };

  if (!artboard) {
    return NextResponse.json({ error: 'Artboard not found' }, { status: 404 });
  }

  // Auth gate: require workspace membership
  const { data: member } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', artboard.workspace_id)
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the most recently updated Design Language File for this workspace (optional)
  const { data: dlf } = await db
    .from('design_language_files')
    .select('schema_jsonb, name')
    .eq('workspace_id', artboard.workspace_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single() as unknown as { data: { schema_jsonb: unknown; name: string } | null };

  const meta = artboard.metadata_jsonb;
  const artboardContext = [
    `Artboard: ${artboard.name}`,
    `Size: ${meta['width'] ?? '?'} × ${meta['height'] ?? '?'}`,
    ...(meta['renderUrl'] ? [`Render URL: ${String(meta['renderUrl'])}`] : []),
    ...(artboard.project_id ? [`Project ID: ${artboard.project_id}`] : []),
  ].join('\n');

  try {
    const gateway = new AIGateway();
    const result = await generateDriftReport(gateway, {
      artboardContext,
      ...(dlf ? { dlfJson: JSON.stringify(dlf.schema_jsonb) } : {}),
      ...(body.screenshot_base64 ? { screenshotBase64: body.screenshot_base64 } : {}),
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
