import { RENDERER_SOURCE } from './protocol.js';
import type { FiberNode, DOMRectLike } from './protocol.js';

// ── Fiber hook script ─────────────────────────────────────────────────────────
// This script is injected into the sandboxed iframe before the remote app
// initialises. It installs a React DevTools global hook so React reports every
// commit. On each commit, we walk the Fiber tree, serialize it to FiberNode[],
// and postMessage the result to the host.
//
// The script must be self-contained (no imports) because it runs in the iframe.
// We generate it as a string via buildFiberHookScript() so it can be injected
// via a <script> tag or a blob URL.

export function buildFiberHookScript(artboardId: string): string {
  // Inline the constants and logic — the iframe has no access to this module.
  return `(function(artboardId) {
  var SOURCE = ${JSON.stringify(RENDERER_SOURCE)};

  // Install the React DevTools global hook BEFORE React loads.
  // React checks for this object at module evaluation time and registers itself.
  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    hook = { renderers: new Map(), _isDisabled: false };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }

  var originalOnCommitFiberRoot = hook.onCommitFiberRoot;

  hook.onCommitFiberRoot = function(rendererId, root, priorityLevel, didError) {
    if (typeof originalOnCommitFiberRoot === 'function') {
      originalOnCommitFiberRoot.call(this, rendererId, root, priorityLevel, didError);
    }
    try {
      var fiberRoot = root.current;
      var tree = serializeFiber(fiberRoot);
      window.parent.postMessage(
        { source: SOURCE, artboardId: artboardId, message: { type: 'FIBER_TREE_UPDATE', root: tree } },
        '*'
      );
    } catch (err) {
      window.parent.postMessage(
        { source: SOURCE, artboardId: artboardId, message: { type: 'ERROR', message: String(err) } },
        '*'
      );
    }
  };

  function serializeFiber(fiber) {
    if (!fiber) return null;
    var name = getDisplayName(fiber);
    if (!name) return serializeFiber(fiber.child) || null;

    var rect = getDomRect(fiber);
    var node = {
      id: String(fiber.index || Math.random()),
      name: name,
      props: serializeProps(fiber.memoizedProps),
      children: [],
      domRect: rect || undefined,
    };

    var child = fiber.child;
    while (child) {
      var serialized = serializeFiber(child);
      if (serialized) node.children.push(serialized);
      child = child.sibling;
    }
    return node;
  }

  function getDisplayName(fiber) {
    var type = fiber.type;
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (type.$$typeof) return type.displayName || type.name || null;
    return null;
  }

  function getDomRect(fiber) {
    try {
      var dom = fiber.stateNode;
      if (dom && dom.getBoundingClientRect) {
        var r = dom.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    } catch (_) {}
    return null;
  }

  function serializeProps(props) {
    if (!props || typeof props !== 'object') return {};
    var out = {};
    for (var key in props) {
      if (key === 'children') continue;
      var val = props[key];
      var type = typeof val;
      if (type === 'string' || type === 'number' || type === 'boolean' || val === null) {
        out[key] = val;
      }
    }
    return out;
  }

  // Signal that the renderer iframe is ready.
  window.parent.postMessage(
    { source: SOURCE, artboardId: artboardId, message: { type: 'READY' } },
    '*'
  );
})(${JSON.stringify(artboardId)});`;
}

// ── Proxy-compatible fiber hook script ────────────────────────────────────────
// Unlike buildFiberHookScript (which bakes in an artboard ID), this version
// reads the artboard ID from `window.name` at runtime. The iframe element sets
// `name="om:<artboardId>"` and this script extracts the ID.
//
// This script is injected by the CLI proxy (`@originmain/cli`) into every HTML
// response, and is also used by the `@originmain/live` SDK. It is fully
// self-contained — no imports, no dependencies.

export function buildProxyFiberHookScript(): string {
  return `(function() {
  // Only activate inside an Originmain iframe
  if (window.parent === window) return;

  var NAME_PREFIX = 'om:';
  var artboardId = '';
  try {
    if (typeof window.name === 'string' && window.name.indexOf(NAME_PREFIX) === 0) {
      artboardId = window.name.slice(NAME_PREFIX.length);
    }
  } catch (e) { /* window.name access denied — not our iframe */ }
  if (!artboardId) return;

  var SOURCE = ${JSON.stringify(RENDERER_SOURCE)};

  function post(msg) {
    try { window.parent.postMessage({ source: SOURCE, artboardId: artboardId, message: msg }, '*'); }
    catch (e) { /* parent unreachable */ }
  }

  // Install the React DevTools global hook BEFORE React loads.
  // If React DevTools extension is already present, wrap its handler.
  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    hook = { renderers: new Map(), supportsFiber: true, _isDisabled: false };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }

  var originalOnCommit = hook.onCommitFiberRoot;

  hook.onCommitFiberRoot = function(rendererId, root, priorityLevel, didError) {
    if (typeof originalOnCommit === 'function') {
      try { originalOnCommit.call(this, rendererId, root, priorityLevel, didError); }
      catch (e) { /* don't break DevTools */ }
    }
    try {
      var fiberRoot = root.current;
      var tree = serializeFiber(fiberRoot);
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
    } catch (err) {
      post({ type: 'ERROR', message: String(err) });
    }
  };

  function serializeFiber(fiber) {
    if (!fiber) return null;
    var name = getDisplayName(fiber);
    if (!name) return serializeFiber(fiber.child) || null;

    var rect = getDomRect(fiber);
    var node = {
      id: String(fiber.index || Math.random()),
      name: name,
      props: serializeProps(fiber.memoizedProps),
      children: [],
    };
    if (rect) node.domRect = rect;

    var child = fiber.child;
    while (child) {
      var serialized = serializeFiber(child);
      if (serialized) node.children.push(serialized);
      child = child.sibling;
    }
    return node;
  }

  function getDisplayName(fiber) {
    var type = fiber.type;
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (type.$$typeof) return type.displayName || type.name || null;
    return null;
  }

  function getDomRect(fiber) {
    try {
      var dom = fiber.stateNode;
      if (dom && typeof dom.getBoundingClientRect === 'function') {
        var r = dom.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    } catch (e) { /* no DOM node */ }
    return null;
  }

  function serializeProps(props) {
    if (!props || typeof props !== 'object') return {};
    var out = {};
    for (var key in props) {
      if (key === 'children') continue;
      var val = props[key];
      var t = typeof val;
      if (t === 'string' || t === 'number' || t === 'boolean' || val === null) {
        out[key] = val;
      }
    }
    return out;
  }

  // Signal that the fiber hook is installed and the iframe is ready.
  post({ type: 'READY' });
})();`;
}

// Re-export types for convenience
export type { FiberNode, DOMRectLike };
