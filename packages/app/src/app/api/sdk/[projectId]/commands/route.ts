// ── SDK Bridge — canvas commands channel ──────────────────────────────────────
//
// GET  /api/sdk/[projectId]/commands  — SDK subscribes (SSE). Receives canvas
//                                       commands: PATCH_ELEMENT_STYLE,
//                                       REQUEST_ELEMENT_STYLES, SELECT_COMPONENT,
//                                       SET_DESIGN_TOKENS, etc.
//                                       Auth: Bearer <sdk-token>.
//
// POST /api/sdk/[projectId]/commands  — Canvas pushes a command to the bridge.
//                                       Auth: Supabase session cookie.
//                                       Body: HostMessage JSON.
//                                       The bridge fans the command out to all
//                                       connected SDK instances for this project.
//
// This route handles the Canvas → SDK direction of the bridge.
// For SDK → Canvas events see: /api/sdk/[projectId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { extractSdkToken }           from '@/lib/sdk-auth';
import {
  registerSdkSink,
  pushToSdk,
  canvasSubscriberCount,
}                                    from '@/lib/sdk-bridge-registry';
import { serverClient }              from '@/lib/supabase';

// ── GET — SDK subscribes to canvas commands ───────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  // Authenticate the SDK via Bearer token.
  const sdkToken = extractSdkToken(req.headers.get('authorization'));
  if (!sdkToken) {
    return new NextResponse('Invalid or missing SDK token', { status: 401 });
  }
  if (sdkToken.projectId !== projectId) {
    return new NextResponse('Token project mismatch', { status: 403 });
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(': sdk-commands connected\n\n'));
      // Tell the SDK how many canvas tabs are actively subscribed.
      controller.enqueue(enc.encode(
        `data: ${JSON.stringify({ type: '__bridge_status__', canvasCount: canvasSubscriberCount(projectId) })}\n\n`,
      ));

      // Register this SDK instance as a sink for canvas commands.
      const unsubscribe = registerSdkSink(projectId, (chunk) => {
        try { controller.enqueue(enc.encode(chunk)); } catch { /* disconnected */ }
      });

      const keepAlive = setInterval(() => {
        try { controller.enqueue(enc.encode(': keep-alive\n\n')); } catch {
          clearInterval(keepAlive);
        }
      }, 25_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':       'text/event-stream; charset=utf-8',
      'Cache-Control':      'no-cache, no-transform',
      'Connection':         'keep-alive',
      'X-Accel-Buffering':  'no',
    },
  });
}

// ── POST — Canvas pushes a command to the SDK ─────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  // Verify the canvas user has a valid session.
  const authCookie = req.cookies.get('sb-access-token')?.value
    ?? req.headers.get('x-supabase-auth')
    ?? null;

  if (!authCookie) {
    return NextResponse.json({ error: 'Unauthorized — missing session' }, { status: 401 });
  }

  // Lightweight project access check.
  const db = serverClient();
  const { error: projectError } = await db
    .from('artboards')
    .select('id')
    .eq('id', projectId)
    .single();

  if (projectError) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
  }

  // Parse the command body.
  let command: Record<string, unknown>;
  try {
    command = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof command.type !== 'string') {
    return NextResponse.json({ error: 'Missing command.type' }, { status: 400 });
  }

  // Fan out to all SDK SSE subscribers for this project.
  pushToSdk(projectId, command);

  return NextResponse.json({ ok: true });
}
