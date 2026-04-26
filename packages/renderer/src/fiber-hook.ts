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

// Re-export types for convenience
export type { FiberNode, DOMRectLike };
