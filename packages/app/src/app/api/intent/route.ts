/**
 * POST /api/intent
 *
 * Canvas → Agent Bridge intent push endpoint (spec Phase 4 §8.4).
 *
 * The canvas calls this when the designer exports a style diff.  This route:
 *   1. Validates the authenticated user and payload
 *   2. Stores the intent in the agent-bridge pending queue
 *   3. Returns the generated intentId so the canvas can track status
 *
 * The connected IDE agent drains the queue the next time it calls push_intent
 * (or receives an INTENT_RECEIVED WebSocket push in Phase 5+).
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { storePendingIntent } from '@originmain/agent-bridge';

interface IntentPayload {
  /** Supabase workspace ID. */
  workspaceId: string;
  /** The artboard the diff came from. */
  artboardId: string;
  /** Display name of the component that was edited. */
  componentName: string;
  /** JSON-serialised StylePatch[] from diff-generator.ts */
  patchJson: string;
  /** One of: 'css' | 'prop' | 'tailwind' */
  strategy: string;
  /** Optional AI-generated summary sentence. */
  summary?: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: IntentPayload;
  try {
    body = await req.json() as IntentPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, artboardId, componentName, patchJson, strategy, summary } = body;

  if (!workspaceId || !artboardId || !componentName || !patchJson || !strategy) {
    return NextResponse.json(
      { error: 'Missing required fields: workspaceId, artboardId, componentName, patchJson, strategy' },
      { status: 400 },
    );
  }

  const validStrategies = ['css', 'prop', 'tailwind'];
  if (!validStrategies.includes(strategy)) {
    return NextResponse.json(
      { error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const intentId = storePendingIntent(workspaceId, {
      artboardId,
      componentName,
      patchJson,
      strategy,
      summary: summary ?? '',
    });

    return NextResponse.json({ intentId, status: 'EXPORTED' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
