// GET  /api/design-language?workspaceId=<uuid>  → active design language file
// POST /api/design-language                     → upsert (new version)

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { getActiveDesignLanguageFile } from '@originmain/origin-graph';
import type { InsertDesignLanguageFile } from '@originmain/origin-graph';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

  try {
    const db = serverClient();
    const file = await getActiveDesignLanguageFile(db, workspaceId);
    if (!file) return NextResponse.json(null, { status: 204 });
    return NextResponse.json(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as InsertDesignLanguageFile;
  const db = serverClient();

  // Compute the next version: max(existing) + 1.
  const existing = await getActiveDesignLanguageFile(db, body.workspace_id);
  const version = existing ? existing.version + 1 : 1;

  const { data, error } = await db
    .from('design_language_files')
    .insert({ ...body, version })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
