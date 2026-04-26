// ── Source discriminants ──────────────────────────────────────────────────────
// All postMessage envelopes carry a `source` field so the host and renderer can
// ignore messages from unrelated parties (browser extensions, devtools, etc.).

export const HOST_SOURCE = 'originmain-host' as const;
export const RENDERER_SOURCE = 'originmain-renderer' as const;

// ── Fiber node ────────────────────────────────────────────────────────────────

export interface FiberNode {
  id: string;
  name: string;
  props: Record<string, unknown>;
  children: FiberNode[];
  domRect?: DOMRectLike;
}

export interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Host → Renderer messages ──────────────────────────────────────────────────

export type HostMessage =
  | { type: 'SET_DESIGN_TOKENS'; tokens: Record<string, string> }
  | { type: 'NAVIGATE'; path: string }
  | { type: 'SELECT_COMPONENT'; nodeId: string }
  | { type: 'DESELECT' }
  | { type: 'INJECT_FIBER_HOOK' };

export interface HostEnvelope {
  source: typeof HOST_SOURCE;
  artboardId: string;
  message: HostMessage;
}

// ── Renderer → Host messages ──────────────────────────────────────────────────

export type RendererMessage =
  | { type: 'READY' }
  | { type: 'FIBER_TREE_UPDATE'; root: FiberNode }
  | { type: 'COMPONENT_SELECTED'; nodeId: string; rect: DOMRectLike }
  | { type: 'COMPONENT_DESELECTED' }
  | { type: 'ERROR'; message: string };

export interface RendererEnvelope {
  source: typeof RENDERER_SOURCE;
  artboardId: string;
  message: RendererMessage;
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isHostEnvelope(data: unknown): data is HostEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as HostEnvelope).source === HOST_SOURCE
  );
}

export function isRendererEnvelope(data: unknown): data is RendererEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as RendererEnvelope).source === RENDERER_SOURCE
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function createHostEnvelope(
  artboardId: string,
  message: HostMessage
): HostEnvelope {
  return { source: HOST_SOURCE, artboardId, message };
}

export function createRendererEnvelope(
  artboardId: string,
  message: RendererMessage
): RendererEnvelope {
  return { source: RENDERER_SOURCE, artboardId, message };
}
