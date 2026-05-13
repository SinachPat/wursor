// ── Originmain Fiber Hook (Live SDK) ─────────────────────────────────────────
// Installs a React DevTools–compatible global hook BEFORE React evaluates its
// module body. React checks for __REACT_DEVTOOLS_GLOBAL_HOOK__ exactly once at
// import time; any later installation is too late.
//
// Full bidirectional protocol (matches packages/renderer/src/protocol.ts):
//   Renderer → Host : READY, FIBER_TREE_UPDATE, COMPONENT_SELECTED,
//                     COMPONENT_DESELECTED, ELEMENT_STYLES, ROUTES_DISCOVERED,
//                     THUMBNAIL_READY, SNAPSHOT_READY, ERROR
//   Host → Renderer : SET_DESIGN_TOKENS, NAVIGATE, SELECT_COMPONENT, DESELECT,
//                     REQUEST_ELEMENT_STYLES, PATCH_ELEMENT_STYLE,
//                     PATCH_CHILDREN_STYLE, REMOVE_ELEMENT,
//                     CAPTURE_THUMBNAIL, CAPTURE_SNAPSHOT, CANCEL_SNAPSHOT
//
// Activation guard — checked in priority order:
//   1. URL fragment:     location.hash contains __om_artboard=<id>
//   2. window.name:      starts with "om:" (works for same-origin iframes)
//   3. postMessage handshake: sends __om_init_request to parent, waits for reply
//
// Chrome 88+ strips window.name on cross-origin iframe loads (Spectre
// mitigation). The URL fragment approach is immune to this because LiveArtboard
// appends #__om_artboard=<id> to the iframe src, which survives cross-origin
// navigation. The postMessage handshake is a final fallback.
//
// This file is intentionally self-contained (no @originmain/* imports) so it
// ships as a standalone npm package without workspace dependencies.

const RENDERER_SOURCE = 'originmain-renderer';
const HOST_SOURCE     = 'originmain-host';
const NAME_PREFIX     = 'om:';

// ── Artboard ID resolution ────────────────────────────────────────────────────
// Returns null if we're not inside an Originmain artboard iframe at all.

