// POST /api/ai/diff-summary
// Generates a one-sentence natural-language summary of a set of component changes.

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, generateDiffSummary } from '@originmain/ai-layer';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { changesJson?: string; componentName?: string };

  if (!body.changesJson) {
    return NextResponse.json({ error: 'changesJson is required' }, { status: 400 });
  }

  try {
    const gateway = new AIGateway();
    const result = await generateDiffSummary(gateway, {
      changesJson: body.changesJson,
      componentName: body.componentName ?? 'Component',
    });
    return NextResponse.json({ summary: result.summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
