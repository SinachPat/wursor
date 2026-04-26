// GET    /api/artboards/:id  → fetch single artboard
// PATCH  /api/artboards/:id  → update name / metadata_jsonb
// DELETE /api/artboards/:id  → permanently remove artboard

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { getArtboard, updateArtboard, deleteArtboard } from '@originmain/origin-graph';
import type { InsertArtboard } from '@originmain/origin-graph';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const artboard = await getArtboard(serverClient(), id);
    return NextResponse.json(artboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('0 rows') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<InsertArtboard>;

  // Only allow safe fields to be patched
  const patch: Partial<InsertArtboard> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (body.metadata_jsonb !== undefined) patch.metadata_jsonb = body.metadata_jsonb;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  try {
    const updated = await updateArtboard(serverClient(), id, patch);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await deleteArtboard(serverClient(), id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
