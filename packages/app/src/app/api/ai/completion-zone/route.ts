// POST /api/ai/completion-zone
// Fills a design completion zone given a component tree and user intent.

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, fillCompletionZone } from '@originmain/ai-layer';
import type { CompletionZoneInput } from '@originmain/ai-layer';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as CompletionZoneInput;

  try {
    const gateway = new AIGateway();
    const result = await fillCompletionZone(gateway, body);
    return NextResponse.json({ proposedTree: result.proposedTree, description: result.description });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
