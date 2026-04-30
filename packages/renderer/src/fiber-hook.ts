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
  var currentTree    = null;   // latest serialized FiberNode tree
  var nodeMap        = {};     // nodeId → { domRect }  (flat for O(1) lookup)
  var selectedNodeId = null;   // currently highlighted component
  var highlightEl    = null;   // the blue-ring DOM overlay element

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
      var tree = serializeFiber(root.current, '');
      currentTree = tree;
      rebuildNodeMap(tree);
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
      // Re-sync the highlight ring after each React commit (position may shift).
      if (selectedNodeId) updateHighlight();
    } catch (err) {
      post({ type: 'ERROR', message: String(err) });
    }
  };

  // ── Fiber serialization (stable path-based IDs) ───────────────────────────
  // ID format: "ComponentName:siblingIndex/ChildName:siblingIndex/..."
  // Stable across re-renders provided the tree structure doesn't change.

  function serializeFiber(fiber, parentId) {
    if (!fiber) return null;
    var name = getDisplayName(fiber);

    if (!name) {
      // Unnamed fiber (Fragment, Context, Provider) — skip this level,
      // but keep walking children so named descendants are not lost.
      var c = fiber.child;
      while (c) {
        var s = serializeFiber(c, parentId);
        if (s) return s;
        c = c.sibling;
      }
      return null;
    }

    var nodeId = (parentId ? parentId + '/' : '') + name + ':' + String(fiber.index);
    var rect   = getDomRect(fiber);
    var node   = { id: nodeId, name: name, props: serializeProps(fiber.memoizedProps), children: [] };
    if (rect) node.domRect = rect;

    var child = fiber.child;
    while (child) {
      var serialized = serializeFiber(child, nodeId);
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

  // ── Node map: flat O(1) lookup by stable ID ───────────────────────────────
  function rebuildNodeMap(node) {
    nodeMap = {};
    fillMap(node);
  }
  function fillMap(node) {
    if (!node) return;
    nodeMap[node.id] = { domRect: node.domRect || null };
    var children = node.children;
    for (var i = 0; i < children.length; i++) fillMap(children[i]);
  }

  // ── Highlight overlay (blue ring inside the iframe) ───────────────────────
  function updateHighlight() {
    var info = nodeMap[selectedNodeId];
    if (info && info.domRect) renderHighlight(info.domRect);
    else removeHighlight();
  }

  function renderHighlight(rect) {
    if (!highlightEl) {
      highlightEl = document.createElement('div');
      highlightEl.id = '__om_sel__';
      highlightEl.setAttribute('aria-hidden', 'true');
      // CSS kept inline so no stylesheet dependency. Transition animates when
      // the selected component moves (e.g. during a re-render or scroll).
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

  // ── Click-to-select (capturing phase) ────────────────────────────────────
  // Finds the deepest named fiber node at the click point and reports it back.
  // In normal canvas usage the SelectionOverlay sits on top of the iframe and
  // this listener fires when the overlay is bypassed (e.g. direct preview mode).

  document.addEventListener('click', function(event) {
    var node = findDeepestAt(currentTree, event.clientX, event.clientY);
    if (node && node.domRect) {
      post({ type: 'COMPONENT_SELECTED', nodeId: node.id, rect: node.domRect });
    }
  }, true);

  function findDeepestAt(node, x, y) {
    if (!node) return null;
    var r   = node.domRect;
    var hit = r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

    if (hit) {
      // Matched — recurse children for a deeper (more specific) match.
      var children = node.children;
      for (var i = 0; i < children.length; i++) {
        var deeper = findDeepestAt(children[i], x, y);
        if (deeper) return deeper;
      }
      return node;
    }

    // No hit on this node — still check children for overflow:visible cases.
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      var found = findDeepestAt(children[i], x, y);
      if (found) return found;
    }
    return null;
  }

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
