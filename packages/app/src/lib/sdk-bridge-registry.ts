// ── SDK bridge registry ───────────────────────────────────────────────────────
// In-process pub/sub for the bidirectional SDK ↔ Canvas WebSocket bridge.
//
// Two registries per project:
//   canvasSinks — canvas browser tabs subscribed to SDK events
//               (fiber tree updates, style responses, etc.)
//   sdkSinks    — SDK instances subscribed to canvas commands
//               (patch style, request styles, select component, etc.)
//
// ⚠️  Serverless limitation: this module uses in-process Maps and therefore
//     only works when all requests for a project hit the same Node.js process.
//     In Vercel serverless deployments, POST and GET requests may hit different
//     function instances, breaking pub/sub.
//
//     To make this production-grade on Vercel:
//     - Replace these Maps with Supabase Realtime channels (already in stack)
//     - Or add an Upstash Redis publisher/subscriber
//     - Or run on Vercel Fluid Compute (persistent Node.js process)
//
//     For local development (`next dev`) and self-hosted Node.js deployments,
//     the in-process Maps work correctly.

/** A single SSE sink: a function that pushes raw SSE data chunks to a client. */
type Sink = (chunk: string) => void;

const canvasSinks = new Map<string, Set<Sink>>();
const sdkSinks    = new Map<string, Set<Sink>>();

// ── Canvas sinks (SDK → Canvas direction) ─────────────────────────────────────

export function registerCanvasSink(projectId: string, sink: Sink): () => void {
  let sinks = canvasSinks.get(projectId);
  if (!sinks) { sinks = new Set(); canvasSinks.set(projectId, sinks); }
  sinks.add(sink);
  return () => {
    sinks?.delete(sink);
    if (sinks?.size === 0) canvasSinks.delete(projectId);
  };
}

/** Push a JSON-encoded message to all canvas tabs for a project. */
export function pushToCanvas(projectId: string, message: object): void {
  const sinks = canvasSinks.get(projectId);
  if (!sinks || sinks.size === 0) return;
  const chunk = `data: ${JSON.stringify(message)}\n\n`;
  for (const sink of sinks) {
    try { sink(chunk); } catch { /* client disconnected between iteration */ }
  }
}

/** Number of canvas tabs connected to a project. */
export function canvasSubscriberCount(projectId: string): number {
  return canvasSinks.get(projectId)?.size ?? 0;
}

// ── SDK sinks (Canvas → SDK direction) ────────────────────────────────────────

export function registerSdkSink(projectId: string, sink: Sink): () => void {
  let sinks = sdkSinks.get(projectId);
  if (!sinks) { sinks = new Set(); sdkSinks.set(projectId, sinks); }
  sinks.add(sink);
  return () => {
    sinks?.delete(sink);
    if (sinks?.size === 0) sdkSinks.delete(projectId);
  };
}

/** Push a JSON-encoded command to all SDK instances for a project. */
export function pushToSdk(projectId: string, command: object): void {
  const sinks = sdkSinks.get(projectId);
  if (!sinks || sinks.size === 0) return;
  const chunk = `data: ${JSON.stringify(command)}\n\n`;
  for (const sink of sinks) {
    try { sink(chunk); } catch { /* SDK disconnected */ }
  }
}

/** Number of SDK instances connected to a project. */
export function sdkSubscriberCount(projectId: string): number {
  return sdkSinks.get(projectId)?.size ?? 0;
}
