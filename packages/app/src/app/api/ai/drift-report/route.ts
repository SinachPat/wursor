// POST /api/ai/drift-report
// Accepts { artboard_id } — fetches artboard metadata + workspace DLF from DB,
// then calls generateDriftReport. Screenshots are optional; text-only analysis runs
// when the artboard has no renderUrl or the screenshot is not provided by the client.

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, generateDriftReport } from '@originmain/ai-layer';
import { serverClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const callerEmail = user.primaryEmailAddress?.emailAddress;
  if (!callerEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

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
    .eq('email', callerEmail)
    .limit(1)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the active Design Language for this workspace (Phase 6 table).
  // raw_json holds the original uploaded token file; pass it to generateDriftReport
  // for context. Absence of a design language is non-fatal — analysis runs without it.
  const { data: dl } = await db
    .from('design_languages')
    .select('raw_json, name')
    .eq('workspace_id', artboard.workspace_id)
    .limit(1)
    .single() as unknown as { data: { raw_json: unknown; name: string } | null };

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
      ...(dl ? { dlfJson: JSON.stringify(dl.raw_json) } : {}),
      ...(body.screenshot_base64 ? { screenshotBase64: body.screenshot_base64 } : {}),
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
