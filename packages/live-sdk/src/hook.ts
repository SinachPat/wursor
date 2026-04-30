// ── Originmain Fiber Hook (Live SDK) ─────────────────────────────────────────
// Installs a React DevTools–compatible global hook BEFORE React evaluates its
// module body. React checks for __REACT_DEVTOOLS_GLOBAL_HOOK__ exactly once at
// import time; any later installation is too late.
//
// Full bidirectional protocol:
//   Renderer → Host : READY, FIBER_TREE_UPDATE, COMPONENT_SELECTED, ERROR
//   Host → Renderer : SET_DESIGN_TOKENS, NAVIGATE, SELECT_COMPONENT, DESELECT
//
// Node IDs are stable path strings: "Component:idx/Child:idx/…"
// This survives re-renders as long as the component tree structure is unchanged.
//
// Guard: only activates when window.name starts with "om:" — the prefix set by
// LiveArtboard.tsx on the <iframe name="om:{id}"> element. Outside Originmain
// iframes this module is a complete no-op.
//
// This file is intentionally self-contained (no @originmain/* imports) because
// it ships as a public npm package and must work standalone.

const RENDERER_SOURCE = 'originmain-renderer';
const HOST_SOURCE     = 'originmain-host';
const NAME_PREFIX     = 'om:';

// ── Guard ─────────────────────────────────────────────────────────────────────

function isOriginmainIframe(): boolean {
  try {
    return (
      window.parent !== window &&
      typeof window.name === 'string' &&
      window.name.startsWith(NAME_PREFIX)
    );
  } catch {
    return false; // Accessing window.parent can throw in certain sandboxed contexts.
  }
}

if (isOriginmainIframe()) {
  installFiberHook();
}

// ── Core ──────────────────────────────────────────────────────────────────────

function installFiberHook(): void {
  const artboardId = window.name.slice(NAME_PREFIX.length);

  // ── postMessage helper ────────────────────────────────────────────────────
  function post(msg: Record<string, unknown>): void {
    try {
      window.parent.postMessage(
        { source: RENDERER_SOURCE, artboardId, message: msg },
        '*',
      );
    } catch {
      // Parent frame unreachable — silently ignore.
    }
  }

  // ── Runtime state ─────────────────────────────────────────────────────────
  let currentTree: SerializedNode | null = null;
  const nodeMap = new Map<string, { domRect: DomRect | null }>();
  let selectedNodeId: string | null = null;
  let highlightEl: HTMLElement | null = null;

  // ── React DevTools global hook ─────────────────────────────────────────────
  type Hook = {
    renderers: Map<unknown, unknown>;
    supportsFiber: boolean;
    _isDisabled: boolean;
    onCommitFiberRoot?: (...args: unknown[]) => void;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  let hook: Hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  if (!hook) {
    hook = { renderers: new Map(), supportsFiber: true, _isDisabled: false };
    g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }

  const _prevCommit = hook.onCommitFiberRoot;

  hook.onCommitFiberRoot = function onCommitFiberRoot(...args: unknown[]) {
    // Delegate to any pre-existing handler (React DevTools extension) first.
    if (typeof _prevCommit === 'function') {
      try { _prevCommit.apply(this, args); }
      catch { /* don't break existing DevTools */ }
    }

    try {
      // args[1] is the FiberRoot object — { current: Fiber }
      const root = args[1] as { current: FiberLike } | undefined;
      if (!root?.current) return;

      const tree = serializeFiber(root.current, '');
      currentTree = tree;
      rebuildNodeMap(tree);
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
      // Re-sync the highlight ring after each React commit (component may move).
      if (selectedNodeId) updateHighlight();
    } catch (err) {
      post({ type: 'ERROR', message: String(err) });
    }
  };

  // ── Fiber serialization (stable path-based IDs) ───────────────────────────

  function serializeFiber(
    fiber: FiberLike | null,
    parentId: string,
  ): SerializedNode | null {
    if (!fiber) return null;

    const name = getDisplayName(fiber);
    if (!name) {
      // Unnamed fiber — skip level but keep walking children.
      let child = fiber.child;
      while (child) {
        const s = serializeFiber(child, parentId);
        if (s) return s;
        child = child.sibling;
      }
      return null;
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

    let child = fiber.child;
    while (child) {
      const serialized = serializeFiber(child, nodeId);
      if (serialized) node.children.push(serialized);
      child = child.sibling;
    }
    return node;
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

  // ── Node map: flat O(1) lookup by stable ID ───────────────────────────────

  function rebuildNodeMap(node: SerializedNode | null): void {
    nodeMap.clear();
    fillMap(node);
  }

  function fillMap(node: SerializedNode | null): void {
    if (!node) return;
    nodeMap.set(node.id, { domRect: node.domRect ?? null });
    for (const child of node.children) fillMap(child);
  }

  // ── Highlight overlay (blue ring inside the iframe) ───────────────────────

  function updateHighlight(): void {
    const info = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;
    if (info?.domRect) renderHighlight(info.domRect);
    else removeHighlight();
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

  // ── Click-to-select (capturing phase) ────────────────────────────────────

  document.addEventListener('click', (event: MouseEvent) => {
    const node = findDeepestAt(currentTree, event.clientX, event.clientY);
    if (node?.domRect) {
      post({ type: 'COMPONENT_SELECTED', nodeId: node.id, rect: node.domRect });
    }
  }, true);

  function findDeepestAt(
    node: SerializedNode | null,
    x: number,
    y: number,
  ): SerializedNode | null {
    if (!node) return null;
    const r   = node.domRect;
    const hit = r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

    if (hit) {
      for (const child of node.children) {
        const deeper = findDeepestAt(child, x, y);
        if (deeper) return deeper;
      }
      return node;
    }

    // No hit — still check children for overflow:visible scenarios.
    for (const child of node.children) {
      const found = findDeepestAt(child, x, y);
      if (found) return found;
    }
    return null;
  }

  // ── Host → Renderer message handler ──────────────────────────────────────

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      source?: string;
      artboardId?: string;
      message?: { type: string; tokens?: Record<string, string>; path?: string; nodeId?: string };
    };
    if (!data || data.source !== HOST_SOURCE)    return;
    if (data.artboardId !== artboardId)          return;
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
        if (msg.nodeId) {
          selectedNodeId = msg.nodeId;
          updateHighlight();
        }
        break;
      case 'DESELECT':
        selectedNodeId = null;
        removeHighlight();
        break;
    }
  });

  function applyTokens(tokens: Record<string, string>): void {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tokens)) {
      root.style.setProperty(k, v);
    }
  }

  function doNavigate(path: string): void {
    try {
      history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    } catch { /* navigation not available */ }
  }

  // ── Ready signal ──────────────────────────────────────────────────────────
  post({ type: 'READY' });
}

// ── Internal types ────────────────────────────────────────────────────────────

interface FiberLike {
  type: unknown;
  index: number;
  child: FiberLike | null;
  sibling: FiberLike | null;
  stateNode: unknown;
  memoizedProps: Record<string, unknown> | null;
}

interface DomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SerializedNode {
  id:       string;
  name:     string;
  props:    Record<string, string | number | boolean | null>;
  children: SerializedNode[];
  domRect?: DomRect;
}
