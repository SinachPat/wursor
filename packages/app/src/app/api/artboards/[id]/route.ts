// GET /api/artboards/:id → fetch single artboard

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { getArtboard } from '@originmain/origin-graph';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const db = serverClient();
    const artboard = await getArtboard(db, id);
    return NextResponse.json(artboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('not found') || message.includes('0 rows') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