function resolveArtboardIdSync(): string | null {
  // Not in an iframe at all — bail immediately.
  try { if (window.parent === window) return null; }
  catch { return null; }

  // 1. URL fragment: #__om_artboard=<id>  (primary — cross-origin safe)
  try {
    const match = window.location.hash.match(/__om_artboard=([^&]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch { /* */ }

  // 2. window.name: "om:<id>"  (works for same-origin iframes)
  try {
    if (typeof window.name === 'string' && window.name.startsWith(NAME_PREFIX)) {
      return window.name.slice(NAME_PREFIX.length);
    }
  } catch { /* */ }

  return null;
}

// ── Hook installation ─────────────────────────────────────────────────────────
// We install the DevTools hook unconditionally when inside ANY iframe, because
// React evaluates __REACT_DEVTOOLS_GLOBAL_HOOK__ at module load time. If we
// wait for the artboard ID we're already too late. The hook stays dormant until
// the artboard ID is resolved (either synchronously or via postMessage).

(function bootstrap() {
  // Not in a frame at all — complete no-op.
  try { if (window.parent === window) return; }
  catch { return; }

  // ── Install the DevTools hook immediately ────────────────────────────────
  // React reads __REACT_DEVTOOLS_GLOBAL_HOOK__ exactly once when its module
  // body runs. We must be here first.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;

  type Hook = {
    renderers:         Map<unknown, unknown>;
    supportsFiber:     boolean;
    _isDisabled:       boolean;
    inject?:           (...a: unknown[]) => void;
    onCommitFiberRoot?: (...a: unknown[]) => void;
  };

  let hook: Hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    hook = { renderers: new Map(), supportsFiber: true, _isDisabled: false };
    g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }

  // ── Resolve artboard ID ──────────────────────────────────────────────────
  const syncId = resolveArtboardIdSync();
  if (syncId) {
    startMainLoop(hook, syncId);
    return;
  }

  // No ID found synchronously — try the postMessage handshake.
  // The parent (LiveArtboard.tsx) listens for __om_init_request and responds
  // with { __om_init_response: true, artboardId: id }.
  let resolved = false;

  function onHandshakeReply(event: MessageEvent) {
    const d = event.data as { __om_init_response?: boolean; artboardId?: string } | null;
    if (d?.__om_init_response === true && typeof d.artboardId === 'string') {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('message', onHandshakeReply);
        startMainLoop(hook, d.artboardId);
      }
    }
  }

  window.addEventListener('message', onHandshakeReply);
  try {
    window.parent.postMessage({ __om_init_request: true }, '*');
  } catch { /* sandboxed — postMessage blocked */ }

  // Give up after 10 s to avoid a stale listener.
  setTimeout(() => {
    if (!resolved) window.removeEventListener('message', onHandshakeReply);
  }, 10_000);
})();

// ── Main loop (runs once artboard ID is known) ────────────────────────────────

function startMainLoop(hook: {
  renderers:          Map<unknown, unknown>;
  supportsFiber:      boolean;
  _isDisabled:        boolean;
  inject?:            (...a: unknown[]) => void;
  onCommitFiberRoot?: (...a: unknown[]) => void;
}, artboardId: string): void {

  // ── postMessage helper ────────────────────────────────────────────────────
  function post(msg: Record<string, unknown>): void {
    try {
      window.parent.postMessage(
        { source: RENDERER_SOURCE, artboardId, message: msg },
        '*',
      );
    } catch { /* parent frame unreachable */ }
  }

  // ── Runtime state ─────────────────────────────────────────────────────────
  let nodeMap  = new Map<string, { domRect: DomRect | null; fiber: FiberLike }>();
  let fiberMap = new WeakMap<object, string | null>();
  let selectedNodeId: string | null = null;
  let highlightEl:    HTMLElement | null = null;
  let snapshotAborted = false;

  // ── Fiber hook — onCommitFiberRoot ────────────────────────────────────────
  const _prevCommit = hook.onCommitFiberRoot;

  hook.onCommitFiberRoot = function onCommitFiberRoot(...args: unknown[]) {
    if (typeof _prevCommit === 'function') {
      try { _prevCommit.apply(this, args); } catch { /* don't break existing DevTools */ }
    }
    try {
      const root = args[1] as { current: FiberLike } | undefined;
      if (!root?.current) return;

      nodeMap  = new Map();
      fiberMap = new WeakMap();

      const tree = serializeFiber(root.current, '');
      post({ type: 'FIBER_TREE_UPDATE', root: tree });

      if (selectedNodeId) updateHighlight();
    } catch (err) {
      post({ type: 'ERROR', message: String(err) });
    }
  };

  // ── Fiber serialization ───────────────────────────────────────────────────

  function serializeFiber(fiber: FiberLike | null, parentId: string): SerializedNode | null {
    if (!fiber) return null;

    const name = getDisplayName(fiber);
    if (!name) {
      const children: SerializedNode[] = [];
      collectChildren(fiber, parentId, children);
      if (children.length === 1) return children[0] ?? null;
      if (children.length === 0) return null;
      return { id: '__root__', name: '__root__', props: {}, children };
    }

    const nodeId = (parentId ? parentId + '/' : '') + name + ':' + String(fiber.index);
    const rect   = getDomRect(fiber);
    const node: SerializedNode = {
      id:       nodeId,
      name,
      props:    serializeProps(fiber.memoizedProps),
      children: [],
    };
    if (rect) node.domRect = rect;

    // Attach call-site if present (React dev builds expose _debugSource).
    const src = (fiber as FiberLike & { _debugSource?: { fileName?: string; lineNumber?: number; columnNumber?: number } })._debugSource;
    if (src?.fileName && typeof src.lineNumber === 'number') {
      node.callSite = {
        fileName:     src.fileName,
        lineNumber:   src.lineNumber,
        ...(src.columnNumber !== undefined ? { columnNumber: src.columnNumber } : {}),
      };
    }

    nodeMap.set(nodeId, { domRect: rect, fiber });
    fiberMap.set(fiber, nodeId);

    collectChildren(fiber, nodeId, node.children);
    return node;
  }

  function collectChildren(fiber: FiberLike, parentId: string, out: SerializedNode[]): void {
    let child = fiber.child;
    while (child) {
      const name = getDisplayName(child);
      if (name) {
        const s = serializeFiber(child, parentId);
        if (s) out.push(s);
      } else {
        fiberMap.set(child, null);
        collectChildren(child, parentId, out);
      }
      child = child.sibling;
    }
  }

  function getDisplayName(fiber: FiberLike): string | null {
    const type = fiber.type;
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') {
      return (type as { displayName?: string; name?: string }).displayName
          ?? (type as { name?: string }).name
          ?? null;
    }
    if (typeof type === 'object' && type !== null && '$$typeof' in type) {
      return (type as { displayName?: string; name?: string }).displayName
          ?? (type as { name?: string }).name
          ?? null;
    }
    return null;
  }

  function getDomRect(fiber: FiberLike): DomRect | null {
    try {
      const dom = fiber.stateNode;
      if (dom && typeof dom === 'object' && 'getBoundingClientRect' in dom) {
        const r = (dom as Element).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    } catch { /* stateNode has no layout */ }
    return null;
  }

  function serializeProps(
    props: Record<string, unknown> | null,
  ): Record<string, string | number | boolean | null> {
    if (!props || typeof props !== 'object') return {};
    const out: Record<string, string | number | boolean | null> = {};
    for (const key in props) {
      if (key === 'children') continue;
      const val = props[key];
      const t = typeof val;
      if (t === 'string' || t === 'number' || t === 'boolean' || val === null) {
        out[key] = val as string | number | boolean | null;
      }
    }
    return out;
  }

  // ── Highlight overlay ─────────────────────────────────────────────────────

  function updateHighlight(): void {
    const info = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;
    if (!info) { removeHighlight(); return; }
    const rect = getDomRect(info.fiber) ?? info.domRect;
    if (rect && rect.width > 0 && rect.height > 0) {
      renderHighlight(rect);
    } else {
      removeHighlight();
    }
  }

  function renderHighlight(rect: DomRect): void {
    if (!highlightEl) {
      highlightEl = document.createElement('div');
      highlightEl.id = '__om_sel__';
      highlightEl.setAttribute('aria-hidden', 'true');
      highlightEl.style.cssText = [
        'position:fixed', 'pointer-events:none', 'z-index:2147483647',
        'box-shadow:0 0 0 2px #3385FF',
        'outline:3px solid rgba(51,133,255,0.18)',
        'border-radius:3px',
        'transition:left .07s ease,top .07s ease,width .07s ease,height .07s ease',
      ].join(';');
      document.body.appendChild(highlightEl);
    }
    highlightEl.style.left   = `${rect.x}px`;
    highlightEl.style.top    = `${rect.y}px`;
    highlightEl.style.width  = `${rect.width}px`;
    highlightEl.style.height = `${rect.height}px`;
  }

  function removeHighlight(): void {
    if (highlightEl?.parentNode) {
      highlightEl.parentNode.removeChild(highlightEl);
      highlightEl = null;
    }
  }

  window.addEventListener('scroll', () => {
    if (selectedNodeId) updateHighlight();
  }, true);

  // ── Click-to-select ───────────────────────────────────────────────────────

  function getFiberKey(el: Element): string | null {
    const keys = Object.keys(el);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k?.startsWith('__reactFiber$')) return k;
    }
    return null;
  }

  document.addEventListener('click', (event: MouseEvent) => {
    if (event.target === highlightEl) return;

    const el = document.elementFromPoint(event.clientX, event.clientY);
    let current: Element | null = el;
    while (current && current !== document.documentElement) {
      const fiberKey = getFiberKey(current);
      if (fiberKey) {
        let fiber: FiberLike | null =
          (current as unknown as Record<string, unknown>)[fiberKey] as FiberLike | null;
        while (fiber) {
          const nodeId = fiberMap.get(fiber);
          if (nodeId) {
            const liveEl = fiber.stateNode;
            if (liveEl && typeof liveEl === 'object' && 'getBoundingClientRect' in liveEl) {
              const r = (liveEl as Element).getBoundingClientRect();
              post({
                type: 'COMPONENT_SELECTED',
                nodeId,
                rect: { x: r.x, y: r.y, width: r.width, height: r.height },
              });
              return;
            }
          }
          fiber = fiber.return;
        }
      }
      current = current.parentElement;
    }

    post({ type: 'COMPONENT_DESELECTED' });
  }, true);

  // ── Element style inspection ──────────────────────────────────────────────

  const INSPECTED_PROPS = [
    'color', 'font-family', 'font-size', 'font-weight', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
    'display', 'width', 'height',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'flex-direction', 'align-items', 'justify-content', 'gap',
    'position', 'top', 'right', 'bottom', 'left',
    'background-color', 'border-radius', 'opacity',
    'box-shadow', 'border-width', 'border-color', 'border-style',
    'overflow', 'cursor', 'transition',
  ] as const;

  function respondWithStyles(nodeId: string): void {
    const info = nodeMap.get(nodeId);
    const styles: Record<string, string> = {};
    let hasDirectText         = false;
    let hasParagraphChildren  = false;

    if (info?.fiber?.stateNode && typeof info.fiber.stateNode === 'object'
        && 'nodeType' in (info.fiber.stateNode as object)) {
      try {
        const el       = info.fiber.stateNode as Element;
        const computed = window.getComputedStyle(el);

        for (const prop of INSPECTED_PROPS) {
          const val = computed.getPropertyValue(prop);
          if (val) styles[prop] = val;
        }

        // Structural flags for the Typography panel.
        const childNodes = el.childNodes;
        for (let i = 0; i < childNodes.length; i++) {
          const n = childNodes[i];
          if (n?.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
            hasDirectText = true;
          }
          if ((n as Element)?.tagName === 'P') {
            hasParagraphChildren = true;
          }
        }
      } catch { /* element may be detached */ }
    }

    post({ type: 'ELEMENT_STYLES', nodeId, styles, hasDirectText, hasParagraphChildren });
  }

  // ── Style patching ────────────────────────────────────────────────────────

  function patchElementStyle(nodeId: string, property: string, value: string): void {
    const info = nodeMap.get(nodeId);
    if (!info?.fiber?.stateNode || typeof info.fiber.stateNode !== 'object'
        || !('nodeType' in (info.fiber.stateNode as object))) return;
    try {
      const el = info.fiber.stateNode as HTMLElement;
      value === '' ? el.style.removeProperty(property) : el.style.setProperty(property, value);
    } catch { /* detached */ }
  }

  function patchChildrenStyle(
    parentNodeId: string,
    selector: string,
    property: string,
    value: string,
  ): void {
    const info = nodeMap.get(parentNodeId);
    if (!info?.fiber?.stateNode || typeof info.fiber.stateNode !== 'object'
        || !('nodeType' in (info.fiber.stateNode as object))) return;
    try {
      const parent = info.fiber.stateNode as Element;
      parent.querySelectorAll(selector).forEach((child) => {
        if (child.parentElement === parent) {
          value === ''
            ? (child as HTMLElement).style.removeProperty(property)
            : (child as HTMLElement).style.setProperty(property, value);
        }
      });
    } catch { /* detached */ }
  }

  function removeElement(nodeId: string): void {
    const info = nodeMap.get(nodeId);
    if (!info?.fiber?.stateNode || typeof info.fiber.stateNode !== 'object'
        || !('nodeType' in (info.fiber.stateNode as object))) return;
    try {
      (info.fiber.stateNode as HTMLElement).style.setProperty('display', 'none');
    } catch { /* detached */ }
  }

  // ── Design tokens ─────────────────────────────────────────────────────────

  function applyTokens(tokens: Record<string, string>): void {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tokens)) {
      root.style.setProperty(k, v);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function doNavigate(path: string): void {
    try {
      history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    } catch { /* navigation not available */ }
  }

  // ── Screenshot capture (html2canvas) ─────────────────────────────────────
  // Loaded on demand from the proxy's embedded bundle (/__om_h2c__.js) or
  // from unpkg. Falls back to null if neither is available.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Html2CanvasFn = (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

  let html2canvasCache: Html2CanvasFn | null | 'pending' = null;

  async function loadHtml2Canvas(): Promise<Html2CanvasFn | null> {
    if (html2canvasCache !== null && html2canvasCache !== 'pending') return html2canvasCache;
    if (html2canvasCache === 'pending') {
      // Wait for the in-flight load.
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (html2canvasCache !== 'pending') {
            clearInterval(check);
            resolve(html2canvasCache as Html2CanvasFn | null);
          }
        }, 50);
      });
    }

    html2canvasCache = 'pending';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;

    // Already on window (e.g. loaded by the proxy script).
    if (typeof g.html2canvas === 'function') {
      html2canvasCache = g.html2canvas as Html2CanvasFn;
      return html2canvasCache;
    }

    // Try the proxy-embedded bundle first (works offline, no CSP issues).
    const candidates = [
      '/__om_h2c__.js',
      'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
    ];

    for (const src of candidates) {
      try {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload  = () => resolve();
          s.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(s);
        });
        if (typeof g.html2canvas === 'function') {
          html2canvasCache = g.html2canvas as Html2CanvasFn;
          return html2canvasCache;
        }
      } catch { /* try next source */ }
    }

    html2canvasCache = null;
    return null;
  }

  async function captureThumbnail(): Promise<void> {
    try {
      const h2c = await loadHtml2Canvas();
      if (!h2c) { post({ type: 'THUMBNAIL_READY', dataUrl: null }); return; }

      const canvas = await h2c(document.body, {
        scale:        0.5,
        useCORS:      true,
        allowTaint:   true,
        logging:      false,
        imageTimeout: 5000,
      });
      post({ type: 'THUMBNAIL_READY', dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
    } catch {
      post({ type: 'THUMBNAIL_READY', dataUrl: null });
    }
  }

  async function captureSnapshot(nodeId: string): Promise<void> {
    snapshotAborted = false;
    try {
      const info = nodeMap.get(nodeId);
      if (!info?.fiber?.stateNode || typeof info.fiber.stateNode !== 'object'
          || !('nodeType' in (info.fiber.stateNode as object))) {
        post({ type: 'SNAPSHOT_READY', dataUrl: null, nodeId });
        return;
      }

      const h2c = await loadHtml2Canvas();
      if (!h2c || snapshotAborted) { post({ type: 'SNAPSHOT_READY', dataUrl: null, nodeId }); return; }

      const el     = info.fiber.stateNode as HTMLElement;
      const canvas = await h2c(el, { scale: 2, useCORS: true, allowTaint: true, logging: false });
      if (snapshotAborted) { post({ type: 'SNAPSHOT_READY', dataUrl: null, nodeId }); return; }

      post({ type: 'SNAPSHOT_READY', dataUrl: canvas.toDataURL('image/png'), nodeId });
    } catch {
      post({ type: 'SNAPSHOT_READY', dataUrl: null, nodeId });
    }
  }

  // ── Route discovery ───────────────────────────────────────────────────────

  function humanLabel(path: string): string {
    if (path === '/') return 'Home';
    return path
      .split('/')
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
      .join(' / ');
  }

  function discoverRoutes(): void {
    const seen   = new Set<string>();
    const routes: Array<{ path: string; label: string }> = [];

    const addRoute = (path: string, hint?: string) => {
      if (!path || path.startsWith('#') || seen.has(path)) return;
      seen.add(path);
      routes.push({ path, label: hint?.trim().slice(0, 50) || humanLabel(path) });
    };

    addRoute(window.location.pathname, document.title || undefined);

    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      try {
        const raw = (a.getAttribute('href') ?? '').trim();
        if (raw.startsWith('/')) { addRoute(raw, a.textContent ?? undefined); return; }
        const url = new URL(a.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        addRoute(url.pathname, a.textContent ?? undefined);
      } catch { /* malformed href */ }
    });

    nodeMap.forEach(({ fiber }) => {
      const name = fiber ? getDisplayName(fiber) : null;
      if (name && /^(Link|NavLink|NextLink|RouterLink|a)$/.test(name)) {
        const href = fiber?.memoizedProps?.['href'] ?? fiber?.memoizedProps?.['to'];
        if (typeof href === 'string' && href.startsWith('/')) addRoute(href);
      }
    });

    if (routes.length > 0) post({ type: 'ROUTES_DISCOVERED', routes });
  }

  let routeDiscoveryScheduled = false;
  setTimeout(discoverRoutes, 800);
  window.addEventListener('popstate', () => {
    if (!routeDiscoveryScheduled) {
      routeDiscoveryScheduled = true;
      setTimeout(() => { routeDiscoveryScheduled = false; discoverRoutes(); }, 300);
    }
  });

  // ── Host → Renderer message handler ──────────────────────────────────────

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      source?: string;
      artboardId?: string;
      message?: {
        type: string;
        tokens?: Record<string, string>;
        path?: string;
        nodeId?: string;
        parentNodeId?: string;
        selector?: string;
        property?: string;
        value?: string;
      };
    };
    if (!data || data.source !== HOST_SOURCE) return;
    if (data.artboardId !== artboardId)       return;
    const msg = data.message;
    if (!msg) return;

    switch (msg.type) {
      case 'SET_DESIGN_TOKENS':
        if (msg.tokens) applyTokens(msg.tokens);
        break;
      case 'NAVIGATE':
        if (msg.path) doNavigate(msg.path);
        break;
      case 'SELECT_COMPONENT':
        if (msg.nodeId) { selectedNodeId = msg.nodeId; updateHighlight(); }
        break;
      case 'DESELECT':
        selectedNodeId = null;
        removeHighlight();
        break;
      case 'REQUEST_ELEMENT_STYLES':
        if (msg.nodeId) respondWithStyles(msg.nodeId);
        break;
      case 'PATCH_ELEMENT_STYLE':
        if (msg.nodeId && msg.property && msg.value !== undefined) {
          patchElementStyle(msg.nodeId, msg.property, msg.value ?? '');
        }
        break;
      case 'PATCH_CHILDREN_STYLE':
        if (msg.parentNodeId && msg.selector && msg.property && msg.value !== undefined) {
          patchChildrenStyle(msg.parentNodeId, msg.selector, msg.property, msg.value ?? '');
        }
        break;
      case 'REMOVE_ELEMENT':
        if (msg.nodeId) removeElement(msg.nodeId);
        break;
      case 'CAPTURE_THUMBNAIL':
        void captureThumbnail();
        break;
      case 'CAPTURE_SNAPSHOT':
        if (msg.nodeId) void captureSnapshot(msg.nodeId);
        break;
      case 'CANCEL_SNAPSHOT':
        snapshotAborted = true;
        break;
    }
  });

  // ── READY signal ──────────────────────────────────────────────────────────

  let rootFontSizePx: number | undefined;
  try {
    const computed = window.getComputedStyle(document.documentElement);
    const parsed   = parseFloat(computed.fontSize);
    if (!isNaN(parsed)) rootFontSizePx = parsed;
  } catch { /* */ }

  post({ type: 'READY', rootFontSizePx });
}

// ── Internal types ────────────────────────────────────────────────────────────

interface FiberLike {
  type:          unknown;
  index:         number;
  child:         FiberLike | null;
  sibling:       FiberLike | null;
  return:        FiberLike | null;
  stateNode:     unknown;
  memoizedProps: Record<string, unknown> | null;
}

interface DomRect {
  x: number; y: number; width: number; height: number;
}

interface SerializedNode {
  id:        string;
  name:      string;
  props:     Record<string, string | number | boolean | null>;
  children:  SerializedNode[];
  domRect?:  DomRect;
  callSite?: { fileName: string; lineNumber: number; columnNumber?: number };
}
