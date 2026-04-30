// ── Originmain Fiber Hook (Live SDK) ─────────────────────────────────────────
// Installs a React DevTools–compatible global hook BEFORE React evaluates its
// module body. React checks for __REACT_DEVTOOLS_GLOBAL_HOOK__ exactly once at
// import time; any later installation is too late.
//
// Full bidirectional protocol:
//   Renderer → Host : READY, FIBER_TREE_UPDATE, COMPONENT_SELECTED, COMPONENT_DESELECTED, ERROR
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
  // nodeMap: nodeId → { domRect (snapshot), fiber (live reference for re-measurement) }
  let nodeMap = new Map<string, { domRect: DomRect | null; fiber: FiberLike }>();
  // fiberMap: fiber object → nodeId for O(1) hit-test lookup via __reactFiber$ DOM keys.
  // A null value means the fiber is unnamed/transparent and not directly selectable.
  let fiberMap = new WeakMap<object, string | null>();
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

      // Reset both maps before each walk so stale entries from the previous tree
      // don't accumulate. fiberMap is a WeakMap so it self-cleans, but nodeMap
      // must be rebuilt from scratch on every commit.
      nodeMap  = new Map();
      fiberMap = new WeakMap();

      const tree = serializeFiber(root.current, '');
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
      // Re-sync the highlight ring after each React commit (component may move).
      if (selectedNodeId) updateHighlight();
    } catch (err) {
      post({ type: 'ERROR', message: String(err) });
    }
  };

  // ── Fiber serialization (stable path-based IDs) ───────────────────────────
  // ID format: "ComponentName:siblingIndex/ChildName:siblingIndex/..."
  //
  // IMPORTANT: unnamed fibers (Fragment, Context.Provider, React.memo wrappers)
  // are transparent — their children are collected directly into their parent's
  // children array. Returning only the first named child (old approach) caused
  // entire subtrees to vanish from the tree.

  function serializeFiber(
    fiber: FiberLike | null,
    parentId: string,
  ): SerializedNode | null {
    if (!fiber) return null;

    const name = getDisplayName(fiber);
    if (!name) {
      // Unnamed root fiber (HostRoot) — collectChildren handles Fragment recursively.
      const children: SerializedNode[] = [];
      collectChildren(fiber, parentId, children);
      if (children.length === 1) return children[0];
      if (children.length === 0) return null;
      // Multiple named children at root — wrap in a synthetic root node.
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

    // Register in both maps for O(1) lookup.
    nodeMap.set(nodeId, { domRect: rect, fiber });
    fiberMap.set(fiber, nodeId);

    collectChildren(fiber, nodeId, node.children);
    return node;
  }

  // Collect all named descendants of fiber.child into out[], transparently
  // flattening unnamed intermediates (Fragments, Providers, wrappers).
  function collectChildren(fiber: FiberLike, parentId: string, out: SerializedNode[]): void {
    let child = fiber.child;
    while (child) {
      const name = getDisplayName(child);
      if (name) {
        const serialized = serializeFiber(child, parentId);
        if (serialized) out.push(serialized);
      } else {
        // Unnamed (Fragment / Context / Provider / forwardRef wrapper etc.):
        // mark as non-selectable and flatten children directly into our level.
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

  // ── Highlight overlay (blue ring inside the iframe) ───────────────────────
  // updateHighlight re-measures from the live fiber stateNode so the ring stays
  // accurate even after scroll (between React commits).

  function updateHighlight(): void {
    const info = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;
    if (!info) { removeHighlight(); return; }

    // Re-measure from the live DOM element for scroll accuracy.
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

  // Re-measure on scroll so the ring follows the element without needing
  // a React commit (which only fires on state/prop changes).
  window.addEventListener('scroll', () => {
    if (selectedNodeId) updateHighlight();
  }, true);

  // ── Click-to-select (capturing phase) ────────────────────────────────────
  // Uses document.elementFromPoint to get the live DOM element at the click
  // position (accurate even after scroll), then walks the React fiber tree
  // upward via __reactFiber$ keys to find the nearest tracked component.

  function getFiberKey(el: Element): string | null {
    const keys = Object.keys(el);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('__reactFiber$')) return keys[i];
    }
    return null;
  }

  document.addEventListener('click', (event: MouseEvent) => {
    // Ignore clicks on our own highlight overlay.
    if (event.target === highlightEl) return;

    const el = document.elementFromPoint(event.clientX, event.clientY);

    // Walk the DOM upward, trying to find a tracked React fiber at each level.
    let current: Element | null = el;
    while (current && current !== document.documentElement) {
      const fiberKey = getFiberKey(current);
      if (fiberKey) {
        // Walk the fiber's return (parent) chain to find the nearest tracked node.
        let fiber: FiberLike | null =
          (current as unknown as Record<string, unknown>)[fiberKey] as FiberLike | null;
        while (fiber) {
          const nodeId = fiberMap.get(fiber);
          if (nodeId) {
            // Re-measure from the live element for accurate post-scroll rect.
            const liveEl = fiber.stateNode;
            if (liveEl && typeof liveEl === 'object' && 'getBoundingClientRect' in liveEl) {
              const r = (liveEl as Element).getBoundingClientRect();
              post({ type: 'COMPONENT_SELECTED', nodeId, rect: { x: r.x, y: r.y, width: r.width, height: r.height } });
              return;
            }
          }
          fiber = fiber.return;
        }
      }
      current = current.parentElement;
    }

    // Nothing found — clear the selection.
    post({ type: 'COMPONENT_DESELECTED' });
  }, true);

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
  /** Parent fiber — needed for click-to-select chain walk via __reactFiber$ keys. */
  return: FiberLike | null;
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
