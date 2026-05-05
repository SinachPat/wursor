// POST /api/artboards/thumbnail
//
// Accepts a base64 JPEG data URL captured by html2canvas inside an artboard
// iframe, uploads it to Supabase Storage, and persists the public URL in the
// artboards.thumbnail_url column.
//
// Request body: { artboardId: string; workspaceId: string; dataUrl: string }
// Response:     { publicUrl: string }
//
// Storage path: artboard-thumbnails/{workspaceId}/{artboardId}.jpg
// Bucket policy: public read, authenticated write.
//
// spec: SOURCE-AWARE-CANVAS.md Phase 0 §3.6 "Thumbnail capture"

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { updateArtboard } from '@originmain/origin-graph';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET       = 'artboard-thumbnails';
const MAX_DATA_URL = 5 * 1024 * 1024; // 5 MB safety cap — rejects obviously corrupted payloads

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { artboardId?: string; workspaceId?: string; dataUrl?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { artboardId, workspaceId, dataUrl } = body;
  if (!artboardId || !workspaceId || !dataUrl) {
    return NextResponse.json({ error: 'artboardId, workspaceId, and dataUrl are required' }, { status: 400 });
  }

  if (dataUrl.length > MAX_DATA_URL) {
    return NextResponse.json({ error: 'dataUrl exceeds 5 MB limit' }, { status: 413 });
  }

  // Strip the `data:image/jpeg;base64,` prefix and decode to bytes
  const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  let imageBytes: Buffer;
  try {
    imageBytes = Buffer.from(base64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Invalid base64 data URL' }, { status: 400 });
  }

  const db = serverClient() as unknown as SupabaseClient;
  const storagePath = `${workspaceId}/${artboardId}.jpg`;

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, imageBytes, {
      contentType: 'image/jpeg',
      upsert: true, // overwrite on repeat capture
    });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // ── Get public URL ────────────────────────────────────────────────────────
  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // ── Persist to artboards.thumbnail_url ───────────────────────────────────
  try {
    await updateArtboard(serverClient(), artboardId, { thumbnail_url: publicUrl });
  } catch (err) {
    // Non-fatal: the in-memory data URL still works for this session
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[thumbnail] DB update failed for ${artboardId}: ${msg}`);
  }

  return NextResponse.json({ publicUrl });
}
