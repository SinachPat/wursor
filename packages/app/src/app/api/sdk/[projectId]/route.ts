// ── SDK Bridge — fiber events channel ─────────────────────────────────────────
//
// GET  /api/sdk/[projectId]  — Canvas subscribes (SSE). Receives SDK events:
//                              READY, FIBER_TREE_UPDATE, ELEMENT_STYLES, etc.
//                              Auth: Supabase session cookie.
//
// POST /api/sdk/[projectId]  — SDK pushes an event to the bridge.
//                              Auth: Bearer <sdk-token>.
//                              Body: RendererMessage JSON.
//                              The bridge fans the event out to all canvas SSE
//                              subscribers for this project.
//
// This route handles the SDK → Canvas direction of the bridge.
// For Canvas → SDK commands see: /api/sdk/[projectId]/commands/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { extractSdkToken }           from '@/lib/sdk-auth';
import {
  registerCanvasSink,
  pushToCanvas,
  sdkSubscriberCount,
}                                    from '@/lib/sdk-bridge-registry';
import { serverClient }              from '@/lib/supabase';

// ── GET — Canvas subscribes to SDK events ─────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  // Verify the canvas user has access to this project via Supabase session.
  // We read the session from the cookie — canvas is a browser client.
  const db       = serverClient();
  const authToken = req.cookies.get('sb-access-token')?.value
    ?? req.headers.get('x-supabase-auth')
    ?? null;

  if (!authToken) {
    return new NextResponse('Unauthorized — missing session', { status: 401 });
  }

  // Verify the project exists and belongs to a workspace the user can access.
  // For now we do a lightweight existence check. Full RLS is enforced by the
  // service-role client below — swap for auth-user client for full RLS.
  const { error: projectError } = await db
    .from('artboards')
    .select('id')
    .eq('id', projectId)
    .single();

  if (projectError) {
    return new NextResponse('Project not found or access denied', { status: 403 });
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // SSE preamble: tells the browser the connection is alive.
      controller.enqueue(enc.encode(': sdk-bridge connected\n\n'));
      // Inform the canvas how many SDK instances are currently connected.
      controller.enqueue(enc.encode(
        `data: ${JSON.stringify({ type: '__bridge_status__', sdkCount: sdkSubscriberCount(projectId) })}\n\n`,
      ));

      // Register this canvas tab as a sink for SDK events.
      const unsubscribe = registerCanvasSink(projectId, (chunk) => {
        try { controller.enqueue(enc.encode(chunk)); } catch { /* disconnected */ }
      });

      // Keep-alive every 25 s to prevent proxy idle timeouts.
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

// ── POST — SDK pushes a fiber event ──────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  // Authenticate the SDK via Bearer token.
  const sdkToken = extractSdkToken(req.headers.get('authorization'));
  if (!sdkToken) {
    return NextResponse.json({ error: 'Invalid or missing SDK token' }, { status: 401 });
  }

  // The token is scoped to a specific project — verify it matches the URL.
  if (sdkToken.projectId !== projectId) {
    return NextResponse.json({ error: 'Token project mismatch' }, { status: 403 });
  }

  // Parse the SDK event body.
  let message: Record<string, unknown>;
  try {
    message = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof message.type !== 'string') {
    return NextResponse.json({ error: 'Missing message.type' }, { status: 400 });
  }

  // Fan out to all canvas SSE subscribers for this project.
  pushToCanvas(projectId, message);

  return NextResponse.json({ ok: true });
}
