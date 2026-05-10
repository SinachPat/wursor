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
    var _legacyNextId = 0;
    hook = {
      renderers: new Map(), supportsFiber: true, _isDisabled: false,
      inject: function(r) { var id = ++_legacyNextId; hook.renderers.set(id, r); return id; },
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  } else if (typeof hook.inject !== 'function') {
    var _legacyNextId2 = 0;
    hook.inject = function(r) { var id = ++_legacyNextId2; hook.renderers.set(id, r); return id; };
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

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // The proxy may inject this script in two positions (after <head> and before
  // </body>) for redundancy. If the script already ran in this iframe, the
  // second invocation must be a no-op. We tag a window-level marker on first
  // execution and bail on subsequent ones.
  if (window.__OM_FIBER_HOOK_INSTALLED__) return;
  try {
    Object.defineProperty(window, '__OM_FIBER_HOOK_INSTALLED__', {
      value: true, writable: false, configurable: false,
    });
  } catch (e) { window.__OM_FIBER_HOOK_INSTALLED__ = true; }

  // ── Guard: only activate inside an Originmain iframe ─────────────────────
  if (window.parent === window) return;

  // ── Resolve the artboard ID ──────────────────────────────────────────────
  // Chrome 88+ clears window.name on cross-origin iframe loads (Spectre / side-
  // channel mitigation), so we cannot rely on the iframe element's name=
  // attribute alone. We try four sources in priority order:
  //
  //   1. URL fragment   #__om_artboard=xxx  (set by LiveArtboard on the src URL)
  //   2. window.name    om:xxx              (legacy; works for same-origin)
  //   3. sessionStorage __om_artboard_id__  (preserved across navigations)
  //   4. postMessage handshake to the parent (last-resort, async)

  function tryFragment() {
    try {
      var m = (window.location.hash || '').match(/__om_artboard=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch(e) { return null; }
  }
  function tryWindowName() {
    try {
      if (typeof window.name === 'string' && window.name.indexOf('om:') === 0) {
        return window.name.slice(3);
      }
    } catch(e) {}
    return null;
  }
  function trySessionStorage() {
    try { return sessionStorage.getItem('__om_artboard_id__'); } catch(e) { return null; }
  }
  function persistArtboardId(id) {
    try { sessionStorage.setItem('__om_artboard_id__', id); } catch(e) {}
  }

  var artboardId = tryFragment() || tryWindowName() || trySessionStorage();

  // Diagnostic tag uses 'pending' before the ID is known so console messages
  // are still readable during the handshake window.
  var OM_TAG = '[Originmain hook ' + (artboardId ? artboardId.slice(0, 6) : 'pending') + ']';
  console.log(OM_TAG, 'script active, artboardId=' + (artboardId || '(awaiting handshake)'));

  if (artboardId) persistArtboardId(artboardId);

  var RENDERER_SOURCE = ${JSON.stringify(RENDERER_SOURCE)};
  var HOST_SOURCE     = ${JSON.stringify(HOST_SOURCE)};

  // ── Runtime state ─────────────────────────────────────────────────────────
  var nodeMap        = {};          // nodeId → { domRect, fiber }
  var fiberMap       = new WeakMap(); // fiber → nodeId (reverse lookup for click)
  var selectedNodeId = null;        // currently highlighted component
  var highlightEl    = null;        // the blue-ring DOM overlay element

  // ── Style override persistence (H-7 fix) ─────────────────────────────────
  // Inline styles set by PATCH_ELEMENT_STYLE are wiped by React on the next
  // reconciliation of the patched component. To make patches survive, we
  // mirror them into an external stylesheet keyed by a data-om-id attribute
  // that we re-tag onto the DOM on every commit.
  //
  //   styleOverrides[nodeId][property]                        = value
  //   childrenStyleOverrides[parentId][selector][property]    = value
  //
  // After each commit we (a) rewrite data-om-id on every nodeMap element so
  // the selectors still match, and (b) rebuild the <style> sheet text.
  // Cascade wins over component styles because every rule is !important.
  var styleOverrides         = {};   // nodeId -> { property -> value }
  var childrenStyleOverrides = {};   // parentNodeId -> { selector -> { property -> value } }
  var overrideStyleEl        = null; // the <style id="__om_overrides__"> element

  // ── Snapshot / thumbnail capture state ───────────────────────────────────
  var _snapshotGeneration = 0;      // incremented on CANCEL_SNAPSHOT to invalidate in-flight captures
  var _html2canvasLoading = null;   // cached Promise<html2canvas> — only inject script once

  // ── postMessage helper ────────────────────────────────────────────────────
  // No-op until artboardId is known (handshake may still be pending).
  function post(msg) {
    if (!artboardId) return;
    try {
      window.parent.postMessage(
        { source: RENDERER_SOURCE, artboardId: artboardId, message: msg }, '*'
      );
    } catch (e) { /* parent unreachable — swallow silently */ }
  }

  // ── React DevTools global hook ────────────────────────────────────────────
  // Strategy: PATCH the hook that window.__REACT_DEVTOOLS_GLOBAL_HOOK__ already
  // points to, rather than creating a new object.
  //
  // WHY patching beats replacing:
  //   The Chrome DevTools extension injects at document_start (before HTML
  //   parsing) and often locks window.__REACT_DEVTOOLS_GLOBAL_HOOK__ as
  //   { configurable: false, writable: false }. Any attempt to replace the
  //   global property silently no-ops. We'd end up with getter/setter on a
  //   fresh hook object that React and React Refresh never see.
  //
  // WHAT we patch:
  //   1. Supplement missing methods (renderers, checkDCE, onScheduleFiberRoot …)
  //      so every method React 19 and React Refresh might call is present.
  //   2. Redefine hook.inject as a getter/setter accessor:
  //      GET → always returns _omInjectCurrent (never undefined, never throws).
  //      SET → when React Refresh does  hook.inject = wrapper(oldInject),
  //            our setter wraps the wrapper in try/catch so that even a
  //            broken wrapper (where oldInject was captured as undefined by an
  //            earlier DevTools stub) falls back to our own ID allocation.
  //   3. isDisabled must be false — React Refresh bails out if truthy.

  // Get (or lazily create) the global hook.
  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    hook = {};
    try {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
    } catch(e) { /* locked — nothing we can do; hook is still a valid object */ }
  }

  // Save any pre-existing onCommitFiberRoot (e.g. from DevTools extension).
  var _prevCommit = typeof hook.onCommitFiberRoot === 'function'
    ? hook.onCommitFiberRoot : null;

  // Supplement missing properties (safe to assign even on a locked global —
  // the global itself is locked, not the hook object's properties).
  if (!hook.renderers)             hook.renderers             = new Map();
  if (!hook.supportsFiber)         hook.supportsFiber         = true;
  if (hook.isDisabled === undefined) hook.isDisabled           = false;
  if (!hook.checkDCE)              hook.checkDCE              = function() {};
  if (!hook.onScheduleFiberRoot)   hook.onScheduleFiberRoot   = function() {};
  if (!hook.onCommitFiberUnmount)  hook.onCommitFiberUnmount  = function() {};
  if (!hook.onPostCommitFiberRoot) hook.onPostCommitFiberRoot = function() {};
  if (!hook.onCommitFiberRoot)     hook.onCommitFiberRoot     = null; // set below

  // ── Protect inject with a getter/setter accessor ──────────────────────────
  // Our getter always returns _omInjectCurrent — a function that never throws.
  // React Refresh does:
  //   var oldInject = hook.inject;       // reads our getter → our function
  //   hook.inject = function(r) {        // triggers our setter
  //     var id = oldInject.apply(…);     // calls our function (not undefined)
  //   };
  // Even if React Refresh ran BEFORE our script and already set hook.inject to
  // a broken wrapper (where oldInject===undefined), our setter replaces it with
  // a try-catch-guarded version that falls back on error.

  var _omNextId = 0;
  var _omInjectCurrent = function(renderer) {
    try {
      var id = ++_omNextId;
      hook.renderers.set(id, renderer);
      console.log(OM_TAG, 'inject() called, rendererId=' + id);
      return id;
    } catch(e) {
      return ++_omNextId;
    }
  };

  try {
    Object.defineProperty(hook, 'inject', {
      configurable: true,
      enumerable:   true,
      get: function() { return _omInjectCurrent; },
      set: function(fn) {
        if (typeof fn !== 'function') return;
        var wrapped = fn;
        _omInjectCurrent = function(renderer) {
          try {
            return wrapped.apply(this, arguments);
          } catch(e) {
            // React Refresh's wrapper tried to call an undefined oldInject — fall back.
            console.log(OM_TAG, 'inject() fallback after wrapper error, id=' + (_omNextId + 1));
            var id = ++_omNextId;
            hook.renderers.set(id, renderer);
            return id;
          }
        };
      },
    });
  } catch(e) {
    // inject property itself is non-configurable — overwrite directly.
    // This is a best-effort last resort; the try-catch in the function body
    // at least prevents React from seeing an exception from hook.inject().
    hook.inject = _omInjectCurrent;
  }

  hook.onCommitFiberRoot = function(rendererId, root, priorityLevel, didError) {
    console.log(OM_TAG, 'onCommitFiberRoot fired, rendererId=' + rendererId);
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
      console.log(OM_TAG, 'tree serialized, posting FIBER_TREE_UPDATE, root=' + (tree ? tree.name : 'null'));
      // H-7 fix: re-tag DOM with data-om-id and reapply the override sheet
      // BEFORE telling the host the tree updated, so the visual is consistent
      // by the time the host repaints its inspector.
      reapplyOverrides();
      post({ type: 'FIBER_TREE_UPDATE', root: tree });
      // Re-sync the highlight ring after each React commit (layout may shift).
      if (selectedNodeId) updateHighlight();
    } catch (err) {
      console.error(OM_TAG, 'onCommitFiberRoot error:', err);
      post({ type: 'ERROR', message: String(err) });
    }
  };

  // ── Fiber serialization (stable path-based IDs) ───────────────────────────
  // ID format: "ComponentName:siblingIndex/ChildName:siblingIndex/..."
  //
  // siblingIndex is the position among VISIBLE (named) siblings at the same
  // flattened level — NOT fiber.index. Using fiber.index caused H-2: two
  // same-named components living under different transparent wrappers
  // (Fragment, Context.Provider, React.memo) both had fiber.index === 0
  // relative to their own React parent, so when collectChildren flattened
  // them into the same visible level they collided to the same nodeId.
  //
  // IMPORTANT: unnamed fibers (Fragment, Context.Provider, React.memo wrappers)
  // are transparent — their children are collected directly into their parent's
  // children array. Returning only the first named child (the old approach)
  // caused entire subtrees to vanish from the tree.

  function serializeFiber(fiber, parentId, siblingIndex) {
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

    var nodeId = (parentId ? parentId + '/' : '') + name + ':' + String(siblingIndex || 0);
    var rect   = getDomRect(fiber);
    var node   = { id: nodeId, name: name, props: serializeProps(fiber.memoizedProps), children: [] };
    if (rect) node.domRect = rect;

    // ── _debugSource extraction (Phase 1) ────────────────────────────────────
    // _debugSource is set by React's dev build on every fiber created from JSX.
    // It points to the JSX call site (the file that wrote <ComponentName />),
    // NOT the definition file. Only present when __DEV__ === true.
    // We only read it for function/class components (typeof fiber.type === 'function')
    // to avoid bogus call-site data on host elements (div, span, etc.).
    try {
      if (fiber._debugSource && typeof fiber.type === 'function') {
        var ds = fiber._debugSource;
        if (ds.fileName && typeof ds.lineNumber === 'number') {
          node.callSite = { fileName: ds.fileName, lineNumber: ds.lineNumber };
          if (typeof ds.columnNumber === 'number') node.callSite.columnNumber = ds.columnNumber;
        }
      }
    } catch (e) { /* _debugSource access can throw in some SSR contexts */ }

    // Register in both maps for O(1) lookup.
    nodeMap[nodeId] = { domRect: rect || null, fiber: fiber };
    fiberMap.set(fiber, nodeId);

    collectChildren(fiber, nodeId, node.children);
    return node;
  }

  // Walk a fiber subtree to find the nearest host DOM node (div, span, etc.).
  // Traverses both .child and .sibling so that components whose first child
  // branch is a non-DOM composite (e.g. a Context.Provider sibling to a div)
  // are handled correctly.
  function findDomElement(fiber) {
    if (!fiber) return null;
    var sn = fiber.stateNode;
    if (sn && typeof sn.style !== 'undefined') return sn;
    var fromChild = findDomElement(fiber.child);
    if (fromChild) return fromChild;
    return findDomElement(fiber.sibling);
  }

  // Collect all NAMED descendants of fiber.child into out[], transparently
  // flattening unnamed intermediates (Fragments, Providers, wrappers).
  //
  // The sibling counter (counterRef.n) is per-VISIBLE-LEVEL, so it survives
  // the recursion into transparent wrappers — that's how H-2 (nodeId
  // collision across same-named siblings under different wrappers) is
  // prevented. Pass the same counterRef to recursive calls.
  function collectChildren(fiber, parentId, out, counterRef) {
    if (!counterRef) counterRef = { n: 0 };
    var child = fiber.child;
    while (child) {
      var name = getDisplayName(child);
      if (name) {
        var serialized = serializeFiber(child, parentId, counterRef.n);
        if (serialized) {
          out.push(serialized);
          counterRef.n += 1;
        }
      } else {
        // Unnamed (Fragment / Context / Provider / forwardRef wrapper etc.):
        // flatten its children directly into our level — they share parentId
        // AND the visible sibling counter, so a Fragment never resets indices.
        fiberMap.set(child, null); // mark as non-selectable
        collectChildren(child, parentId, out, counterRef);
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

  // ── Style override sheet (H-7 fix) ───────────────────────────────────────
  // CSS attribute selector values are quoted, so "/" and ":" inside the
  // nodeId need no escaping. We do escape backslash and double-quote
  // defensively in case future ID schemes introduce them.
  function escapeAttrValue(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // CSS property names from the inspector are already lowercase kebab-case.
  // Block anything that isn't a CSS-safe identifier so a malicious patch
  // payload can't inject rule terminators or other declarations.
  function isSafeCssProp(p) {
    return typeof p === 'string' && /^-?[a-z][a-z0-9-]*$/.test(p);
  }

  // Block stylesheet-breaking characters in the value: braces, semicolons,
  // angle brackets, backslashes, line breaks, and CSS comment markers. Inline
  // setProperty (used for the immediate paint) is already safe — this is
  // strictly to keep the override stylesheet text well-formed.
  function isSafeCssValue(v) {
    if (typeof v !== 'string' || v.length > 500) return false;
    if (/[{};<>\\\n\r]/.test(v)) return false;
    if (v.indexOf('/*') !== -1 || v.indexOf('*/') !== -1) return false;
    return true;
  }

  function ensureOverrideStyleEl() {
    if (overrideStyleEl && overrideStyleEl.parentNode) return overrideStyleEl;
    var el = document.getElementById('__om_overrides__');
    if (!el) {
      el = document.createElement('style');
      el.id = '__om_overrides__';
      el.setAttribute('data-originmain', 'overrides');
      // Append to <head> so it lives past component remounts.
      (document.head || document.documentElement).appendChild(el);
    }
    overrideStyleEl = el;
    return el;
  }

  function tagDomWithIds() {
    for (var id in nodeMap) {
      if (!Object.prototype.hasOwnProperty.call(nodeMap, id)) continue;
      var info = nodeMap[id];
      if (!info) continue;
      var el = findDomElement(info.fiber);
      if (el && typeof el.setAttribute === 'function') {
        // Idempotent: only write if the attribute is missing or stale.
        if (el.getAttribute('data-om-id') !== id) el.setAttribute('data-om-id', id);
      }
    }
  }

  function buildOverrideCss() {
    var parts = [];
    for (var id in styleOverrides) {
      if (!Object.prototype.hasOwnProperty.call(styleOverrides, id)) continue;
      var props = styleOverrides[id];
      var decls = [];
      for (var p in props) {
        if (!Object.prototype.hasOwnProperty.call(props, p)) continue;
        if (!isSafeCssProp(p) || !isSafeCssValue(props[p])) continue;
        decls.push(p + ':' + props[p] + ' !important');
      }
      if (decls.length) {
        parts.push('[data-om-id="' + escapeAttrValue(id) + '"]{' + decls.join(';') + '}');
      }
    }
    for (var pid in childrenStyleOverrides) {
      if (!Object.prototype.hasOwnProperty.call(childrenStyleOverrides, pid)) continue;
      var bySel = childrenStyleOverrides[pid];
      for (var sel in bySel) {
        if (!Object.prototype.hasOwnProperty.call(bySel, sel)) continue;
        if (!/^[a-z][a-z0-9-]*$/i.test(sel)) continue;
        var cprops = bySel[sel];
        var cdecls = [];
        for (var cp in cprops) {
          if (!Object.prototype.hasOwnProperty.call(cprops, cp)) continue;
          if (!isSafeCssProp(cp) || !isSafeCssValue(cprops[cp])) continue;
          cdecls.push(cp + ':' + cprops[cp] + ' !important');
        }
        if (cdecls.length) {
          parts.push(
            '[data-om-id="' + escapeAttrValue(pid) + '"]>' + sel +
            '{' + cdecls.join(';') + '}'
          );
        }
      }
    }
    return parts.join('\n');
  }

  function reapplyOverrides() {
    var hasAny = false;
    for (var k in styleOverrides) { hasAny = true; break; }
    if (!hasAny) {
      for (var k2 in childrenStyleOverrides) { hasAny = true; break; }
    }
    // Cheap exit only when nothing has ever been recorded AND no sheet exists.
    // If the sheet exists with stale rules (e.g. user just cleared the last
    // override), we must run through to write the empty CSS back.
    if (!hasAny && !overrideStyleEl) return;
    if (hasAny) tagDomWithIds();
    var el = ensureOverrideStyleEl();
    var css = hasAny ? buildOverrideCss() : '';
    if (el.textContent !== css) el.textContent = css;
  }

  function recordStyleOverride(nodeId, property, value) {
    if (!isSafeCssProp(property)) return;
    var bag = styleOverrides[nodeId];
    if (!bag) bag = styleOverrides[nodeId] = {};
    if (value === '' || value == null) {
      delete bag[property];
      var hasAnyProp = false;
      for (var p in bag) { hasAnyProp = true; break; }
      if (!hasAnyProp) delete styleOverrides[nodeId];
    } else if (isSafeCssValue(String(value))) {
      bag[property] = String(value);
    }
  }

  function recordChildrenStyleOverride(parentId, selector, property, value) {
    if (!/^[a-z][a-z0-9-]*$/i.test(selector)) return;
    if (!isSafeCssProp(property)) return;
    var bySel = childrenStyleOverrides[parentId];
    if (!bySel) bySel = childrenStyleOverrides[parentId] = {};
    var bag = bySel[selector];
    if (!bag) bag = bySel[selector] = {};
    if (value === '' || value == null) {
      delete bag[property];
    } else if (isSafeCssValue(String(value))) {
      bag[property] = String(value);
    }
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

    // INIT_RESPONSE handshake — handled BEFORE the artboardId match because
    // it is what teaches us our artboardId in the first place.
    if (data.__om_init_response && typeof data.artboardId === 'string') {
      if (!artboardId) {
        artboardId = data.artboardId;
        persistArtboardId(artboardId);
        OM_TAG = '[Originmain hook ' + artboardId.slice(0, 6) + ']';
        console.log(OM_TAG, 'received artboardId via handshake');
        if (typeof startMainLoop === 'function') startMainLoop();
      }
      return;
    }

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
      case 'REQUEST_ELEMENT_STYLES':
        if (typeof msg.nodeId === 'string') {
          var rInfo = nodeMap[msg.nodeId];
          if (rInfo) {
            var rEl = findDomElement(rInfo.fiber);
            if (rEl) {
              var cs = window.getComputedStyle(rEl);
              var styleProps = [
                'width','height','background-color','color','font-size',
                'font-family','font-weight','line-height','letter-spacing','text-align',
                'display','flex-direction','flex-wrap','gap','row-gap','column-gap',
                'align-items','align-content','justify-content','justify-items',
                'padding-top','padding-right','padding-bottom','padding-left',
                'margin-top','margin-right','margin-bottom','margin-left',
                'border-radius','border-top-left-radius','border-top-right-radius',
                'border-bottom-right-radius','border-bottom-left-radius',
                'border-width','border-color','border-style',
                'opacity','box-shadow','filter','backdrop-filter',
                'overflow','position','left','top','right','bottom',
                'transform','text-decoration','text-transform',
                'grid-template-columns','grid-template-rows',
              ];
              var styles = {};
              styleProps.forEach(function(p) { styles[p] = cs.getPropertyValue(p); });

              // ── Structural flags for Typography section (Phase 2) ──────────
              // hasDirectText: does the element have a direct text node with content?
              var hasDirectText = false;
              var nodes = rEl.childNodes;
              for (var ci = 0; ci < nodes.length; ci++) {
                if (nodes[ci].nodeType === 3 && nodes[ci].textContent.trim().length > 0) {
                  hasDirectText = true;
                  break;
                }
              }
              // hasParagraphChildren: does the element have at least one direct <p> child?
              var hasParagraphChildren = rEl.querySelector(':scope > p') !== null;

              post({
                type: 'ELEMENT_STYLES',
                nodeId: msg.nodeId,
                styles: styles,
                hasDirectText: hasDirectText,
                hasParagraphChildren: hasParagraphChildren,
              });
            }
          }
        }
        break;
      case 'PATCH_ELEMENT_STYLE':
        if (typeof msg.nodeId === 'string' && typeof msg.property === 'string') {
          // C-4 fix: (msg.value || '') is falsy for 0, which removes the property.
          // Use explicit null check so zero values are applied correctly.
          var pVal = msg.value != null ? String(msg.value) : '';
          // H-7 fix: record into the override stylesheet FIRST so the patch
          // survives the next React reconciliation. Then also apply inline
          // for an immediate, no-flicker visual update on this paint.
          recordStyleOverride(msg.nodeId, msg.property, pVal);
          var pInfo = nodeMap[msg.nodeId];
          if (pInfo) {
            var pEl = findDomElement(pInfo.fiber);
            if (pEl) pEl.style.setProperty(msg.property, pVal);
          }
          reapplyOverrides();
        }
        break;
      case 'PATCH_CHILDREN_STYLE':
        // Apply a CSS property to all matching direct children of a node.
        // Used for paragraph-spacing: patches margin-bottom on each direct <p> child.
        if (typeof msg.parentNodeId === 'string' && typeof msg.property === 'string') {
          if (typeof msg.selector !== 'string') break;
          // C-5 security fix: validate selector against a simple element-name
          // allowlist before passing to querySelectorAll. An unconstrained
          // msg.selector could be crafted to inject CSS or throw a DOMException.
          if (!/^[a-z][a-z0-9-]*$/i.test(msg.selector)) break;
          var pcVal = msg.value != null ? String(msg.value) : '';
          // H-7 fix: persist children-style patches the same way.
          recordChildrenStyleOverride(msg.parentNodeId, msg.selector, msg.property, pcVal);
          var pcInfo = nodeMap[msg.parentNodeId];
          if (pcInfo) {
            var pcEl = findDomElement(pcInfo.fiber);
            if (pcEl) {
              var children = pcEl.querySelectorAll(':scope > ' + msg.selector);
              for (var ci2 = 0; ci2 < children.length; ci2++) {
                children[ci2].style.setProperty(msg.property, pcVal);
              }
            }
          }
          reapplyOverrides();
        }
        break;
      case 'REMOVE_ELEMENT':
        if (typeof msg.nodeId === 'string') {
          var dInfo = nodeMap[msg.nodeId];
          if (dInfo) {
            var dEl = findDomElement(dInfo.fiber);
            if (dEl) {
              dEl.style.setProperty('display', 'none');
              // Clear the selection so the highlight ring doesn't linger over
              // the now-invisible element on the next React commit.
              if (selectedNodeId === msg.nodeId) {
                selectedNodeId = null;
                removeHighlight();
                post({ type: 'COMPONENT_DESELECTED' });
              }
            }
          }
        }
        break;
      case 'CAPTURE_THUMBNAIL':
        // Phase 0: capture the full page as a JPEG thumbnail via html2canvas.
        // Sent when an artboard transitions Active → Far in the viewport culling system.
        loadHtml2Canvas().then(function(h2c) {
          return h2c(document.body, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: 0.5,            // half-resolution thumbnail keeps payload small
            imageTimeout: 4000,
          });
        }).then(function(canvas) {
          post({ type: 'THUMBNAIL_READY', dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
        }).catch(function() {
          post({ type: 'THUMBNAIL_READY', dataUrl: null });
        });
        break;
      case 'UPDATE_ISOLATION_PROPS':
        // Phase 0/3: update isolation artboard props and trigger a re-render.
        // The isolation page exposes window.__OM_ISO_RENDER__() which calls
        // ReactDOM.render / root.render with the new window.__OM_ISO_PROPS__.
        if (msg.props && typeof msg.props === 'object') {
          window.__OM_ISO_PROPS__ = msg.props;
          if (typeof window.__OM_ISO_RENDER__ === 'function') {
            try { window.__OM_ISO_RENDER__(); } catch(e) { /* renderer not yet mounted */ }
          }
        }
        break;
      case 'CANCEL_SNAPSHOT':
        // Phase 4: invalidate any pending CAPTURE_SNAPSHOT by bumping the generation
        // counter — any in-flight html2canvas call will see the mismatch and drop its result.
        _snapshotGeneration += 1;
        break;
      case 'CAPTURE_SNAPSHOT':
        // Phase 4: capture a PNG of the selected element, used by the Code Preview diff.
        // Guards against stale results with a per-capture generation counter.
        if (typeof msg.nodeId !== 'string') break;
        _snapshotGeneration += 1;
        (function(nodeId, gen) {
          var sInfo = nodeMap[nodeId];
          var sEl = sInfo ? findDomElement(sInfo.fiber) : null;
          if (!sEl) {
            post({ type: 'SNAPSHOT_READY', dataUrl: null, nodeId: nodeId });
            return;
          }
          loadHtml2Canvas().then(function(h2c) {
            if (_snapshotGeneration !== gen) return null;
            return h2c(sEl, { useCORS: true, allowTaint: true, logging: false, timeout: 3000 });
          }).then(function(canvas) {
            if (!canvas || _snapshotGeneration !== gen) return;
            post({ type: 'SNAPSHOT_READY', dataUrl: canvas.toDataURL('image/png'), nodeId: nodeId });
          }).catch(function() {
            if (_snapshotGeneration === gen) post({ type: 'SNAPSHOT_READY', dataUrl: null, nodeId: nodeId });
          });
        })(msg.nodeId, _snapshotGeneration);
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

  // ── html2canvas lazy loader ───────────────────────────────────────────────
  // The Originmain proxy serves html2canvas at /__om_h2c__.js (embedded at
  // build time in the CLI bundle — no CDN, no external network dependency).
  // The script tag uses the same origin as the proxy, so no CORS or CSP issues.
  function loadHtml2Canvas() {
    if (typeof window.html2canvas === 'function') {
      return Promise.resolve(window.html2canvas);
    }
    if (_html2canvasLoading) return _html2canvasLoading;
    _html2canvasLoading = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = '/__om_h2c__.js';
      s.onload  = function() { resolve(window.html2canvas); };
      s.onerror = function() { _html2canvasLoading = null; reject(new Error('html2canvas load failed (/__om_h2c__.js)')); };
      (document.head || document.documentElement).appendChild(s);
    });
    return _html2canvasLoading;
  }

  // SPA-safe navigation: push to history and fire popstate so framework
  // routers (React Router, Next.js) pick up the route change.
  function doNavigate(path) {
    try {
      history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    } catch (e) { /* navigation not available in this context */ }
  }

  // ── Route discovery ───────────────────────────────────────────────────────
  // Mines routes from four sources (in priority order):
  //  1. window.__NEXT_DATA__ (Next.js Pages Router build manifest)
  //  2. window.__next_router_basepath (App Router)
  //  3. <a href> same-origin anchor links in the rendered DOM
  //  4. Fiber nodeMap — Link/NavLink/NextLink component props
  // Called 800 ms after READY and on every SPA popstate navigation.

  function humanLabel(path) {
    var seg = path.replace(/\/+$/, '').split('/').filter(function(s) { return s.length > 0; });
    if (seg.length === 0) return 'Home';
    var last = seg[seg.length - 1];
    return last.replace(/[-_]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }

  function discoverRoutes() {
    var seen = {};
    var routes = [];

    function addRoute(path, hint) {
      if (!path || typeof path !== 'string') return;
      // Skip hash fragments, external links that slipped through, and dynamic segments
      if (path.charAt(0) !== '/') return;
      // M-4 fix: the original regex /\\/+$/ matched a literal backslash, not a
      // forward slash. Correct regex is /\/+$/.
      var norm = path.length > 1 ? path.replace(/\/+$/, '') : '/';
      if (seen[norm]) return;
      seen[norm] = true;
      var label = (hint && typeof hint === 'string' && hint.trim().slice(0, 50)) || humanLabel(norm);
      routes.push({ path: norm, label: label });
    }

    // ① Current page is always included
    addRoute(window.location.pathname, document.title || undefined);

    // ② Next.js Pages Router — __NEXT_DATA__ contains the full page list in build id manifest
    // H-1 fix: replaced synchronous XHR (deprecated, blocks main thread) with
    // async fetch. Route discovery happens in a setTimeout callback so async is safe.
    (function() {
      try {
        var nextData = window.__NEXT_DATA__;
        if (nextData && nextData.buildId) {
          var manifestUrl = '/_next/static/' + nextData.buildId + '/_buildManifest.js';
          fetch(manifestUrl).then(function(res) {
            if (!res.ok) return;
            return res.text();
          }).then(function(text) {
            if (!text) return;
            var match = text.match(/sortedPages\s*:\s*(\[[^\]]+\])/);
            if (match) {
              try {
                var pages = JSON.parse(match[1]);
                pages.forEach(function(p) {
                  if (p.indexOf('[') === -1) addRoute(p);
                });
                // Re-post now that we have more routes from the manifest.
                post({ type: 'ROUTES_DISCOVERED', routes: routes.slice() });
              } catch (e) { /* parse failed */ }
            }
          }).catch(function() { /* manifest unavailable */ });
        }
      } catch (e) { /* Next.js not present */ }
    })();

    // ③ <a href> links — relative paths AND same-origin absolute URLs.
    // When running through the CLI proxy, the page's links still point to the
    // original domain (e.g. intraining.com), not the proxy (localhost:4170).
    // A strict same-origin check would reject all of them.  Instead, accept
    // any href that is already a root-relative path ("/courses"), plus
    // same-origin absolute URLs for direct (non-proxied) connections.
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      try {
        var rawHref = (anchors[i].getAttribute('href') || '').trim();
        // Root-relative paths — always valid routes regardless of origin
        if (rawHref.charAt(0) === '/') {
          addRoute(rawHref, (anchors[i].textContent || '').trim() || undefined);
          continue;
        }
        // Absolute URLs — only add if same-origin (direct connection)
        var url = new URL(anchors[i].href, window.location.href);
        if (url.origin !== window.location.origin) continue;
        if (!url.pathname || (url.hash && !url.pathname)) continue;
        addRoute(url.pathname, (anchors[i].textContent || '').trim() || undefined);
      } catch (e) { /* skip malformed hrefs */ }
    }

    // ④ Fiber nodeMap — Link/NavLink props carry href/to
    Object.keys(nodeMap).forEach(function(nid) {
      var entry = nodeMap[nid];
      var fiber = entry && entry.fiber;
      var name = fiber ? getDisplayName(fiber) : null;
      if (name && /^(Link|NavLink|NextLink|RouterLink|a)$/.test(name)) {
        var props = fiber.memoizedProps;
        var href = props && (props.href || props.to);
        if (typeof href === 'string') addRoute(href);
        // Next.js <Link href={{ pathname }}>
        if (href && typeof href === 'object' && typeof href.pathname === 'string') {
          addRoute(href.pathname);
        }
      }
    });

    if (routes.length > 0) post({ type: 'ROUTES_DISCOVERED', routes: routes });
  }

  // ── DOM-driven fiber capture ──────────────────────────────────────────────
  // React annotates every host DOM element with __reactFiber$xxx and every
  // root container (including document for App Router's hydrateRoot(document))
  // with __reactContainer$xxx. We walk these annotations up to the HostRoot
  // and serialize the tree, exactly as onCommitFiberRoot would.
  //
  // This is our PRIMARY mechanism — the React DevTools hook (with all its
  // browser-extension and React-Refresh timing hazards) is treated as a
  // secondary signal. Even if the hook integration is completely broken,
  // polling + MutationObserver will eventually find the tree.

  function getFiberFromEl(el) {
    if (!el) return null;
    var keys;
    try { keys = Object.keys(el); } catch(e) { return null; }
    var fiberKey = null, containerKey = null;
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      if (!fiberKey && k.indexOf('__reactFiber$') === 0) fiberKey = k;
      else if (!containerKey && k.indexOf('__reactContainer$') === 0) containerKey = k;
    }
    if (fiberKey) return el[fiberKey];                // direct fiber reference
    if (containerKey) {                                // FiberRoot — use .current
      var fr = el[containerKey];
      return fr && fr.current ? fr.current : null;
    }
    return null;
  }

  // Returns true if a fiber tree was found and posted, false otherwise.
  function captureExistingTree() {
    // Priority candidates: most common React root containers.
    var candidates = [
      document.getElementById('__next'),       // Next.js Pages Router
      document.getElementById('root'),         // CRA / Vite
      document.getElementById('app'),          // Generic
      document,                                 // Next.js App Router: hydrateRoot(document)
      document.documentElement,                 // <html>
      document.body,                            // <body>
    ];

    var fiber = null;
    for (var ci = 0; ci < candidates.length && !fiber; ci++) {
      fiber = getFiberFromEl(candidates[ci]);
    }

    // Fallback: scan every element in <html> for annotations. This catches
    // any framework whose root container we don't recognise.
    if (!fiber) {
      var root = document.documentElement || document.body;
      if (root) {
        var allEls = root.querySelectorAll('*');
        for (var di = 0; di < allEls.length && !fiber; di++) {
          fiber = getFiberFromEl(allEls[di]);
        }
      }
    }

    if (!fiber) return false;

    // Walk up to the HostRoot (the sentinel fiber React builds the tree from).
    var f = fiber;
    while (f.return) f = f.return;

    // Rebuild maps and serialize — identical to what onCommitFiberRoot does.
    nodeMap  = {};
    fiberMap = new WeakMap();
    var tree = serializeFiber(f, '');
    if (!tree) return false;

    console.log(OM_TAG, 'captureExistingTree: posted tree, root=' + tree.name);
    reapplyOverrides();
    post({ type: 'FIBER_TREE_UPDATE', root: tree });
    if (selectedNodeId) updateHighlight();
    return true;
  }

  // ── Main loop: only runs once we know our artboardId ──────────────────────
  // Posts READY, kicks off polling/MutationObserver discovery, schedules
  // route discovery, and wires up SPA navigation handlers.
  var _treeFound = false;
  var _rescanInterval = null;
  var _mainLoopStarted = false;

  function tryCapture(label) {
    if (captureExistingTree()) {
      if (!_treeFound) {
        _treeFound = true;
        console.log(OM_TAG, 'tree found via ' + label);
        if (!_rescanInterval) {
          _rescanInterval = setInterval(function() { captureExistingTree(); }, 3000);
        }
      }
      return true;
    }
    return false;
  }

  function startMainLoop() {
    if (_mainLoopStarted) return;
    _mainLoopStarted = true;

    var rootFontSizePx = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('font-size') || '16'
    ) || 16;
    post({ type: 'READY', rootFontSizePx: rootFontSizePx });

    setTimeout(discoverRoutes, 800);

    // Initial polling — geometric backoff up to 16 s. Stops on first success.
    tryCapture('immediate');
    [50, 200, 500, 1000, 2000, 4000, 8000, 12000, 16000].forEach(function(ms) {
      setTimeout(function() { if (!_treeFound) tryCapture('poll-' + ms); }, ms);
    });

    // MutationObserver — fires the moment React writes to the DOM.
    try {
      var _mo = new MutationObserver(function() {
        if (_treeFound) { _mo.disconnect(); return; }
        tryCapture('mutation');
      });
      _mo.observe(document.documentElement || document.body, {
        childList: true, subtree: true, attributes: false,
      });
      setTimeout(function() { try { _mo.disconnect(); } catch(e) {} }, 30000);
    } catch(e) { /* MutationObserver not available */ }

    window.addEventListener('popstate', function() {
      setTimeout(discoverRoutes, 100);
      setTimeout(function() { captureExistingTree(); }, 200);
    });
  }

  // Either start immediately (we know our ID) or run the handshake first.
  if (artboardId) {
    startMainLoop();
  } else {
    // Handshake: ask the parent who we are. Retry every 250 ms until we get a
    // response (the parent's message listener may not be wired up yet on the
    // first iframe-load tick) or until 30 s elapses.
    console.log(OM_TAG, 'no artboardId from URL/window.name/storage — initiating handshake');
    var _hsInterval = setInterval(function() {
      if (artboardId) { clearInterval(_hsInterval); return; }
      try { window.parent.postMessage({ __om_init_request: true }, '*'); } catch(e) {}
    }, 250);
    // First request immediately.
    try { window.parent.postMessage({ __om_init_request: true }, '*'); } catch(e) {}
    setTimeout(function() {
      clearInterval(_hsInterval);
      if (!artboardId) {
        console.warn(OM_TAG, 'never received artboardId — page will not be inspectable');
      }
    }, 30000);
  }
})();`;
}

// Re-export types for convenience
export type { FiberNode, DOMRectLike };
