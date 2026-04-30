import { RENDERER_SOURCE, HOST_SOURCE } from './protocol.js';
import type { FiberNode, DOMRectLike } from './protocol.js';

// ── Legacy fiber hook script ──────────────────────────────────────────────────
// @deprecated Use buildProxyFiberHookScript() instead. This version bakes
// the artboard ID into the script at generation time; the proxy-compatible
// version reads it from window.name at runtime.

export function buildFiberHookScript(artboardId: string): string {
  return `(function(artboardId) {
  var SOURCE = ${JSON.stringify(RENDERER_SOURCE)};

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

  window.parent.postMessage(
    { source: SOURCE, artboardId: artboardId, message: { type: 'READY' } },
    '*'
  );
})(${JSON.stringify(artboardId)});`;
}

// ── Proxy-compatible fiber hook script ────────────────────────────────────────
// Reads the artboard ID from window.name at runtime (set by LiveArtboard:
// <iframe name="om:{id}">). Supports full bidirectional protocol:
//
//   Renderer → Host : READY, FIBER_TREE_UPDATE, COMPONENT_SELECTED, ERROR
//   Host → Renderer : SET_DESIGN_TOKENS, NAVIGATE, SELECT_COMPONENT, DESELECT
//
// Node IDs are stable path strings: "Component:idx/Child:idx/…"
// This survives re-renders as long as tree structure is unchanged.
//
// Used by @originmain/cli (proxy injection) and @originmain/live (SDK).

