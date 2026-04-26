// POST /api/ai/query
// Cross-artboard search: finds artboards matching a natural language query.

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, queryCrossArtboard } from '@originmain/ai-layer';
import type { ArtboardQueryInput } from '@originmain/ai-layer';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as ArtboardQueryInput;

  try {
    const gateway = new AIGateway();
    const result = await queryCrossArtboard(gateway, body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
