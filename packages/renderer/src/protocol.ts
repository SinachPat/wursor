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
  /** JSX call site: the file + line where <ComponentName /> was written (not its definition).
   *  Only present in React dev builds (__DEV__ = true). Absent in production.
   *  Renamed from `sourceFile` to `callSite` for accuracy — see Phase 1 §4.2. */
  callSite?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
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
  /** Ask the renderer to respond with computed CSS properties for a fiber node. */
  | { type: 'REQUEST_ELEMENT_STYLES'; nodeId: string }
  /** Apply a single CSS property override directly to the component's DOM element.
   *  Non-destructive — sets inline style only; source files are unchanged. */
  | { type: 'PATCH_ELEMENT_STYLE'; nodeId: string; property: string; value: string }
  /** Apply a CSS property to all matching direct children of a node.
   *  Used for paragraph-spacing: patches margin-bottom on each direct <p> child. */
  | { type: 'PATCH_CHILDREN_STYLE'; parentNodeId: string; selector: string; property: string; value: string }
  /** Hide a component's DOM element (sets display:none). Non-destructive. */
  | { type: 'REMOVE_ELEMENT'; nodeId: string };

export interface HostEnvelope {
  source: typeof HOST_SOURCE;
  artboardId: string;
  message: HostMessage;
}

// ── Renderer → Host messages ──────────────────────────────────────────────────

export type RendererMessage =
  | { type: 'READY' }
  | { type: 'FIBER_TREE_UPDATE'; root: FiberNode }
  | { type: 'COMPONENT_SELECTED'; nodeId: string; nodeName?: string; rect: DOMRectLike }
  | { type: 'COMPONENT_DESELECTED' }
  | { type: 'ERROR'; message: string }
  /** Response to REQUEST_ELEMENT_STYLES — computed CSS properties for the node.
   *  Also includes structural flags used by the Typography section of the Design Panel. */
  | {
      type: 'ELEMENT_STYLES';
      nodeId: string;
      styles: Record<string, string>;
      /** true if the DOM element has a direct TEXT_NODE child with non-whitespace content */
      hasDirectText: boolean;
      /** true if the DOM element has at least one direct <p> child */
      hasParagraphChildren: boolean;
    }
  /** All discoverable routes found in the running app — sent once after READY
   *  and again after each SPA navigation. */
  | { type: 'ROUTES_DISCOVERED'; routes: Array<{ path: string; label: string }> };

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