export function buildProxyFiberHookScript(): string {
  return `(function() {
  'use strict';

  // ── Guard: only activate inside an Originmain iframe ─────────────────────
  if (window.parent === window) return;

  var NAME_PREFIX = 'om:';
  var artboardId  = '';
  try {
    if (typeof window.name === 'string' && window.name.indexOf(NAME_PREFIX) === 0) {
      artboardId = window.name.slice(NAME_PREFIX.length);
    }
  } catch (e) { /* sandboxed context — not our iframe */ }
  if (!artboardId) return;

  var RENDERER_SOURCE = ${JSON.stringify(RENDERER_SOURCE)};
  var HOST_SOURCE     = ${JSON.stringify(HOST_SOURCE)};

  // ── Runtime state ─────────────────────────────────────────────────────────
  var nodeMap        = {};          // nodeId → { domRect, fiber }
  var fiberMap       = new WeakMap(); // fiber → nodeId (reverse lookup for click)
  var selectedNodeId = null;        // currently highlighted component
  var highlightEl    = null;        // the blue-ring DOM overlay element

  // ── postMessage helper ────────────────────────────────────────────────────
  function post(msg) {
    try {
      window.parent.postMessage(
        { source: RENDERER_SOURCE, artboardId: artboardId, message: msg }, '*'
      );
    } catch (e) { /* parent unreachable — swallow silently */ }
  }

  // ── React DevTools global hook ────────────────────────────────────────────
  // Must be installed before React evaluates its module body. React checks for
  // __REACT_DEVTOOLS_GLOBAL_HOOK__ exactly once at import time.
  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    hook = { renderers: new Map(), supportsFiber: true, _isDisabled: false };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }

  var _prevCommit = hook.onCommitFiberRoot;

  hook.onCommitFiberRoot = function(rendererId, root, priorityLevel, didError) {
    // Delegate to any pre-existing handler (e.g. React DevTools extension).
    if (typeof _prevCommit === 'function') {
      try { _prevCommit.call(this, rendererId, root, priorityLevel, didError); }
      catch (e) { /* don't break existing DevTools */ }
    }
    try {
      // Reset maps before each walk so stale entries from the previous tree
      // don't accumulate. fiberMap is a WeakMap so it self-cleans, but we
      // rebuild nodeMap from scratch on every commit.
      nodeMap  = {};
      fiberMap = new WeakMap();

      var tree = serializeFiber(root.current, '');
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
      // Re-sync the highlight ring after each React commit (layout may shift).
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
  // children array. Returning only the first named child (the old approach)
  // caused entire subtrees to vanish from the tree.

  function serializeFiber(fiber, parentId) {
    if (!fiber) return null;
    var name = getDisplayName(fiber);
    if (!name) {
      // Unnamed root fiber (HostRoot) — skip to first named child.
      // collectChildren handles the Fragment case recursively.
      var children = [];
      collectChildren(fiber, parentId, children);
      if (children.length === 1) return children[0];
      if (children.length === 0) return null;
      // Multiple named children at root — wrap in a synthetic root node.
      return { id: '__root__', name: '__root__', props: {}, children: children };
    }

    var nodeId = (parentId ? parentId + '/' : '') + name + ':' + String(fiber.index);
    var rect   = getDomRect(fiber);
    var node   = { id: nodeId, name: name, props: serializeProps(fiber.memoizedProps), children: [] };
    if (rect) node.domRect = rect;

    // Register in both maps for O(1) lookup.
    nodeMap[nodeId] = { domRect: rect || null, fiber: fiber };
    fiberMap.set(fiber, nodeId);

    collectChildren(fiber, nodeId, node.children);
    return node;
  }

  // Collect all NAMED descendants of fiber.child into out[], transparently
  // flattening unnamed intermediates (Fragments, Providers, wrappers).
  function collectChildren(fiber, parentId, out) {
    var child = fiber.child;
    while (child) {
      var name = getDisplayName(child);
      if (name) {
        var serialized = serializeFiber(child, parentId);
        if (serialized) out.push(serialized);
      } else {
        // Unnamed (Fragment / Context / Provider / forwardRef wrapper etc.):
        // flatten its children directly into our level — they share parentId.
        fiberMap.set(child, null); // mark as non-selectable
        collectChildren(child, parentId, out);
      }
      child = child.sibling;
    }
  }

  function getDisplayName(fiber) {
    var type = fiber.type;
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (type && type.$$typeof) return type.displayName || type.name || null;
    return null;
  }

  function getDomRect(fiber) {
    try {
      var dom = fiber.stateNode;
      if (dom && typeof dom.getBoundingClientRect === 'function') {
        var r = dom.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    } catch (e) { /* stateNode has no layout (Context, Memo, etc.) */ }
    return null;
  }

  function serializeProps(props) {
    if (!props || typeof props !== 'object') return {};
    var out = {};
    for (var key in props) {
      if (key === 'children') continue;
      var val = props[key];
      var t = typeof val;
      if (t === 'string' || t === 'number' || t === 'boolean' || val === null) out[key] = val;
    }
    return out;
  }

  // ── Highlight overlay (blue ring inside the iframe) ───────────────────────
  // updateHighlight re-measures from the live fiber stateNode so the ring
  // stays accurate even after scroll (between React commits).
  function updateHighlight() {
    var info = selectedNodeId ? nodeMap[selectedNodeId] : null;
    if (!info) { removeHighlight(); return; }

    // Re-measure from the live DOM element for scroll accuracy.
    var rect = info.fiber ? getDomRect(info.fiber) : info.domRect;
    if (rect && rect.width > 0 && rect.height > 0) {
      renderHighlight(rect);
    } else {
      removeHighlight();
    }
  }

  function renderHighlight(rect) {
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
    highlightEl.style.left   = rect.x + 'px';
    highlightEl.style.top    = rect.y + 'px';
    highlightEl.style.width  = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';
  }

  function removeHighlight() {
    if (highlightEl && highlightEl.parentNode) {
      highlightEl.parentNode.removeChild(highlightEl);
      highlightEl = null;
    }
  }

  // Re-measure on scroll so the ring follows the element without needing
  // a React commit (which only fires on state/prop changes).
  window.addEventListener('scroll', function() {
    if (selectedNodeId) updateHighlight();
  }, true);

  // ── Click-to-select (capturing phase) ────────────────────────────────────
  // Uses document.elementFromPoint to get the live DOM element at the click
  // position (accurate even after scroll), then walks the React fiber tree
  // upward via __reactFiber$ keys to find the nearest tracked component.
  // Falls back to a tree-based hit test if the fiber key is not present
  // (e.g. in some SSR-hydrated contexts).

  function getFiberKey(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('__reactFiber$') === 0) return keys[i];
    }
    return null;
  }

  document.addEventListener('click', function(event) {
    // Ignore clicks on our own highlight overlay.
    if (event.target === highlightEl) return;

    var el = document.elementFromPoint(event.clientX, event.clientY);

    // Walk the DOM upward, trying to find a tracked React fiber at each level.
    var current = el;
    while (current && current !== document.documentElement) {
      var fiberKey = current ? getFiberKey(current) : null;
      if (fiberKey) {
        // Walk the fiber's return (parent) chain to find the nearest node we track.
        var fiber = current[fiberKey];
        while (fiber) {
          var nodeId = fiberMap.get(fiber);
          if (nodeId) {
            // Re-measure from the live element for accurate post-scroll rect.
            var liveEl = fiber.stateNode;
            var rect = (liveEl && typeof liveEl.getBoundingClientRect === 'function')
              ? (function(r) { return { x: r.x, y: r.y, width: r.width, height: r.height }; })(liveEl.getBoundingClientRect())
              : null;
            if (rect) {
              post({ type: 'COMPONENT_SELECTED', nodeId: nodeId, rect: rect });
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
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== HOST_SOURCE)    return;
    if (data.artboardId !== artboardId) return;
    var msg = data.message;
    if (!msg) return;

    switch (msg.type) {
      case 'SET_DESIGN_TOKENS':
        if (msg.tokens && typeof msg.tokens === 'object') applyTokens(msg.tokens);
        break;
      case 'NAVIGATE':
        if (typeof msg.path === 'string') doNavigate(msg.path);
        break;
      case 'SELECT_COMPONENT':
        if (typeof msg.nodeId === 'string') {
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

  // Apply DLF design tokens as CSS custom properties on :root.
  function applyTokens(tokens) {
    var root = document.documentElement;
    for (var k in tokens) {
      if (Object.prototype.hasOwnProperty.call(tokens, k)) {
        root.style.setProperty(k, String(tokens[k]));
      }
    }
  }

  // SPA-safe navigation: push to history and fire popstate so framework
  // routers (React Router, Next.js) pick up the route change.
  function doNavigate(path) {
    try {
      history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    } catch (e) { /* navigation not available in this context */ }
  }

  // ── Ready signal ──────────────────────────────────────────────────────────
  post({ type: 'READY' });
})();`;
}

// Re-export types for convenience
export type { FiberNode, DOMRectLike };
