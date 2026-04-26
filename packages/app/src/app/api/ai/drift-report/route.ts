// POST /api/ai/drift-report
// Analyzes a screenshot against the active Design Language File for drift violations.

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, generateDriftReport } from '@originmain/ai-layer';
import type { DriftReportInput } from '@originmain/ai-layer';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as DriftReportInput;

  try {
    const gateway = new AIGateway();
    const result = await generateDriftReport(gateway, body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
