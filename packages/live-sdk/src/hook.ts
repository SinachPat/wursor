// ── Originmain Fiber Hook ────────────────────────────────────────────────────
// This module installs a React DevTools–compatible global hook BEFORE React
// evaluates its module body. React checks for __REACT_DEVTOOLS_GLOBAL_HOOK__
// exactly once at import time; any later installation is too late.
//
// The hook only activates when the app is iframed by Originmain (detected by
// the `om:` prefix in `window.name`, which LiveArtboard.tsx sets on the
// <iframe> element). Outside an Originmain iframe the module is a no-op.
//
// This file is intentionally self-contained — no imports from other
// @originmain/* packages — because it ships as a public npm package.

const RENDERER_SOURCE = 'originmain-renderer';
const NAME_PREFIX = 'om:';

// ── Guard: only run inside an Originmain iframe ──────────────────────────────

function isOriginmainIframe(): boolean {
  try {
    return window.parent !== window
      && typeof window.name === 'string'
      && window.name.startsWith(NAME_PREFIX);
  } catch {
    // Accessing window.parent can throw in certain sandboxed contexts.
    return false;
  }
}

if (isOriginmainIframe()) {
  installFiberHook();
}

// ── Core ─────────────────────────────────────────────────────────────────────

function installFiberHook(): void {
  const artboardId = window.name.slice(NAME_PREFIX.length);

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

  // Install or wrap the global hook. If React DevTools is already present,
  // we wrap its onCommitFiberRoot so both receive commits.
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

  const originalOnCommit = hook.onCommitFiberRoot;

  hook.onCommitFiberRoot = function onCommitFiberRoot(...args: unknown[]) {
    // Delegate to the previous handler (React DevTools) first.
    if (typeof originalOnCommit === 'function') {
      try { originalOnCommit.apply(this, args); }
      catch { /* don't break DevTools */ }
    }

    try {
      // args[1] is the FiberRoot — { current: Fiber }
      const root = args[1] as { current: FiberLike } | undefined;
      if (!root?.current) return;
      const tree = serializeFiber(root.current);
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
    } catch (err) {
      post({ type: 'ERROR', message: String(err) });
    }
  };

  // Signal readiness.
  post({ type: 'READY' });
}

// ── Fiber Serialization ──────────────────────────────────────────────────────

interface FiberLike {
  type: unknown;
  index: number;
  child: FiberLike | null;
  sibling: FiberLike | null;
  stateNode: unknown;
  memoizedProps: Record<string, unknown> | null;
}

interface SerializedNode {
  id: string;
  name: string;
  props: Record<string, string | number | boolean | null>;
  children: SerializedNode[];
  domRect?: { x: number; y: number; width: number; height: number };
}

function serializeFiber(fiber: FiberLike | null): SerializedNode | null {
  if (!fiber) return null;

  const name = getDisplayName(fiber);
  if (!name) return serializeFiber(fiber.child);

  const rect = getDomRect(fiber);
  const node: SerializedNode = {
    id: String(fiber.index || Math.random()),
    name,
    props: serializeProps(fiber.memoizedProps),
    children: [],
  };
  if (rect) {
    node.domRect = rect;
  }

  let child = fiber.child;
  while (child) {
    const serialized = serializeFiber(child);
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

function getDomRect(fiber: FiberLike): { x: number; y: number; width: number; height: number } | null {
  try {
    const dom = fiber.stateNode;
    if (dom && typeof dom === 'object' && 'getBoundingClientRect' in dom) {
      const r = (dom as Element).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
  } catch { /* no DOM node */ }
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
