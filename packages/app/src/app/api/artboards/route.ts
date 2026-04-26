// GET  /api/artboards?workspaceId=<uuid>  → list artboards for workspace
// POST /api/artboards                     → create artboard

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { getArtboards, createArtboard } from '@originmain/origin-graph';
import type { InsertArtboard } from '@originmain/origin-graph';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

  try {
    const db = serverClient();
    const artboards = await getArtboards(db, workspaceId);
    return NextResponse.json(artboards);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as InsertArtboard;

  try {
    const db = serverClient();
    const artboard = await createArtboard(db, body);
    return NextResponse.json(artboard, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
