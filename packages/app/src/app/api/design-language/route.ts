// GET  /api/design-language?workspaceId=<uuid>         → active DesignLanguage row
// GET  /api/design-language?workspaceId=<uuid>&all=1   → version history (newest first)
// POST /api/design-language                            → upload / replace token file

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import {
  getDesignLanguage,
  upsertDesignLanguage,
  getDesignLanguageVersions,
} from '@originmain/origin-graph';
import type { InsertDesignLanguage } from '@originmain/origin-graph';

// ── Auth + workspace-member guard (shared) ────────────────────────────────────

async function assertMember(email: string, workspaceId: string) {
  const db = serverClient();
  const { data } = await db
    .from('team_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .limit(1)
    .single();
  return Boolean(data);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  if (!(await assertMember(email, workspaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = serverClient();

  // ?all=1 — full version history for the workspace's design language.
  if (req.nextUrl.searchParams.get('all') === '1') {
    const dl = await getDesignLanguage(db, workspaceId).catch(() => null);
    if (!dl) return NextResponse.json([]);
    const versions = await getDesignLanguageVersions(db, dl.id).catch(() => []);
    return NextResponse.json(versions);
  }

  // Default — active token file (one row per workspace).
  const dl = await getDesignLanguage(db, workspaceId).catch((err: Error) => {
    throw new Response(JSON.stringify({ error: err.message }), { status: 500 });
  });
  return NextResponse.json(dl ?? null);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  let body: Partial<InsertDesignLanguage>;
  try {
    body = (await req.json()) as Partial<InsertDesignLanguage>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspace_id, name, raw_json, normalized, source_format, token_count } = body;

  if (!workspace_id || !raw_json || !normalized || !source_format) {
    return NextResponse.json(
      { error: 'Missing required fields: workspace_id, raw_json, normalized, source_format' },
      { status: 400 },
    );
  }

  if (!(await assertMember(email, workspace_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = serverClient();

  // Determine next version number: current + 1, or 1 for first upload.
  const existing = await getDesignLanguage(db, workspace_id).catch(() => null);
  const version  = existing ? existing.version + 1 : 1;

  const row: InsertDesignLanguage = {
    workspace_id,
    name:          name ?? 'Design Language',
    raw_json,
    normalized,
    source_format,
    token_count:   token_count ?? (Array.isArray(normalized) ? normalized.length : 0),
    version,
  };

  try {
    const dl = await upsertDesignLanguage(db, row);

    // Insert a version snapshot — the prune trigger fires after this insert
    // and deletes any rows beyond the 10-most-recent.
    await db
      .from('design_language_versions')
      .insert({
        design_language_id: dl.id,
        version:            dl.version,
        raw_json:           dl.raw_json,
        normalized:         dl.normalized,
        source_format:      dl.source_format,
      });

    return NextResponse.json(dl, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
