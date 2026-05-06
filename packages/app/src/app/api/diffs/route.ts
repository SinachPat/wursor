// GET  /api/diffs?artboardId=<uuid>  → list diffs for an artboard
// POST /api/diffs                    → create draft diff

import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';
import { getDiffs, createDiff } from '@originmain/origin-graph';
import type { InsertIntentDiff } from '@originmain/origin-graph';

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const artboardId = req.nextUrl.searchParams.get('artboardId');
  if (!artboardId) return NextResponse.json({ error: 'artboardId is required' }, { status: 400 });

  try {
    const db = serverClient();
    const diffs = await getDiffs(db, artboardId);
    return NextResponse.json(diffs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorEmail = user.primaryEmailAddress?.emailAddress;
  if (!authorEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 401 });

  const body = (await req.json()) as Omit<InsertIntentDiff, 'author_email'>;
  const insert: InsertIntentDiff = { ...body, author_email: authorEmail };

  try {
    const db = serverClient();
    const diff = await createDiff(db, insert);
    return NextResponse.json(diff, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
