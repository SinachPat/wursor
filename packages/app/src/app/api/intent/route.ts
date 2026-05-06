/**
 * POST /api/intent
 *
 * Canvas → Agent Bridge intent push endpoint (spec Phase 4 §8.4).
 *
 * The canvas calls this when the designer exports a style diff.  This route:
 *   1. Validates the authenticated user and payload
 *   2. Persists the intent to the `intent_diffs` Supabase table (durable)
 *   3. Enqueues the intent in the agent-bridge in-memory pending queue using
 *      the Supabase row UUID so the agent's update_diff_status tool can
 *      reference the same row by id
 *   4. Returns the intentId (Supabase UUID) so the canvas can track status
 *
 * The connected IDE agent drains the queue the next time it calls push_intent
 * (or receives an INTENT_RECEIVED WebSocket push in Phase 5+).
 */

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { storePendingIntent } from '@originmain/agent-bridge';
import { createDiff } from '@originmain/origin-graph';
import { serverClient } from '@/lib/supabase';

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
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorEmail = user.primaryEmailAddress?.emailAddress;
  if (!authorEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

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

  // ── 1. Persist to Supabase (durable) ──────────────────────────────────────
  let intentId: string;
  try {
    const db = serverClient();

    // Parse patchJson safely; fall back to wrapping it verbatim so the row
    // is always writable even if the client sends a malformed payload.
    let changesRecord: Record<string, unknown>;
    try {
      changesRecord = JSON.parse(patchJson) as Record<string, unknown>;
      // Wrap plain arrays (StylePatch[]) under a "patches" key so the column
      // type (jsonb object) is satisfied.
      if (Array.isArray(changesRecord)) {
        changesRecord = { patches: changesRecord, strategy };
      }
    } catch {
      changesRecord = { raw: patchJson, strategy };
    }

    const row = await createDiff(db, {
      artboard_id:        artboardId,
      author_email:       authorEmail,
      changes:            changesRecord,
      aggregate_summary:  summary ?? `${componentName} style changes`,
      status:             'EXPORTED',
    });

    intentId = row.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `DB insert failed: ${message}` }, { status: 500 });
  }

  // ── 2. Enqueue in agent-bridge (real-time poll / WebSocket path) ───────────
  // Pass the Supabase UUID so update_diff_status can reference the same row.
  storePendingIntent(workspaceId, {
    artboardId,
    componentName,
    patchJson,
    strategy,
    summary: summary ?? '',
  }, intentId);

  return NextResponse.json({ intentId, status: 'EXPORTED' }, { status: 201 });
}
