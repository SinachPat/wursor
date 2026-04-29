// POST /api/ai/completion-zone
// Fills a design completion zone given a component tree and user intent.
//
// Accepts two shapes:
//   Canvas UI payload:  { artboard_id, bounds, prompt, componentTreeJson? }
//   Canonical payload:  { componentTreeJson, intent, dlfJson?, screenshotBase64? }

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AIGateway, fillCompletionZone } from '@originmain/ai-layer';
import type { CompletionZoneInput } from '@originmain/ai-layer';
import { serverClient } from '@/lib/supabase';
import { getActiveDesignLanguageFile } from '@originmain/origin-graph';

// ── Canvas UI payload shape ───────────────────────────────────────────────────
interface CanvasPayload {
  artboard_id?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  prompt?: string;
  componentTreeJson?: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = (await req.json()) as CanvasPayload & Partial<CompletionZoneInput>;

  // ── Adapt canvas UI payload → CompletionZoneInput ────────────────────────
  let input: CompletionZoneInput;

  if (raw.intent !== undefined) {
    // Already canonical shape — pass through
    input = raw as CompletionZoneInput;
  } else {
    // Canvas UI shape: {artboard_id, bounds, prompt, componentTreeJson?}
    if (!raw.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Build a context string from bounds + artboard metadata if available
    const boundsLabel = raw.bounds
      ? `Canvas region: x=${raw.bounds.x}, y=${raw.bounds.y}, width=${raw.bounds.width}, height=${raw.bounds.height}`
      : '';

    // Try to load the active DLF for this workspace (best-effort — skip on error)
    let dlfJson: string | undefined;
    if (raw.artboard_id) {
      try {
        const db = serverClient();
        // Resolve workspace_id from artboard
        const { data: ab } = await db
          .from('artboards')
          .select('workspace_id')
          .eq('id', raw.artboard_id)
          .single();
        if (ab) {
          const dlf = await getActiveDesignLanguageFile(db, (ab as { workspace_id: string }).workspace_id);
          if (dlf) dlfJson = JSON.stringify(dlf.schema_jsonb);
        }
      } catch { /* non-fatal */ }
    }

    input = {
      componentTreeJson: raw.componentTreeJson ?? boundsLabel ?? '{}',
      intent: raw.prompt.trim(),
      ...(dlfJson !== undefined ? { dlfJson } : {}),
    };
  }

  try {
    const gateway = new AIGateway();
    const result = await fillCompletionZone(gateway, input);
    return NextResponse.json({
      proposedTree: result.proposedTree,
      description: result.description,
      // Also include result/completion for backwards-compat with any old clients
      result: result.description,
      completion: result.description,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
