// POST /api/ai/query
// Cross-artboard search: finds artboards matching a natural language query.
//
// Accepts two shapes:
//   Navigator UI payload: { workspace_id, question }
//   Canonical payload:    { query, artboardsJson }

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, queryCrossArtboard } from '@originmain/ai-layer';
import type { ArtboardQueryInput } from '@originmain/ai-layer';
import { serverClient } from '@/lib/supabase';
import { getArtboards } from '@originmain/origin-graph';

interface NavigatorPayload {
  workspace_id?: string;
  question?: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = (await req.json()) as NavigatorPayload & Partial<ArtboardQueryInput>;

  // ── Adapt navigator UI payload → ArtboardQueryInput ──────────────────────
  let input: ArtboardQueryInput;

  if (raw.query !== undefined && raw.artboardsJson !== undefined) {
    // Already canonical
    input = raw as ArtboardQueryInput;
  } else {
    // Navigator UI shape: { workspace_id, question }
    const queryText = (raw.question ?? raw.query ?? '').trim();
    if (!queryText) return NextResponse.json({ error: 'question is required' }, { status: 400 });

    const workspaceId = raw.workspace_id;
    if (!workspaceId) return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });

    // Fetch artboard metadata to give the AI context
    let artboardsJson = '[]';
    try {
      const db = serverClient();
      const artboards = await getArtboards(db, workspaceId);
      artboardsJson = JSON.stringify(
        artboards.map(ab => ({
          id: ab.id,
          name: ab.name,
          metadata: ab.metadata_jsonb,
          created_at: ab.created_at,
        }))
      );
    } catch { /* non-fatal: AI will work with empty list */ }

    input = { query: queryText, artboardsJson };
  }

  try {
    const gateway = new AIGateway();
    const result = await queryCrossArtboard(gateway, input);

    // Return both the canonical shape AND a human-readable answer string
    // so the navigator UI's `data.answer ?? data.result` check gets something useful.
    const answerText = result.reasoning ||
      (result.results.length > 0
        ? result.results.map(r => `${r.artboardId}: ${r.reason}`).join('\n')
        : 'No matching artboards found.');

    return NextResponse.json({ ...result, answer: answerText, result: answerText });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
