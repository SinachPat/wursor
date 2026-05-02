# Source-Aware Canvas & Agent Bridge: Implementation Design v2

**Status:** Revised — ready for implementation with known open questions (see §13)  
**Scope:** Complete design engineering platform — infinite canvas, multi-artboard, source awareness, Figma-style design panel, design language system, agent integration  
**Packages touched:** `@originmain/renderer`, `@originmain/cli`, `@originmain/agent-bridge`, `@originmain/app`, `@originmain/design-language`  
**Phases:** 0 → 7 (sequential with noted parallelism opportunities)

---

## 1. Problem Statement

The current canvas pipeline gives us **runtime truth** — what a component looks like, what DOM rect it occupies — but zero **source truth** (which file defines it), zero **design system truth** (whether it conforms to the design language), and zero **code writeback** (getting visual changes back to disk).

Style patches via `PATCH_ELEMENT_STYLE` mutate the live DOM. They vanish on the next hot reload. That is DevTools with a nicer UI, not a design engineering platform.

The corrected architecture requires five layers working together:

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 0 — Infinite Canvas (Phase 0)                              │
│  Multi-artboard world space. Each artboard = one iframe = one     │
│  route. Pan/zoom. Device presets. Component isolation frames.     │
└───────────────────────────┬──────────────────────────────────────┘
                            │ artboardId per iframe
┌───────────────────────────▼──────────────────────────────────────┐
│  LAYER 1 — Runtime (exists today)                                 │
│  CLI proxy → iframe → fiber hook → FIBER_TREE_UPDATE              │
│  Gives: visual render, component name, DOM rect, live props       │
│  Extended: _debugSource → source file + line per component        │
└───────────────────────────┬──────────────────────────────────────┘
                            │ source file + component name
┌───────────────────────────▼──────────────────────────────────────┐
│  LAYER 2 — Design Panel (Phase 2)                                 │
│  Figma-style inspector: Frame / Layout / Fill / Stroke /          │
│  Effects / Typography / Constraints / Box Model                   │
│  CSS-first (always available) + Props tab (when indexer runs)     │
└───────────────────────────┬──────────────────────────────────────┘
                            │ CSS values + intent changes
┌───────────────────────────▼──────────────────────────────────────┐
│  LAYER 3 — Code Diff & Intent (Phases 3–5)                        │
│  Client-side diff generation. Diff viewer before agent send.      │
│  Confirmed IntentMessage → Agent Bridge → Claude Code applies it  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ token resolution + deviation flags
┌───────────────────────────▼──────────────────────────────────────┐
│  LAYER 4 — Design Language (Phase 6)                              │
│  Upload Style Dictionary / W3C DTCG / flat JSON.                  │
│  Token resolver maps raw CSS values → token names.                │
│  Deviation flags + snap-to-token + agent writes var(--token).     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. What Exists Today (Audit)

### `@originmain/cli` — proxy only
- Reverse-proxies the user's dev server through port 4170
- Strips `X-Frame-Options` / CSP so the iframe can load
- Injects `buildProxyFiberHookScript()` into HTML responses
- Passes WebSocket upgrades for HMR
- **No AST indexing. No file watching. No file-read endpoint.**

### `@originmain/renderer` — fiber hook + DOM inspector
- `buildProxyFiberHookScript()` hooks `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot`
- Serialises fiber tree → `FIBER_TREE_UPDATE` to parent canvas
- `_debugSource` is on every dev-mode fiber but **is never read or forwarded**
- `PATCH_ELEMENT_STYLE` / `REMOVE_ELEMENT` apply DOM-only mutations — ephemeral
- `SET_DESIGN_TOKENS` already applies CSS custom properties on `:root` — used in Phase 6

### `@originmain/agent-bridge` — MCP over JSON-RPC 2.0
- 5 tools: `get_pending_diffs`, `get_artboard_context`, `ask_design_agent`,
  `update_diff_status`, `get_design_language`
- **`get_design_language` exists but has no spec — no schema, no storage, never populated**
- No `push_intent`, no `resolve_component`, no server-push to agent

### `@originmain/app` — canvas host
- Multi-artboard rendering exists: `Canvas.tsx` already maps `useArtboards()` results to `<Artboard>` components on a shared transform layer
- However, the current implementation lacks: viewport culling, isolation artboard type, device presets, the `artboardIframeMap` message-routing pattern, and the auto-arrange algorithm
- Phase 0 **extends** this existing foundation rather than replacing it from scratch
- Inspector reads `selectedComponentData` — name + props + domRect
- `styleEditQueue` stores DOM patches — never generates code diffs
- No design panel sections, no token-aware inputs

### `@originmain/design-language` — package exists, largely empty
- No token resolver, no format parser, no deviation detection

---

## 3. Phase 0 — Infinite Canvas & Multi-Artboard

This is the structural foundation. Everything else builds on top of it.

### 3.1 Canvas World Model

The canvas becomes a true 2D viewport using a world-space transform:

```
<div class="om-viewport">                   ← clips to window, receives wheel/drag events
  <div class="om-world"                     ← single transform origin, contains all artboards
    style="transform: translate(Xpx, Ypx) scale(Z)">
    <ArtboardFrame id="abc" x={0}   y={0}   w={1440} h={900}  route="/dashboard" />
    <ArtboardFrame id="def" x={1640} y={0}  w={390}  h={844}  route="/settings" />
    <ArtboardFrame id="ghi" x={0}   y={1000} w={1440} h={900} route="/onboarding" />
    <ArtboardFrame id="iso" x={3400} y={0}  w={800}  h={600}  type="isolation"
                   component="DashboardCard" file="src/components/DashboardCard.tsx" />
  </div>
</div>
```

**Transform state** (`useCanvasTransform` hook in Zustand):

```ts
interface CanvasTransform {
  x: number;       // world pan offset X (pixels)
  y: number;       // world pan offset Y (pixels)
  scale: number;   // zoom level (0.1 → 4.0)
}
```

Pan: `mousedown` + drag on empty canvas (or `Space` + drag, or middle-click drag).  
Zoom: `Ctrl+scroll` or trackpad pinch. Scale clamped to `[0.1, 4.0]`.

**Zoom-to-cursor math:** Zoom must centre on the cursor position, not the element's `transform-origin`. On each wheel event, before updating `scale`, compute the new translate so the world point under the cursor stays fixed:

```ts
const newScale = clamp(scale * factor, 0.1, 4.0);
const newX = cursorX - (cursorX - x) * (newScale / scale);
const newY = cursorY - (cursorY - y) * (newScale / scale);
// apply { x: newX, y: newY, scale: newScale }
```

Set `transform-origin: 0 0` on `.om-world` so the translate and scale compose correctly.

`cursorX` and `cursorY` must be relative to the viewport element, not the window. Compute them as:
```ts
const rect = viewportEl.getBoundingClientRect();
const cursorX = e.clientX - rect.left;
const cursorY = e.clientY - rect.top;
```

**Pan vs select event hierarchy:** `.om-world` has `pointer-events: none` by default; pointer events are only received by artboard frames and the `.om-viewport` element directly. When `Space` is held or the middle mouse button is down, `.om-viewport` sets `pointer-events: all` on itself and `pointer-events: none` on all `.artboard-frame` children, capturing all drag events for panning. On `Space` release or mouse-up, pointer events are restored. This prevents artboard clicks from interfering with pan gestures.

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| `Space + drag` | Pan |
| `Cmd + =` / `Cmd + -` | Zoom in / out |
| `Cmd + 0` | Fit all artboards in view |
| `Cmd + 1` | Reset to 100% at selected artboard |
| `Cmd + Shift + H` | Fit artboard height to viewport |

**"Fit all" algorithm (`Cmd+0`):** Compute the axis-aligned bounding box of all artboards in world space. Apply padding of 80px on all sides. Then:
```ts
const pad = 80;
// Guard: if canvas is empty, reset to 100% at origin
if (artboards.length === 0) { applyTransform({ x: 0, y: 0, scale: 1 }); return; }
const scale = Math.max(
  0.1,  // never go below minimum zoom
  Math.min(
    (vpWidth  - pad * 2) / totalWidth,
    (vpHeight - pad * 2) / totalHeight,
    4.0   // never exceed maximum zoom
  )
);
const x = pad - bbox.minX * scale + (vpWidth  - pad * 2 - totalWidth  * scale) / 2;
const y = pad - bbox.minY * scale + (vpHeight - pad * 2 - totalHeight * scale) / 2;
```

### 3.2 Artboard Types

Three types of artboard:

**Route artboard** — renders a full page route of the user's app.  
`{ type: 'route', route: '/dashboard' }`

**Component isolation artboard** *(available from Phase 3 — requires CLI AST indexer)* — renders a single component in a CLI-served wrapper page.  
`{ type: 'isolation', component: 'DashboardCard', file: 'src/components/DashboardCard.tsx' }`  
`// always a project-root-relative path, matching ComponentEntry.relativeFile`  
See §3.5 for the isolation server.

**Static artboard** *(future)* — a placeholder frame with no live iframe, for annotating or wireframing.

### 3.3 Artboard Lifecycle

**Creating an artboard:**
Three entry points, all result in a `createArtboard()` dispatch:

1. **Routes panel** (left sidebar) — lists all `ROUTES_DISCOVERED` routes. Clicking a route that has no artboard creates one. Routes with artboards show a filled dot.
2. **Artboard Navigator** — `+` button opens a picker: "New Route Artboard" → route selector; "New Isolation Frame" → component name input.
3. **Duplicate** — right-click any artboard → Duplicate. Creates a copy at a different device size (opens device preset picker).

**Auto-arrange (default layout):**
New artboards snap to a horizontal row with `gap: 200px`. When a row exceeds 3 artboards or total width > 6000px, a new row begins below. The vertical gap between rows is 240px. The Y position of a new row is `maxHeightInPreviousRow + 240px` (using the tallest artboard in the completed row as the row height). The layout algorithm runs on `createArtboard()` only — it computes a suggested `(x, y)` position and assigns it. The user can drag the artboard away from that position at any time; subsequent auto-arrange calls do not move manually-positioned artboards (a `manuallyPositioned: boolean` flag on each artboard record prevents re-calculation). The flag is set to `true` on `pointerup` at the end of a successful artboard drag (when the user has moved the artboard at least 4px from its pre-drag position). It is never set by the auto-arrange algorithm's own writes to `canvas_x`/`canvas_y`.

**"Re-arrange all"** button in the Artboard Navigator context menu resets all positions to the auto-grid (after a confirmation prompt, since it discards freeform layout).

**Deleting an artboard:** Right-click → Delete. Removes iframe from DOM, removes Supabase row (the `intent_diffs.artboard_id` foreign key must have `ON DELETE SET NULL` — not `CASCADE` — to preserve diff history even when the artboard is deleted), removes from Zustand, and calls `artboardIframeMap.delete(artboardId)` to release the DOM reference.

**Selecting an artboard:** Click the artboard label (above the iframe) to select the frame itself (shows frame handles, shows device preset picker in the top bar). Click inside the iframe to select a component within it (activates design panel).

**Multi-artboard message routing:** Component selection sets both `selectedArtboardId` and `selectedComponentData` in Zustand simultaneously. All outgoing DOM messages (`PATCH_ELEMENT_STYLE`, `REQUEST_ELEMENT_STYLES`, `DESELECT`, `SET_DESIGN_TOKENS` to a single artboard) are always dispatched to the iframe referenced by `selectedArtboardId`. `artboardIframeMap` is a **module-level singleton** defined outside Zustand in `packages/app/src/lib/artboard-iframe-map.ts`:
```ts
export const artboardIframeMap = new Map<string, HTMLIFrameElement>();
```
DOM references must never be stored in Zustand — they are not serialisable, prevent garbage collection, and break React DevTools. Each `<ArtboardFrame>` registers its `iframeRef.current` on mount (`artboardIframeMap.set(id, el)`) and removes it on unmount (`artboardIframeMap.delete(id)`). The canvas dispatches messages via `artboardIframeMap.get(selectedArtboardId)?.contentWindow.postMessage(envelope, '*')`. On `deleteArtboard(id)`, both the Zustand action and the `ArtboardFrame` unmount path call `artboardIframeMap.delete(id)` to release the DOM reference.

### 3.4 Device Presets

Each artboard has a `width × height` that sets the iframe's `width` and `height` CSS properties directly. The dev server sees the correct viewport for responsive breakpoints.

| Preset key | Label | Width | Height |
|---|---|---|---|
| `desktop-hd` | Desktop HD | 1440 | 900 |
| `desktop-lg` | Desktop Large | 1280 | 800 |
| `laptop` | Laptop | 1024 | 768 |
| `tablet-landscape` | Tablet Landscape (iPad Pro) | 1366 | 1024 |
| `tablet-portrait` | Tablet Portrait | 768 | 1024 |
| `mobile-iphone-14` | iPhone 14 | 390 | 844 |
| `mobile-iphone-se` | iPhone SE | 375 | 667 |
| `mobile-android` | Android | 360 | 800 |
| `custom` | Custom | user-defined | user-defined |

Changing the preset: top toolbar shows the current device preset for the selected artboard. A dropdown lists presets. Choosing one resizes the iframe immediately; the dev server's CSS responds to the new viewport.

### 3.5 Component Isolation Artboards

A component isolation artboard renders a single React component in isolation. The mechanism differs by framework:

**Vite-based projects:** The CLI intercepts `/__om_isolation__` requests and generates a minimal HTML wrapper. Because Vite handles arbitrary `.tsx` module imports natively, this works without any changes to the user's project:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script type="module">
    // Import is generated at request time based on ComponentEntry.isDefaultExport:
    // Named export:  import { DashboardCard } from '/src/components/DashboardCard.tsx'
    // Default export: import DashboardCard from '/src/components/DashboardCard.tsx'
    // The CLI reads isDefaultExport from the AST indexer to choose the correct form.
    import { DashboardCard } from '/src/components/DashboardCard.tsx'; // ← generated
    import { createRoot } from 'react-dom/client';
    import React from 'react';
    // All Originmain globals use the __OM_ISO_ prefix to minimize collision risk
    // with application code. If a collision is detected at runtime (window.__OM_ISO_PROPS__
    // already defined), the isolation page logs a warning but proceeds.
    const _root = createRoot(document.getElementById('root'));
    window.__OM_ISO_RENDER__ = function() {
      _root.render(React.createElement(DashboardCard, window.__OM_ISO_PROPS__ || {}));
    };
    window.__OM_ISO_RENDER__();
  </script>
</head>
<body style="margin:0;padding:24px;background:#f5f5f5;"><div id="root"></div></body>
</html>
```

**Export type handling:** The CLI queries `GET /components?name=DashboardCard` before generating the isolation page to determine `isDefaultExport`. If the indexer is not yet running, the CLI generates both import forms and tries them in order using a dynamic import wrapper.

**Next.js projects:** Next.js does not serve arbitrary source files. The CLI detects Next.js (presence of `next.config.*`) and instead writes a temporary page file to the user's project. For App Router projects: check for `src/app/` first, then `app/` at the project root. Write the temp page to whichever exists: `{appDir}/__om_isolation__/page.tsx`. If neither `src/app/` nor `app/` is found, fall back to the Pages Router check below. For Pages Router projects (`pages/` exists): `pages/__om_isolation__.tsx`. If neither directory is found, falls back to the Vite approach (bare module import). The temporary page is deleted when the CLI stops (registered via `process.on('exit', cleanup)` and `process.on('SIGINT', cleanup)`). **Startup cleanup:** On `originmain dev` start, the CLI scans for and deletes any pre-existing `__om_isolation__` directories in both `src/app/` and `app/` before creating new ones — this recovers from previous unclean exits. **`.gitignore` injection:** The CLI appends the following to the project's `.gitignore` if not already present (idempotent check before writing):
```
# Originmain component isolation frame (auto-deleted on CLI stop)
__om_isolation__/
``` This page uses a dynamic import based on the `component` and `file` query params passed as `searchParams`.

**Framework detection:** The CLI checks `package.json` for `"next"` in dependencies to detect Next.js; otherwise defaults to the Vite approach. **Canonical framework detection logic (used everywhere in the CLI):** (1) Check `package.json` `dependencies`/`devDependencies` for `"next"` → Next.js. (2) Check for `vite.config.*` in the project root → Vite. (3) Check for `remix.config.*` → Remix. (4) Otherwise → generic Vite-compatible. This logic lives in `packages/cli/src/detect-framework.ts` (NEW file, listed in Phase 3 files). All CLI modules import from this single source.

**`UPDATE_ISOLATION_PROPS` protocol:**
When the user edits props in the Props tab of the design panel, the canvas sends this message to the isolation artboard's iframe:

```ts
// Canvas → isolation iframe (via artboardIframeMap)
{ source: HOST_SOURCE, artboardId, message: { type: 'UPDATE_ISOLATION_PROPS', props: Record<string, unknown> } }
```

The DOM inspector script (in the iframe) handles this message in its existing `window.addEventListener('message', ...)` handler:

```js
else if(m.type==='UPDATE_ISOLATION_PROPS'){
  window.__OM_ISO_PROPS__=m.props;
  if(typeof window.__OM_ISO_RENDER__==='function')window.__OM_ISO_RENDER__();
}
```

This triggers a synchronous React re-render with the new props — no full page reload.

**Required protocol addition (Phase 0):** Add `UPDATE_ISOLATION_PROPS` to `dom-inspector.ts`'s message handler. Add `UPDATE_ISOLATION_PROPS` to `protocol.ts` as a valid host message type.

### 3.6 Viewport Culling

Rendering more than ~4 live iframes simultaneously is expensive. The strategy:

- **Active** (within viewport bounds + 200px margin): full live `<iframe>` mounted
- **Near** (within 800px of viewport): iframe is mounted but `visibility: hidden` (keeps HMR connection alive)
- **Far** (beyond 800px): iframe is unmounted, replaced by a `<div class="artboard-thumbnail">` showing a static screenshot

The viewport cull is triggered by pan and zoom events and runs on a 100ms debounce — a single `setTimeout` that resets on each event. This prevents excessive DOM mutations during rapid panning. The debounced handler itself runs synchronously (not via `requestAnimationFrame`) since it only mounts/unmounts iframes, not repainting.

**Thumbnail capture — cross-origin constraint:** The canvas host and the CLI proxy (`localhost:4170`) are different origins. The parent window cannot access the iframe's DOM directly to capture a screenshot. Thumbnails must be captured *inside* the iframe and sent back via `postMessage`.

**Capture mechanism:**
1. When an artboard transitions from **Active** → **Near/Far**, the canvas sends `{ type: 'CAPTURE_THUMBNAIL' }` to that artboard's iframe
2. The fiber hook / DOM inspector inside the iframe receives this message, runs `html2canvas(document.body)` (the `html2canvas` library is injected by the CLI proxy alongside the fiber hook), and posts the result back:
   `post({ type: 'THUMBNAIL_READY', dataUrl: canvas.toDataURL('image/jpeg', 0.6) })`
3. The canvas receives `THUMBNAIL_READY`, stores the data URL in `artboardFrames[id].thumbnailDataUrl` in Zustand, and uses it to display the placeholder
4. `thumbnail_url` in Supabase stores this data URL (or a Supabase Storage URL if the image is uploaded — see §3.8)

**Required additions:**
- `CAPTURE_THUMBNAIL` added as a valid host message type in `protocol.ts`
- `THUMBNAIL_READY` added as a valid renderer message type in `protocol.ts`
- `html2canvas` is bundled inside the CLI package and injected as an inline script (not a CDN URL — CDN dependency would break offline use and introduce a supply-chain risk). The CLI bundles `html2canvas` during its own build step. If `html2canvas` fails (returns a blank canvas, throws, or times out after 3s), the iframe sends `{ type: 'THUMBNAIL_READY', dataUrl: null }` and the canvas displays a "thumbnail unavailable" placeholder with the artboard label instead. Performance note: html2canvas adds ~250KB to the injected script per artboard tab — it is only injected once per page load and only when the CLI is running in dev mode.
- Handler added to `dom-inspector.ts` for `CAPTURE_THUMBNAIL`

### 3.7 Artboard Navigator Panel (Left Sidebar)

The left panel (currently `ArtboardNavigator.tsx`) becomes a full sidebar with two tabs:

**Artboards tab:**
- Lists all artboards with label, route, device icon, and live/idle indicator
- Click → scroll canvas to that artboard, select it
- Drag to reorder (affects auto-arrange row grouping)
- Thumbnail preview on hover

**Routes tab:**
- Lists all `ROUTES_DISCOVERED` routes from every live artboard (`ROUTES_DISCOVERED` is a renderer→canvas postMessage emitted by `dom-inspector.ts` on init and whenever new `<a href>` links are detected. Already implemented — see §2 audit. The canvas aggregates routes from all live artboards into a deduplicated list.)
- Routes without an artboard show `+` to create one
- Routes already open show a "live" indicator

### 3.8 Persistence — Schema Changes

Extend the existing `artboards` table:

```sql
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS canvas_x float8 DEFAULT 0;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS canvas_y float8 DEFAULT 0;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS width integer DEFAULT 1440;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS height integer DEFAULT 900;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS device_preset text DEFAULT 'desktop-hd';
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS artboard_type text DEFAULT 'route' CHECK (artboard_type IN ('route', 'isolation', 'static'));
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS isolation_component text;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS isolation_file text;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS isolation_props jsonb DEFAULT '{}';
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS manually_positioned boolean DEFAULT false;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS thumbnail_url text;  -- always a Supabase Storage public URL; data URIs are never stored in the DB (see §3.6)
```

**Supabase Storage:** Create a `artboard-thumbnails` bucket (public read, authenticated write). On thumbnail capture, upload the JPEG to `artboard-thumbnails/{workspaceId}/{artboardId}.jpg` and store the public URL in `thumbnail_url`. If the upload fails, display a 'thumbnail unavailable' placeholder instead — do not write to the DB.

Canvas transform (pan/zoom) is **session-only** — stored in Zustand + localStorage. Not persisted to Supabase (users don't expect the exact pan position to survive browser closes).

### 3.9 Files to Create / Change

| File | Change |
|---|---|
| `packages/renderer/src/protocol.ts` | Add `UPDATE_ISOLATION_PROPS` (host message), `CAPTURE_THUMBNAIL` (host message), `THUMBNAIL_READY` (renderer message) |
| `packages/renderer/src/fiber-hook.ts` | Handle `CAPTURE_THUMBNAIL` (run `html2canvas`, post `THUMBNAIL_READY`); handle `UPDATE_ISOLATION_PROPS` (set `window.__OM_ISO_PROPS__` and call `window.__OM_ISO_RENDER__()`) |
| `packages/app/src/lib/artboard-iframe-map.ts` | NEW — module-level `Map<string, HTMLIFrameElement>` singleton; imported by `ArtboardFrame` and canvas dispatch logic |
| `packages/app/src/components/canvas/CanvasViewport.tsx` | NEW — pan/zoom world container, wheel+drag handlers, viewport culling |
| `packages/app/src/components/canvas/ArtboardFrame.tsx` | NEW — single artboard wrapper: label, handles, device outline, iframe |
| `packages/app/src/components/canvas/IsolationFrame.tsx` | NEW — isolation artboard type; props override panel integration |
| `packages/app/src/components/canvas/Canvas.tsx` | Replace single-iframe layout with `<CanvasViewport>` containing `<ArtboardFrame>` list |
| `packages/app/src/components/navigator/ArtboardNavigator.tsx` | Add "Routes" tab, thumbnails, create-from-route action |
| `packages/app/src/components/chrome/AppChrome.tsx` | Add device preset picker to top toolbar for selected artboard |
| `packages/app/src/store/canvas.ts` | Add `canvasTransform`, `artboardFrames`, `createArtboard`, `deleteArtboard`, `updateArtboardPosition`, `setArtboardDevicePreset` |
| `packages/app/src/hooks/useArtboards.ts` | Extend to load new schema fields |
| `packages/cli/src/proxy.ts` | Inject `window.__OM_INDEX_URL__` and `window.__OM_ISO_BASE__` into proxied HTML; intercept `/__om_isolation__` for Vite projects (Next.js isolation pages handled in Phase 3). The boundary: `proxy.ts` intercepts the request and calls `isolationServer.handleRequest(req, res)`. `isolation-server.ts` (Phase 3) contains all the HTML generation and framework detection logic. `proxy.ts` has no HTML generation logic. |
| Database | Migration: `alter-artboards-v2.sql` with new columns above |

---

## 4. Phase 1 — `_debugSource` Extraction

### 4.1 What It Is

React's dev build attaches `_debugSource: { fileName, lineNumber, columnNumber }` to every fiber created by JSX. The same data React DevTools uses to show "Defined in src/components/Card.tsx:12".

**Dev builds only:** `_debugSource` is only present when React is compiled with `__DEV__ = true`. In production builds, the field is absent. Since the CLI proxy is a development-only tool, this is acceptable — but implementers must not expect `callSite` to be present in staging/production artboards.

### 4.2 Important Constraint: Usage Site vs Definition File

`_debugSource` is set at the **JSX call site** — the file where `<Card />` is written — not where the `Card` function is defined. If `page.tsx` renders `<DashboardCard />`, `_debugSource` on that fiber points to `page.tsx`, not `components/DashboardCard.tsx`.

**Correct extraction approach:** No upward walk is needed. In `serializeFiber()`, when the current fiber's `type` is a function (i.e., it is a React component fiber), read `fiber._debugSource` directly from that fiber. The `_debugSource` on a component fiber gives the file and line where *its JSX tag was written in the parent* — that is the call site. This is sufficient: the component name is used to query the AST indexer for the definition file separately.

**For the definition file:** The AST indexer (Phase 3) is the authoritative source. `_debugSource` gives the call-site file; `componentName` is used to query the indexer for the definition file. Both are included in the `FiberNode` as separate fields.

**Fallback when `_debugSource` is absent:** `_debugSource` is `undefined` for components rendered imperatively with `React.createElement()` (not JSX), class components, and some HOC wrappers. In these cases, `callSite` is omitted from the serialized `FiberNode`. The Inspector shows "Source location unavailable" and relies solely on the AST indexer for file info. This is expected and not an error condition.

### 4.3 Protocol Change

```ts
export interface FiberNode {
  id: string;
  name: string;
  props: Record<string, unknown>;
  children: FiberNode[];
  domRect?: DOMRectLike;
  // NEW
  callSite?: {
    fileName: string;   // file where <ComponentName /> was written
    lineNumber: number;
    columnNumber?: number;
  };
}
```

Note: renamed from `sourceFile` to `callSite` for accuracy — it is explicitly the usage location, not the definition file. The definition file comes from the AST indexer.

### 4.4 Files to Change

| File | Change |
|---|---|
| `packages/renderer/src/protocol.ts` | Add `callSite?` to `FiberNode` |
| `packages/renderer/src/fiber-hook.ts` | Read `fiber._debugSource` in `serializeFiber()`, include as `callSite` |
| `packages/app/src/components/inspector/Inspector.tsx` | Display call site path + line; label it "used in" not "defined in" |

---

## 5. Phase 2 — Figma-style Design Panel

The Inspector panel is replaced with a proper design panel. This is the visual editing core.

### 5.1 Panel Architecture

The panel has two top-level tabs:

**Design tab** (default) — CSS-computed values, organized into sections (see §5.2–5.9). Always available.  
**Props tab** — React props for the selected component. Visible only when the AST indexer is running AND the selected element is a capitalized React component. See §5.10.  
**Code tab** — shows the generated diff. The tab is present from Phase 2 as a placeholder (disabled, shows "Preview Code Change requires the CLI indexer"). It becomes fully functional in Phase 4 when the diff generator is wired up.

The panel is driven by `selectedComponentStyles` (computed CSS) and `selectedComponentData` (fiber data) from Zustand.

**Adaptive sections:** Sections expand or collapse based on the selected element's computed styles:
- Layout section: expanded when `display` is `flex` or `grid`
- Typography section: expanded when the element has non-empty text content or `font-size` is set
- Constraints section: expanded when `position` is `absolute` or `fixed`
- All other sections: collapsed by default, expand on click

### 5.2 Section: Frame (Position & Size)

| Input | CSS property | Notes |
|---|---|---|
| X | `left` (absolute) or layout offset | Read-only display value when `position: static` — computed as `offsetLeft` / `offsetTop` relative to the nearest positioned ancestor (the artboard root). Does not shift on scroll. Shows a tooltip: "Set position: absolute to edit." Editable when `position: absolute` or `fixed`, writing to the `left` / `top` CSS property. |
| Y | `top` (absolute) or layout offset | Read-only display value when `position: static` — computed as `offsetLeft` / `offsetTop` relative to the nearest positioned ancestor (the artboard root). Does not shift on scroll. Shows a tooltip: "Set position: absolute to edit." Editable when `position: absolute` or `fixed`, writing to the `left` / `top` CSS property. |
| W | `width` | Accepts px, %, rem |
| H | `height` | Accepts px, %, rem |
| Lock aspect ratio | — | Derived: W/H ratio locked on resize |
| Rotation | `transform: rotate()` | Degrees, –360 to 360 |
| Corner radius | `border-radius` | Uniform input + expand to show TL/TR/BR/BL individually |
| Clip content | `overflow` | Toggle: `visible` ↔ `hidden` |

**Unit preservation:** When editing W or H, the panel preserves the current unit. If the current value is `50%`, the input shows `50` with a `%` unit badge; typing a new number keeps `%`. Clicking the unit badge opens a unit picker (px / % / rem / auto). Switching units converts the value numerically at the time of switch: `50%` of a 400px parent → `200px`. A lock icon next to the unit preserves it on subsequent edits.

### 5.3 Section: Layout

Shown for all elements. Sub-mode toggles:

**Block mode** (when `display: block` or `inline-block`): The Layout section header is shown but collapsed. Expanding it shows only a Display toggle (Block / Flex / Grid) and padding inputs. Width/height are in the Frame section. This matches the "collapsed by default" rule in §5.1 — the section is always present, never hidden.

**Flex mode** (when `display: flex`):

| Input | CSS property |
|---|---|
| Direction | `flex-direction` (row/column) with icon buttons |
| Wrap | `flex-wrap` (wrap/nowrap) with icon buttons |
| Align items | `align-items` (start/center/end/stretch/baseline) with icon buttons |
| Justify content | `justify-content` (start/center/end/between/around/evenly) with icon buttons |
| Gap | `gap` — unified input; expand to `row-gap` / `column-gap` |
| Padding | `padding-top/right/bottom/left` — four inputs linked by default; click chain icon to unlink |

**Grid mode** (when `display: grid`):

| Input | CSS property |
|---|---|
| Columns | `grid-template-columns` — text input + visual preview |
| Rows | `grid-template-rows` — text input + visual preview |
| Column gap | `column-gap` |
| Row gap | `row-gap` |
| Align items | `align-items` |
| Justify items | `justify-items` |

**Display toggle:** Block / Flex / Grid buttons at the top of the Layout section. Changing display fires a `PATCH_ELEMENT_STYLE` immediately and queues the intent.

### 5.4 Section: Fill

| Control | CSS property | Notes |
|---|---|---|
| Fill type | `background-color`, `background-image`, `none` | Segmented: None / Solid / Gradient / Image |
| Color picker | `background-color` | Full color picker: hex, RGB, HSL inputs + opacity slider |
| Gradient | `background-image: linear-gradient(…)` | Gradient bar with draggable stops; each stop has color + position |
| Opacity | `opacity` | 0–100%, applies to the whole element |

Multiple fills: a `+` button adds another fill layer (stacked `background` shorthand). Each fill has a remove `×` button.

**Token integration (Phase 6):** When a token match is found for `background-color`, the hex input is replaced with a token chip (e.g., `--color-surface`). Click the chip to open the token picker. Click the hex area to enter raw mode.

### 5.5 Section: Stroke (Border)

| Input | CSS property | Notes |
|---|---|---|
| Color | `border-color` | Color picker — linked to token system |
| Width | `border-width` | px input; expand to Top/Right/Bottom/Left |
| Style | `border-style` | Solid / Dashed / Dotted / None |
| Position | — | Inside / Center / Outside. **CSS approximation:** "Center" uses `border`; "Inside" uses `box-shadow: inset 0 0 0 Xpx color`; "Outside" uses `box-shadow: 0 0 0 Xpx color`. These modify different CSS properties than a naive `border` change. The generated `IntentChange` for Inside/Outside has `confidence: 'approximate'` (using the existing field from §7.2, not a new `approximation` boolean). |
| Radius | `border-radius` | Mirrors Frame section — shows here too for discoverability |

**Box-shadow composition:** The Stroke section's Inside/Outside border and the Effects section's drop shadow both use `box-shadow`. CSS allows multiple comma-separated shadows in one declaration.
```ts
interface BoxShadowLayer {
  role: 'border' | 'shadow';  // 'border' = Inside/Outside stroke; 'shadow' = Effects drop shadow
  x: number;       // px
  y: number;       // px
  blur: number;    // px
  spread: number;  // px
  color: string;   // any valid CSS color string
  inset: boolean;
}
```
The design panel's internal model maintains a `boxShadowLayers: BoxShadowLayer[]` array that includes both border layers and effect layers, serialized as a single `box-shadow` declaration. Adding a stroke border adds a layer tagged `role: 'border'`; adding a drop shadow adds a layer tagged `role: 'shadow'`. All layers are serialized together: `box-shadow: [border layer], [shadow layers...]`. This prevents either section from overwriting the other.

### 5.6 Section: Effects

**Drop shadow** (maps to `box-shadow`):

| Input | Notes |
|---|---|
| X offset | px |
| Y offset | px |
| Blur | px |
| Spread | px |
| Color + opacity | Full color picker |
| Inset toggle | switches between drop shadow and inner shadow |

Multiple shadows: `+` button adds another `box-shadow` layer. Each shadow has a remove `×`.

**Blur effects:**

| Toggle | CSS property |
|---|---|
| Layer blur | `filter: blur(Xpx)` — blurs the element itself |
| Background blur | `backdrop-filter: blur(Xpx)` — frosted glass effect |

### 5.7 Section: Typography

Shown when the element's `childNodes` contains at least one `TEXT_NODE` (type 3) with non-whitespace content — i.e., the element itself directly contains text, not just nested descendants. Check: `Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0)`. This prevents the section from appearing on container divs whose only text is in deep children.

**Protocol fields required (add to `ELEMENT_STYLES` renderer message):**
```ts
hasDirectText: boolean;       // true if el has a direct TEXT_NODE child with content
hasParagraphChildren: boolean; // true if el has at least one direct <p> child
```
The fiber hook computes these inside the iframe and includes them in every `ELEMENT_STYLES` response. The canvas reads them from `selectedComponentStyles` to conditionally show this section and the paragraph-spacing row.

**Paragraph spacing patch:** Editing the paragraph-spacing input sends a new host message `PATCH_CHILDREN_STYLE` (add to `protocol.ts`):
```ts
{ type: 'PATCH_CHILDREN_STYLE', parentNodeId: string, selector: 'p', property: 'margin-bottom', value: string }
```
The fiber hook handles this by querying `nodeMap[parentNodeId].fiber.stateNode.querySelectorAll(':scope > p')` and calling `el.style.setProperty(property, value)` on each result.

| Input | CSS property |
|---|---|
| Font family | `font-family` — searchable dropdown; lists fonts detected in the page |
| Font size | `font-size` — px / rem |
| Font weight | `font-weight` — numeric (100–900) or keyword dropdown |
| Line height | `line-height` — unitless multiplier or px |
| Letter spacing | `letter-spacing` — px / em |
| Paragraph spacing | `margin-bottom` on the element's direct `<p>` children, not on the element itself. When this input is edited, `PATCH_ELEMENT_STYLE` targets each `<p>` child of the selected element. If no `<p>` children exist, the input is hidden. Label: "Paragraph spacing (applies to `<p>` children)." |
| Text align | `text-align` — Left / Center / Right / Justify icon buttons |
| Text decoration | `text-decoration` — None / Underline / Strikethrough |
| Text transform | `text-transform` — None / Uppercase / Lowercase / Capitalize |
| Color | `color` — full color picker with token integration |

### 5.8 Section: Constraints

Visible when `position` is `absolute` or `fixed`.

Horizontal constraint (how the element responds when its parent resizes):
- **Left** — `left: Xpx`, width fixed
- **Right** — `right: Xpx`, width fixed
- **Left + Right** — both set (element stretches)
- **Center** — `left: 50%; transform: translateX(-50%)`
- **Scale** — width set as `%`

Vertical constraint (same pattern for `top` / `bottom`).

Visual: a 3×3 grid of constraint anchor icons (identical to Figma's constraints panel).

### 5.9 Section: Box Model / Spacing

A visual box model diagram (like browser DevTools) showing:
- `margin` (outer ring) — four values, each editable inline
- `border` (next ring) — mirrors Stroke section values
- `padding` (inner ring) — four values, each editable inline
- content dimensions (W × H from Frame section)

This is a secondary view of the same values in Frame and Layout — but the visual diagram is faster for spacing adjustments.

### 5.10 Component vs Raw DOM Element Handling

**Detection:** A component is "named" when `selectedComponentData.name` starts with a capital letter AND is not one of the known HOC wrapper names: `ForwardRef`, `Memo`, `Context.Consumer`, `Context.Provider`, `Suspense`. For namespaced components (e.g., `Form.Item`), the full dotted name is used as-is. HOC-wrapped components where the inner component's `displayName` is set will use the `displayName` (the fiber serializer already prefers `displayName || name`). A raw element is when it's a lowercase HTML tag (`div`, `button`, `span`, etc.).

**Named component:** shows a purple `Component` badge next to the name in the panel header. All design sections available. When generating an intent, the system checks whether the change maps to a known prop (via AST indexer) and uses `type: 'prop'` if so, `type: 'style'` otherwise.

**Raw DOM element:** shows a grey `Element` badge. All design sections available. When an intent is confirmed, a soft suggestion appears below the diff: "This is a raw `<div>`. Consider extracting it to a named component for cleaner intent tracking." Not blocking — the intent is valid either way.

**Unknown (no fiber data):** Panel shows a "Not inspectable" state with instructions — component may be in a production build or outside the fiber hook's scope.

### 5.11 Props Tab

Available when:
1. `selectedComponentData` exists and name is capitalized, AND
2. AST indexer is running AND has an entry for that component name

Displays:
- Each prop as a row: name, type badge, current runtime value, input to override
- Read-only props (no default, required): shown with a lock icon
- Overriding a prop: for isolation artboards, sends `UPDATE_ISOLATION_PROPS` immediately (live re-render). For route artboards, prop overrides are queued as `type: 'prop'` intent changes — they do NOT update the live component (there is no mechanism to inject new props into a running React tree without a code change). The prop value is shown in the input as a "proposed" value (amber indicator), and the Code tab becomes active to preview the required source change. The UI makes clear this is a code change, not a live preview.

When the indexer is not running, the Props tab shows: "Start `originmain dev` with the CLI to see prop types."

### 5.12 Files to Create / Change

| File | Change |
|---|---|
| `packages/app/src/components/inspector/DesignPanel.tsx` | NEW — main panel with tab bar (Design / Props / Code) |
| `packages/app/src/components/inspector/sections/FrameSection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/LayoutSection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/FillSection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/StrokeSection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/EffectsSection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/TypographySection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/ConstraintsSection.tsx` | NEW |
| `packages/app/src/components/inspector/sections/BoxModelSection.tsx` | NEW |
| `packages/app/src/components/inspector/PropsTab.tsx` | NEW |
| `packages/app/src/components/inspector/Inspector.tsx` | Replace with `<DesignPanel>`. **Phase 1 integration:** `DesignPanel.tsx` must display call-site info in its header: `used in {callSite.fileName}:{callSite.lineNumber}` (conditional on `selectedComponentData?.callSite`). Phase 2 does not require Phase 1 to be merged first — implement the field as optional. |
| `packages/app/src/store/canvas.ts` | Add `selectedElementMode: 'component' \| 'element' \| null` |
| `packages/renderer/src/protocol.ts` | Add `hasDirectText`, `hasParagraphChildren` to `ElementStylesMessage`; add `PATCH_CHILDREN_STYLE` host message |
| `packages/renderer/src/fiber-hook.ts` | Compute `hasDirectText` / `hasParagraphChildren` in `REQUEST_ELEMENT_STYLES` handler; handle `PATCH_CHILDREN_STYLE` |

---

## 6. Phase 3 — CLI AST Indexer

### 6.1 Index Structure

```ts
interface ComponentEntry {
  name: string;
  definitionFile: string;       // absolute path to the file where the component is defined
  relativeFile: string;         // relative to project root: "src/components/Card.tsx"
  lineNumber: number;           // line of the export declaration
  isDefaultExport: boolean;
  props: PropEntry[];
  tokensUsed: string[];         // CSS custom properties found in file: ["--color-primary"]
  lastIndexed: number;          // Date.now()
}

interface PropEntry {
  name: string;
  type: string;                 // "string | undefined"
  optional: boolean;
  // Note: default values out of scope for Phase 3 — Phase 5+
}
```

### 6.2 AST Parsing Approach

Use TypeScript's compiler API (`ts.createSourceFile()`) — parse only, no type-checking.

**What to extract per file:**
1. All named and default exported functions/arrow functions starting with a capital letter. Note: functions exported with capital letters that are not React components (e.g., `GetUserById`, `FormatCurrency`) will appear in the index. The indexer uses a secondary heuristic to filter them: a function is treated as a component only if its return type or return statement contains JSX (detected by scanning the function body for `<` followed by a capital letter or known HTML tag). Functions with no JSX in the body are excluded from the component index.
2. Their first parameter's type annotation (the `Props` type)
3. All string literals matching `/var\(--[-\w]+\)/g` in JSX attributes and template literals. The character class `[-\w]` covers lowercase, uppercase, digits, underscores, and hyphens — the full valid set for CSS custom property names after `--`.

**What to skip:**
- Full type resolution (expensive, requires full `tsconfig` program)
- Module graph traversal (index only direct file exports)
- `node_modules` (skip entirely)
- Files > 500KB (skip with a warning log)

**Parse-only limitation for imported types:** `ts.createSourceFile()` parses the AST but does not resolve type aliases or imports. A component typed as `(props: CardProps) => ...` where `CardProps` is imported will yield a single `PropEntry { name: "props", type: "CardProps", optional: false }` rather than expanded individual prop names. The Props tab shows this as an opaque type badge with a note: "Type `CardProps` — expand by running the indexer with `--full-types` (Phase 5+)." Full type expansion via TypeScript's program API is deferred to Phase 5.

### 6.3 Local HTTP API

CLI second server on port `4171` (or `--index-port N`):

```
GET  /components               → ComponentEntry[]    all indexed components
GET  /components?name=Card     → ComponentEntry[]    fuzzy-matched by name
GET  /components?file=src/…    → ComponentEntry[]    all exports from a file
GET  /file?path=src/…          → { content: string, lines: number }   ← NEW
GET  /health                   → { status, indexed, lastScan, projectRoot }
POST /reindex                  → triggers full rescan
```

**Security on `GET /file`:**
- Validate the `path` parameter is within the project root: resolve to absolute path first using `path.resolve(projectRoot, requestedPath)`, then verify `absolute === projectRoot || absolute.startsWith(projectRoot + path.sep)`. The `+ path.sep` suffix prevents path prefix confusion (e.g., `/home/user/app-secrets` starting with `/home/user/app`).
- Path resolution order: (1) URL-decode the `path` parameter first (`decodeURIComponent`), (2) resolve to absolute using `path.resolve(projectRoot, decoded)`, (3) verify the resolved absolute path is within `projectRoot + path.sep`. Do NOT do a raw string `..` check before resolution — URL-encoded traversal (`%2F..%2F`) bypasses raw string checks.
- Only serve `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`, `.json` files
- Never serve: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.crt`, `*.cer`, `*.der`, `*.secret`, `*.secrets`, anything in `.git/`, `node_modules/.*/`, or any file whose name matches `/password|secret|credential|token|private/i`.
- Log all file-read requests

### 6.4 File Watching

Use `chokidar.watch(projectRoot, { ignored: /node_modules/, persistent: true })` — `chokidar` is required over Node's built-in `fs.watch` due to well-documented reliability issues with `fs.watch` on macOS (missed events, high CPU, broken on network mounts). Add `chokidar` as a dependency of `@originmain/cli`. On `change` or `add` events for `.ts` or `.tsx` files:
1. Re-index only that file (incremental update)
2. Broadcast `{ type: 'INDEX_UPDATED', file }` to any SSE subscribers (the canvas subscribes)

Also watch `.css`, `.scss`, `.less` files for changes. On a CSS file change, re-scan for `var(--token)` references in any component that imports that CSS file (use the import graph tracked in the index). Broadcast `{ type: 'INDEX_UPDATED', file, reason: 'css-tokens' }` to SSE subscribers.

Full rescan on startup. Full rescan on `POST /reindex`.

**SSE Endpoint for index updates:**
```
GET /events    → text/event-stream
```
Events are newline-delimited JSON: `data: {"type":"INDEX_UPDATED","file":"src/components/Card.tsx"}\n\n`

Authentication: none required (localhost-only). CORS: `Access-Control-Allow-Origin: *` (localhost). Reconnect: the canvas uses the browser's native `EventSource` API, which automatically reconnects on disconnect with exponential backoff. The canvas reconnects every 5s if the CLI restarts. On reconnect, the canvas triggers a full panel re-evaluation (deviation check + indexer health check).

### 6.5 CLI Command Change

```
originmain dev --target http://localhost:3000 [--port 4170] [--index-port 4171] [--no-index]
```

`--no-index` disables the AST indexer. The canvas degrades gracefully: Props tab hidden, diff generation uses component name only (no prop schema).

### 6.6 Files to Create / Change

| File | Change |
|---|---|
| `packages/cli/src/indexer.ts` | NEW — AST walker, component map, file watcher |
| `packages/cli/src/index-server.ts` | NEW — HTTP API on port 4171, `GET /file` endpoint |
| `packages/cli/src/isolation-server.ts` | NEW — serves `/__om_isolation__` wrapper pages (Vite: inline HTML; Next.js: writes temporary `src/app/__om_isolation__/page.tsx` to the user's project) |
| `packages/cli/src/detect-framework.ts` | NEW — canonical framework detection logic; imported by all CLI modules |
| `packages/cli/src/cli.ts` | Add `--index-port` / `--no-index` / isolation handler |
| `packages/cli/src/proxy.ts` | Inject `window.__OM_INDEX_URL__` and `window.__OM_ISO_BASE__` into proxied HTML |

---

## 7. Phase 4 — Intent Message & Code Diff Preview

### 7.1 Full Canvas Flow

```
1. User selects a component            → COMPONENT_SELECTED, ELEMENT_STYLES
2. User adjusts a value in the panel   → patchStyleEdit() → PATCH_ELEMENT_STYLE → DOM preview
3. User clicks "Preview Code Change" (button is disabled and shows "CLI indexer required" if the indexer is offline — see §5.1 placeholder behavior) → Code tab becomes active, diff generation begins
4. Canvas fetches file from CLI        → GET /file?path=src/components/Card.tsx
5. Canvas generates diff client-side   → diffLines(originalContent, patchedContent)
6. Diff viewer shown in Code tab       → before/after, line-by-line
7. User inspects / approves
8. User clicks "Send to Agent"         → IntentMessage built and sent to Agent Bridge
9. Agent reads, edits file, saves      → hot reload fires
10. FIBER_TREE_UPDATE arrives          → artboard re-renders with real change
11. Intent status updated to IMPLEMENTED
```

### 7.2 Intent Message Format

```ts
interface IntentMessage {
  intentId: string;                      // uuid
  workspaceId: string;
  artboardId: string;

  component: {
    name: string;                        // "DashboardCard"
    nodeId: string;                      // fiber path ID
    callSite?: string;                   // "src/app/dashboard/page.tsx:34" (from _debugSource)
    definitionFile?: string;             // "src/components/DashboardCard.tsx" (from indexer)
    definitionLine?: number;
    props: Record<string, unknown>;      // current runtime props
    propsSchema?: PropEntry[];           // from AST indexer
  };

  changes: IntentChange[];

  codeDiff?: {
    file: string;                        // "src/components/DashboardCard.tsx"
    originalContent: string;             // full file content before change
    patchedContent: string;              // full file content after predicted change
    hunks: DiffHunk[];                   // structured diff for display
    confidence: 'exact' | 'approximate'; // exact = deterministic CSS; approximate = prop change
  };

  snapshot?: {
    before: string;                      // base64 PNG at time of selection
    after?: string;                      // base64 PNG after DOM preview (captured on confirm)
  };

  // Snapshot capture mechanism: `CAPTURE_SNAPSHOT` is NOT sent on every component click — it is
  // sent only in two situations: (1) when the user has hovered a component for > 200ms (debounced),
  // indicating genuine intent to inspect rather than a rapid traverse; and (2) when the user clicks
  // 'Preview Code Change', capturing the after-state 100ms after the last DOM patch settles.
  // If a snapshot is already in-flight (SNAPSHOT_READY not yet received), any new CAPTURE_SNAPSHOT
  // is queued and the previous in-flight capture is cancelled via a new CANCEL_SNAPSHOT host message.
  // Add CAPTURE_SNAPSHOT, CANCEL_SNAPSHOT (host messages) and SNAPSHOT_READY (renderer message)
  // to protocol.ts. The fiber hook responds to CAPTURE_SNAPSHOT by running
  // html2canvas(el, { useCORS: true, timeout: 3000 }) on the selected element's stateNode, then
  // posting SNAPSHOT_READY. On timeout or error, it posts SNAPSHOT_READY with dataUrl: null.

  designLanguage?: {
    tokensUsed: string[];
    palette: Record<string, string>;     // token key → resolved value
  };

  createdAt: string;                     // ISO 8601
}

// Payload size guidance: `codeDiff.originalContent` and `codeDiff.patchedContent` are full file
// contents and may be large (tens of KB). Before storing in `intent_diffs.payload`, the canvas
// should check: if the combined content exceeds 256KB, upload both files to Supabase Storage
// (`intent-diffs/{intentId}/original.ts` and `patched.ts`) and store only the Storage URLs in
// the payload. The agent receives the Storage URLs and downloads them. The `snapshot.before`/`after`
// base64 PNGs should also be stored in Supabase Storage if they exceed 50KB. Add
// `originalContentUrl?` and `patchedContentUrl?` to the `codeDiff` type as alternatives to
// inline content.

interface IntentChange {
  type: 'style' | 'prop' | 'layout' | 'remove';
  cssProperty?: string;
  propName?: string;
  from: unknown;
  to: unknown;
  tokenKey?: string;                     // e.g. "--radius-md" if value maps to a token (Phase 6)
  confidence: 'exact' | 'approximate';
}

interface DiffHunk {
  startLine: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  lineNumber: number;
  // Character/word-level inline change ranges — passed to FileDiff options.inlineChanges: 'character'
  inlineChanges?: Array<{ start: number; end: number; type: 'added' | 'removed' }>;
}
```

**Line number convention:** `DiffHunk.startLine` and `DiffLine.lineNumber` are **1-indexed** (line 1 is the first line of the file), matching standard editor conventions and the `DiffLineAnnotation.line` field accepted by `@pierre/diffs`.

### 7.3 Client-side Diff Generation

**CSS-only changes** (type: `style`) — deterministic, confidence: `exact`:

Before searching for CSS property values, the generator first checks for CSS module imports (see CSS module detection paragraph below). If a CSS module is found, the search targets that file. If no CSS module is found, search the `.tsx` file using the strategies below.

1. CSS module detection: Before searching the component's `.tsx` file for the CSS value, the diff generator checks if the component imports a `.module.css` or `.module.scss` file (by scanning the **entire file** for any import statement matching `/import\s+\w+\s+from\s+['"][^'"]+\.module\.(css|scss|less)['"]/`). The import binding name is extracted (e.g., `styles`, `classes`, `cx`) — any binding name is valid. The matched CSS module file path is resolved relative to the `.tsx` file's directory. This scan must cover the entire file, not just the first N lines, as imports may appear after JSDoc headers or other imports. If a CSS module import is found, the diff generator fetches that CSS file via `GET /file?path=…` and searches it first. If a match is found in the CSS file, the diff targets that file instead. The `codeDiff.file` field reflects whichever file the change was found in.
2. Fetch file content from `GET /file?path=…`
3. Parse the file: find all occurrences of the CSS property value being changed. Strategy:
   - Look for the property in a `style={}` JSX prop
  **CSS property names must be converted to camelCase before searching `style={{}}` JSX attributes:** `background-color → backgroundColor`, `border-radius → borderRadius`, `font-size → fontSize`. Use a `cssPropertyToCamelCase(prop: string): string` utility in `diff-generator.ts`. When targeting a CSS module file or a `styled`/`css` template literal, search using the original kebab-case form.
   - Look for the property in a `className` → check the CSS modules file if any
   - Look for the property in a `styled` template literal (CSS-in-JS)
   - Tailwind detection: if `tailwind.config.*` is found, the diff generator does NOT attempt class mapping in Phase 4. Instead, it shows an annotation: "⚠ Tailwind project detected — diff is approximate. Agent will determine the correct class replacement." The full Tailwind class mapping (Phase 4.1) is a separate scope item.
4. Replace the matching occurrence with the new value
5. Generate a line diff (using `diff` npm package — lightweight, already common)
6. Confidence is `exact` if exactly one match was found; `approximate` if zero or multiple

**File not found (404 / 403):** If `GET /file` returns 404 (component from a library such as `@radix-ui`, `shadcn/ui`, etc.) or 403 (blocked by security rules), the Code tab shows: *'Source file not in project — this component may be from a third-party library. You can still send a description to the agent.'* All changes for that component are marked `confidence: 'approximate'`. The 'Send to Agent' button changes to 'Send description only' — the intent is sent without `codeDiff`, containing only the component name, change description, and runtime props.

**Prop changes** (type: `prop`) — confidence: `approximate`:

1. Fetch file content
2. Find JSX call sites of the component (using the call site from `_debugSource`)
3. Find the prop in question in the JSX attributes
4. Suggest the replacement
5. Always `approximate` — prop values may be expressions, variables, or spread props

**When no match is found:**
The diff viewer shows: "Could not locate this property in the source file. The agent will search for it." Confidence is `approximate`. The intent is still valid — the agent has the component name, file path, and change description.

### 7.4 Diff Viewer UI (Code Tab)

**Package:** [`@pierre/diffs`](https://diffs.com) (npm, v1.1.20, Apache 2.0). Install:

```
npm install @pierre/diffs
```

Peer dependencies: React ≥ 18.3.1 or 19.x, `shiki ^3.0.0`.

**Imports:**

```ts
// React components
import { FileDiff, MultiFileDiff, Virtualizer } from '@pierre/diffs/react';

// Core utilities (accept/reject API, theming)
import {
  diffAcceptRejectHunk,
  resolveTheme,
  registerCustomCSSVariableTheme,
} from '@pierre/diffs';
```

`@pierre/diffs` manages a Shadow DOM internally for CSS isolation — this is completely transparent to React consumers. `FileDiff` is a standard React component with no extra setup.

#### Layout

The Code tab renders a **split view** (side-by-side) by default — left pane shows the original, right pane shows the patched version. A toggle in the tab header switches to **stacked (unified) view** for narrower panels. The choice is persisted to localStorage per-user.

The `layout` prop on `FileDiff` controls this directly:

```tsx
<FileDiff
  diff={diff}
  options={{
    layout: splitMode ? 'split' : 'stacked',  // 'split' | 'stacked'
  }}
/>
```

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Code  ●  src/components/DashboardCard.tsx          [Split ↔ Unified]    │
├──────────────────────────────┬──────────────────────────────────────────┤
│  BEFORE                      │  AFTER                                   │
├──────────────────────────────┼──────────────────────────────────────────┤
│  22 │  borderRadius: '8px',  │  22 │  borderRadius: '12px',            │
│     │  ^^^^^^^^              │     │   ^^^^^                            │
│     │  (red highlight)        │     │  (green highlight — char-level)   │
│  23 │  background: 'var(…)', │  23 │  background: 'var(…)',            │
├──────────────────────────────┴──────────────────────────────────────────┤
│  ⚠ line 22 — Approximate match. Agent may adjust.    [Accept] [Reject] │
└─────────────────────────────────────────────────────────────────────────┘
│  [✕ Discard all]                              [Send to Agent →]         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Character/word-level highlighting

`@pierre/diffs` renders inline change ranges within each modified line via `options.inlineChanges`. Set this to `'character'` for the finest granularity — for a change from `'8px'` to `'12px'`, only those characters are highlighted rather than the whole line. This is the most important improvement over a naive line-diff: users instantly see exactly what value changed without scanning an entire line.

```tsx
<FileDiff
  diff={diff}
  options={{
    inlineChanges: 'character',  // 'character' | 'word' | 'disabled'
  }}
/>
```

The `inlineChanges` field on each `DiffLine` (see §7.2) carries the pre-computed character ranges passed through to `FileDiff`. The library uses these to render sub-line highlights in its Shadow DOM.

#### Per-change Accept / Reject

`@pierre/diffs` exposes `diffAcceptRejectHunk()` for programmatic accept/reject per hunk. This is a **pure function** — it takes the current diff and returns a new diff with the hunk state toggled. Wire it to your React state:

```ts
import { diffAcceptRejectHunk } from '@pierre/diffs';

// In CodeTab.tsx state:
const [diff, setDiff] = useState<Diff>(initialDiff);

// Accept hunk at index i:
setDiff(prev => diffAcceptRejectHunk(prev, i, 'accept'));

// Reject hunk at index i:
setDiff(prev => diffAcceptRejectHunk(prev, i, 'reject'));
```

**Signatures:**
```ts
function diffAcceptRejectHunk(
  diff: Diff,
  hunkIndex: number,
  action: 'accept' | 'reject'
): Diff;
```

Semantic behaviour wired in `CodeTab.tsx`:

- **Accept** (default for `confidence: 'exact'` hunks) — the hunk is included in `codeDiff.patchedContent` when the intent is sent.
- **Reject** — the hunk is excluded; the original value is kept for that position. Useful when the diff generator found the wrong occurrence.
- When all hunks in a file are rejected, the "Send to Agent" button label changes to "Send description only" — the intent is sent without `codeDiff`, falling back to the textual change description.

#### Inline annotations

`@pierre/diffs` injects annotations adjacent to diff lines via `options.annotations`. Each annotation is a `DiffLineAnnotation` object:

```ts
interface DiffLineAnnotation {
  line: number;            // 1-based line number
  side: 'before' | 'after'; // which pane the annotation appears in
  message: string;         // text to display
  type?: 'info' | 'warning' | 'error';
}
```

**Usage in `CodeTab.tsx`:**
```tsx
const annotations: DiffLineAnnotation[] = codeDiff.hunks.flatMap(hunk => {
  const results: DiffLineAnnotation[] = [];
  if (hunk.confidence === 'approximate') {
    results.push({
      line: hunk.afterLine,
      side: 'after',
      message: '⚠ Approximate — agent will verify this location before applying',
      type: 'warning',
    });
  }
  if (hunk.tokenKey) {
    results.push({
      line: hunk.afterLine,
      side: 'after',
      message: `✦ Token: ${hunk.tokenKey} — exact match from design language`,
      type: 'info',
    });
  }
  return results;
});

<FileDiff diff={diff} options={{ annotations }} />
```

Rendered output for an approximate hunk:

```
22 │  borderRadius: '12px',
   └─ ⚠ Approximate — agent will verify this location before applying
```

For a token-mapped hunk (Phase 6):

```
22 │  borderRadius: 'var(--radius-lg)',
   └─ ✦ Token: --radius-lg (12px) — exact match from design language
```

#### Token hover callbacks

`@pierre/diffs` fires `onTokenEnter`, `onTokenLeave`, and `onTokenClick` on *syntax* tokens as identified by the Shiki highlighter (keywords, string literals, numbers, etc.). Each callback receives a `TokenPayload`:

```ts
interface TokenPayload {
  text: string;           // the raw token text
  line: number;           // 1-based line number
  column: number;         // 0-based character offset
  side: 'before' | 'after';
  element: Element;       // the DOM element inside the Shadow DOM (for positioning)
}
```

```tsx
<FileDiff
  diff={diff}
  options={{
    onTokenEnter: (payload) => showTokenPopover(payload),
    onTokenLeave: () => hideTokenPopover(),
    onTokenClick: (payload) => pinTokenPopover(payload),
  }}
/>
```

**Custom range detection required for CSS value semantics:** `onTokenEnter` fires on every Shiki syntax token, not specifically CSS property values. To attach design token metadata, `CodeTab.tsx` must intercept `onTokenEnter` and apply additional logic:

1. Run a regex over the `payload.text` to detect CSS value patterns: color functions (`rgb(…)`, `hsl(…)`, hex), pixel/rem values, `var(--token-name)` references.
2. Call `resolveValueToToken(payload.text, designLanguage)` (from `@originmain/design-language`) to check for matches.
3. If a match is found, show a popover positioned relative to `payload.element` (use `getBoundingClientRect()` on it — it is a real DOM node).
4. Popover content when `designLanguage` is loaded (Phase 6):
   - Token match → token name, group, raw value, color swatch for color tokens
   - Near-miss → "Not in design language. Nearest: `--radius-md` (8px)"
   - `var(--token-name)` → resolved value + full token metadata

This is additional logic in `CodeTab.tsx` — `@pierre/diffs` fires the event, the component decides what to display.

#### Visual style options

Use **full-width background colors** (not `+`/`–` symbols) via `options.diffIndicators: 'background'`. This fills the entire line with a red/green tint, giving a clean aesthetic consistent with the rest of the canvas UI and avoiding terminal-style gutter symbols:

```tsx
<FileDiff
  diff={diff}
  options={{
    diffIndicators: 'background',  // 'background' | 'gutter' | 'both' | 'none'
  }}
/>
```

#### Theming (Shiki-based)

`@pierre/diffs` uses Shiki for syntax highlighting. It adapts to any Shiki-compatible theme. Register a CSS-variable-driven theme that tracks the canvas's `data-theme` attribute:

```ts
import { registerCustomCSSVariableTheme } from '@pierre/diffs';

// Call once at app startup (e.g. in a layout component or Zustand initializer)
registerCustomCSSVariableTheme({
  name: 'originmain-dark',
  // Map Shiki token types to CSS variables defined in globals.css
  colorReplacements: {
    '#000000': 'var(--syntax-bg)',
    '#ffffff': 'var(--syntax-fg)',
    // ... map other Shiki palette entries to your design tokens
  },
});
```

Then pass the theme name to `FileDiff`:

```tsx
<FileDiff
  diff={diff}
  options={{
    theme: theme === 'dark' ? 'originmain-dark' : 'github-light',
  }}
/>
```

Alternatively, call `resolveTheme(themeName)` to get the resolved Shiki theme object for programmatic use.

#### Large-file virtualisation

For files exceeding ~500 lines, wrap `FileDiff` in `Virtualizer` to avoid rendering every hunk at once. `Virtualizer` from `@pierre/diffs/react` provides windowed rendering with the same API surface:

```tsx
import { FileDiff, Virtualizer } from '@pierre/diffs/react';

<Virtualizer>
  <FileDiff diff={diff} options={options} />
</Virtualizer>
```

`Virtualizer` measures its container and renders only the visible hunks. Use it unconditionally in `CodeTab.tsx` — the overhead when the file is small is negligible, and it prevents layout jank on large components.

#### Full `CodeTab.tsx` component sketch

```tsx
import { useState, useMemo } from 'react';
import { FileDiff, Virtualizer } from '@pierre/diffs/react';
import { diffAcceptRejectHunk } from '@pierre/diffs';
import type { DiffLineAnnotation, TokenPayload } from '@pierre/diffs';

export function CodeTab({ codeDiff, artboardId }: CodeTabProps) {
  const [diff, setDiff] = useState(codeDiff.fileDiff);
  const [layout, setLayout] = useState<'split' | 'stacked'>(() =>
    (localStorage.getItem('diffLayout') as 'split' | 'stacked') ?? 'split'
  );
  const [popover, setPopover] = useState<TokenPopoverState | null>(null);
  const { designLanguage } = useCanvas();

  const annotations = useMemo<DiffLineAnnotation[]>(() =>
    codeDiff.hunks.flatMap(hunk => buildAnnotations(hunk)),
    [codeDiff.hunks]
  );

  const allRejected = diff.hunks.every(h => h.rejected);

  function handleAccept(i: number) {
    setDiff(prev => diffAcceptRejectHunk(prev, i, 'accept'));
  }
  function handleReject(i: number) {
    setDiff(prev => diffAcceptRejectHunk(prev, i, 'reject'));
  }

  function handleTokenEnter(payload: TokenPayload) {
    if (!designLanguage) return;
    const match = resolveValueToToken(payload.text, designLanguage);
    if (match) setPopover({ payload, match });
  }

  return (
    <div className="code-tab">
      <CodeTabHeader
        filePath={codeDiff.filePath}
        layout={layout}
        onLayoutToggle={() => {
          const next = layout === 'split' ? 'stacked' : 'split';
          setLayout(next);
          localStorage.setItem('diffLayout', next);
        }}
      />

      <Virtualizer>
        <FileDiff
          diff={diff}
          options={{
            layout,
            inlineChanges: 'character',
            diffIndicators: 'background',
            annotations,
            onTokenEnter: handleTokenEnter,
            onTokenLeave: () => setPopover(null),
            onTokenClick: (p) => setPopover(prev => prev?.payload === p ? null : { payload: p, match: resolveValueToToken(p.text, designLanguage) }),
          }}
        />
      </Virtualizer>

      {/* Per-hunk accept/reject controls rendered outside FileDiff, positioned by line */}
      <HunkControls
        hunks={codeDiff.hunks}
        diff={diff}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      {popover && <TokenPopover state={popover} />}

      <CodeTabFooter
        allRejected={allRejected}
        onSend={() => sendToAgent(diff, codeDiff, artboardId)}
        onDiscardAll={() => setDiff(codeDiff.fileDiff)}
      />
    </div>
  );
}
```

#### Line selection

Users can click a line number to select it, drag to select a range, or Shift+click to extend. Selected lines define a **partial send**: only the selected hunks are included in the intent. This is useful when the diff generator correctly found multiple occurrences but the user only wants to change one.

#### "Send to Agent" button

Builds the full `IntentMessage`:
1. Captures the after-snapshot (100ms delay for DOM to settle)
2. Includes only accepted, non-rejected hunks in `codeDiff.patchedContent`
3. Sets `codeDiff.confidence` to `'exact'` if all included hunks were accepted exact matches; `'approximate'` otherwise
4. POSTs to `/api/intent` → Agent Bridge `push_intent`
5. Button changes to a spinner → "Sent ✓ — waiting for agent" → "✓ Applied" on `IMPLEMENTED`

**Undo queue:** `styleEditQueue` in Zustand maintains a stack. `Cmd+Z` pops the last item, sends `PATCH_ELEMENT_STYLE` with the `from` value to restore the DOM preview, and clears the Code tab.

### 7.5 Files to Create / Change

| File | Change |
|---|---|
| `packages/app/src/lib/diff-generator.ts` | NEW — client-side diff logic (CSS, prop, Tailwind strategies) |
| `packages/app/src/components/inspector/CodeTab.tsx` | NEW — diff viewer, edit mode, Send to Agent button |
| `packages/app/src/store/canvas.ts` | Add `undoStyleEdit()` action; add `intentStatus` map |
| `packages/app/src/app/api/intent/route.ts` | NEW — POST endpoint for `push_intent` (proxies to Agent Bridge) |
| `packages/app/package.json` | Add `"@pierre/diffs": "^1.1.20"` and `"shiki": "^3.0.0"` |

---

## 8. Phase 5 — Agent Bridge Enhancements

### 8.1 New Tool: `push_intent`

**Direction:** Canvas → Agent Bridge → coding agent

```ts
// Input schema
{
  workspace_id: z.string().uuid(),
  intent: z.object({
    intentId: z.string().uuid(),
    component: z.object({
      name: z.string(),
      definitionFile: z.string().optional(),
      definitionLine: z.number().optional(),
      callSite: z.string().optional(),
    }),
    changes: z.array(z.object({
      type: z.enum(['style', 'prop', 'layout', 'remove']),
      cssProperty: z.string().optional(),
      propName: z.string().optional(),
      from: z.unknown(),
      to: z.unknown(),
      tokenKey: z.string().optional(),
      confidence: z.enum(['exact', 'approximate']),
    })),
    codeDiff: z.object({
      file: z.string(),
      originalContent: z.string(),
      patchedContent: z.string(),
      confidence: z.enum(['exact', 'approximate']),
    }).optional(),
    snapshot: z.object({
      before: z.string(),
      after: z.string().optional(),
    }).optional(),
    designLanguage: z.object({
      tokensUsed: z.array(z.string()),
      palette: z.record(z.string()),
    }).optional(),
  }),
}
```

**What the tool does:**
1. Stores intent in `intent_diffs` table with status `EXPORTED`
2. Broadcasts `INTENT_RECEIVED` over WebSocket to connected agent
3. Returns `{ intentId, status: 'EXPORTED' }`

When `codeDiff` is present with confidence `exact`, the agent is instructed to apply the diff verbatim. When `approximate`, the agent uses the diff as guidance and may refine it.

### 8.2 New Tool: `resolve_component`

**Direction:** Coding agent → Agent Bridge → CLI indexer

```ts
// Input
{ component_name: z.string() }

// Output
{
  name: string;
  definitionFile: string;
  relativeFile: string;
  lineNumber: number;
  props: PropEntry[];
  tokensUsed: string[];
}
```

The Agent Bridge proxies `GET /components?name=DashboardCard` to the registered CLI indexer URL. Returns 404 if no indexer is registered for the workspace session.

### 8.3 CLI Indexer Registration

```
originmain dev starts
  → proxy on :4170
  → indexer on :4171
  → POST {AGENT_BRIDGE_URL}/register-indexer
    { workspaceToken, indexerUrl: "http://localhost:4171", ttl: 60 }
  → Agent Bridge stores { indexerUrl, expiresAt: now + ttl } per workspace session
  → resolve_component and file-fetch proxy to indexerUrl
  → CLI sends a heartbeat POST every 30s to refresh the TTL
  → Agent Bridge removes the registration if no heartbeat for > 90s
```

**Agent Bridge URL:** The CLI reads `ORIGINMAIN_BRIDGE_URL` from environment (set in the workspace's `.env.local` or `~/.originmain/config.json` written by the CLI's `originmain login` command). Default for self-hosted: `http://localhost:4172`.

**Workspace token:** Read from `~/.originmain/config.json` (written by `originmain login`). The config stores `{ workspaceToken, workspaceId, bridgeUrl }`. If no token is found, `register-indexer` is skipped and the CLI logs "Not logged in — agent bridge integration disabled."

**Security:** The `indexerUrl` is `localhost`-only. The Agent Bridge must reject any `indexerUrl` that is not `localhost` or `127.0.0.1` — it must never proxy requests to external URLs.

### 8.4 Protocol Extension — `INTENT_RECEIVED` Server Push

```ts
// Server → agent over WebSocket (not a JSON-RPC request, no id)
{
  type: 'INTENT_RECEIVED',
  intent: IntentMessage,
}
```

Claude Code sessions receive this immediately after `push_intent` is called.

### 8.4a Existing `intent_diffs` Table (Reference)

`push_intent` writes to this existing table. Schema for reference:

```sql
-- Existing table (do not recreate — shown for reference only)
CREATE TABLE intent_diffs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) NOT NULL,
  artboard_id  uuid REFERENCES artboards(id),
  payload      jsonb NOT NULL,   -- the full IntentMessage JSON
  status       text NOT NULL DEFAULT 'DRAFT',
  -- DiffStatus enum: 'DRAFT' | 'EXPORTED' | 'IMPLEMENTED' | 'BLOCKED'
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
```

`push_intent` inserts with `status: 'EXPORTED'`.  
`update_diff_status` updates the `status` column.  
`get_pending_diffs` queries `WHERE status = 'EXPORTED'`.

### 8.5 Files to Create / Change

| File | Change |
|---|---|
| `packages/agent-bridge/src/tools.ts` | Add `push_intent`, `resolve_component` |
| `packages/agent-bridge/src/protocol.ts` | Add `IntentMessage`, `IntentChange`, `INTENT_RECEIVED` |
| `packages/agent-bridge/src/index.ts` | Handle `/register-indexer`, store per-workspace indexer URL |
| `packages/agent-bridge/src/adapters/claude-code.ts` | Document new tools in `CLAUDE.md` section — **must explicitly instruct**: "After successfully applying an intent diff, call `update_diff_status` with the `intentId` from the `INTENT_RECEIVED` message and status `IMPLEMENTED`. If the diff could not be applied, call with status `BLOCKED` and include a reason." |
| `packages/app/src/app/api/agent-bridge/route.ts` | Wire `push_intent` and `resolve_component` |
| `packages/cli/src/commands/login.ts` | NEW — OAuth flow; on success writes `{ workspaceToken, workspaceId, bridgeUrl }` to `~/.originmain/config.json` |
| `packages/cli/src/cli.ts` | Register `originmain login` subcommand |

---

## 9. Phase 6 — Design Language System

This is the layer that transforms the design panel from a CSS editor into a design-system-aware tool. Every value input becomes token-aware. Deviations are flagged. The agent writes `var(--token)` instead of raw values.

### 9.1 Supported Input Formats

Three formats are accepted. The parser auto-detects the format on upload.

**Format A — Style Dictionary (most common)**
```json
{
  "color": {
    "primary": { "value": "#0066FF", "type": "color", "description": "Primary brand blue" },
    "surface": { "value": "{color.neutral.50}", "type": "color" }
  },
  "spacing": {
    "xs": { "value": "4px", "type": "spacing" },
    "sm": { "value": "8px", "type": "spacing" }
  },
  "borderRadius": {
    "sm": { "value": "4px", "type": "borderRadius" },
    "md": { "value": "8px", "type": "borderRadius" },
    "lg": { "value": "12px", "type": "borderRadius" }
  }
}
```
References use `{group.name}` syntax. Resolved recursively.

**Format B — W3C Design Token Community Group (DTCG / Tokens Studio)**
```json
{
  "color": {
    "primary": { "$value": "#0066FF", "$type": "color" },
    "surface": { "$value": "{color.neutral.50}", "$type": "color" }
  }
}
```
Properties prefixed with `$`. Same reference syntax as Style Dictionary.

**Format C — Flat CSS variable map (simplest)**
```json
{
  "--color-primary":     "#0066FF",
  "--color-surface":     "#FFFFFF",
  "--spacing-xs":        "4px",
  "--spacing-sm":        "8px",
  "--radius-md":         "8px",
  "--shadow-card":       "0 4px 8px rgba(0,0,0,0.08)"
}
```
No nested structure, no references, just CSS custom property name → raw value.

**Format detection heuristic:**
- Any key starts with `--` → Format C
- Any value object has `$value` or `$type` → Format B
- Any value object has `value` or `type` → Format A
- None match → show "Unknown format" error with guidance

### 9.2 Normalized Internal Format

All three formats are parsed into a single normalized list:

```ts
type TokenType =
  | 'color'
  | 'spacing'
  | 'sizing'
  | 'borderRadius'
  | 'borderWidth'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'shadow'
  | 'opacity'
  | 'other';

interface DesignToken {
  key: string;              // CSS custom property: "--color-primary"
  name: string;             // Human label: "Color / Primary"
  group: string;            // Top-level group: "color", "spacing", etc.
  rawValue: string;         // Resolved CSS value: "#0066FF"
  type: TokenType;
  description?: string;
  aliasChain?: string[];    // If resolved from an alias: ["--color-brand-500"]
}
```

**CSS custom property key derivation:**
- Format A/B: `{ "color": { "primary": ... } }` → `--color-primary`
- Format C: key is already the CSS custom property name (used as-is)
- Nested paths: `{ "color": { "brand": { "500": ... } } }` → `--color-brand-500`
- **camelCase segments are converted to kebab-case before joining.** Each path segment is passed through `segment.replace(/([A-Z])/g, '-$1').toLowerCase()` before joining with `-`. Examples: `"borderRadius"` → `border-radius`, `"fontSize"` → `font-size`, `"boxShadow"` → `box-shadow`. This ensures `{ "borderRadius": { "sm": ... } }` → `--border-radius-sm`, not `--borderRadius-sm`. Add a `toKebabCase(s: string): string` utility to `packages/design-language/src/parser.ts`.

**Human label derivation:**
Path segments joined with ` / `: `"color" + "primary"` → `"Color / Primary"`.

**Type inference (for Format C which has no explicit type):**
- Value matches `#[0-9a-f]{3,8}` or `rgb(` or `hsl(` or `oklch(` → `color`
- Value matches `/^\d+(\.\d+)?(px|rem|em|%)$/` → check key name for context: `spacing`/`size`/`width`/`height` → respective type
- Value matches key containing `radius` → `borderRadius`
- Value matches key containing `shadow` → `shadow`
- Value matches `/^\d+(\.\d+)?$/` and key contains `weight` → `fontWeight`
- Value matches key containing `font-family` or value is a quoted string → `fontFamily`
- Otherwise → `other`

### 9.3 Token Resolver

The token resolver is the core utility of `@originmain/design-language`. Given a raw CSS value and a type, it finds matching tokens.

```ts
interface TokenMatch {
  token: DesignToken;
  exact: boolean;       // value matches perfectly
  distance: number;     // 0 = exact; higher = further from match
}

function resolveValueToToken(
  value: string,
  type: TokenType,
  tokens: DesignToken[]
): TokenMatch | null
```

**Resolution strategy per type:**

**Color:**
1. Normalize both the input value and all color tokens to OKLCH (perceptually uniform) using **`culori`** (MIT, 9 KB minzipped): `import { oklch, parse, differenceCiede2000 } from 'culori'`. Add `culori` as a dependency of `packages/design-language/` only — do not add it to `@originmain/app` directly.
2. Compute chroma-weighted L²CH distance
3. Distance 0 → exact match; distance < 2 → near match (same hue, slight lightness difference); distance < 8 → approximate; > 8 → no match
4. If `value` is already `var(--color-primary)`, extract the key and do a direct lookup

**Spacing / sizing / borderRadius / borderWidth / lineHeight:**
1. Parse the numeric value and unit from both the input and the token. Normalize rem to px using the actual root font size, not a hardcoded 16px. The root font size is sent from the iframe to the canvas in the `READY` message as `rootFontSizePx: number` (add this field to the `READY` message in `dom-inspector.ts` — read it as `parseFloat(getComputedStyle(document.documentElement).fontSize)`). The canvas stores it per-artboard in Zustand and passes it to the token resolver.
2. Exact match: same number, same normalized unit
3. Near match: within 1px (rounding from rem)
4. No match: any other value

**Shadow:**
1. Parse the shadow into components: `{ x, y, blur, spread, color, inset }`
2. Compare component-by-component: all components must match within tolerance for an exact match

**FontFamily:**
String equality after normalizing quotes and whitespace.

**FontWeight:**
Normalize keywords to numbers: `bold → 700`, `normal → 400`. Exact numeric equality.

**FontSize / letterSpacing:**
Same strategy as spacing (numeric + unit normalization).

### 9.4 Deviation Detection

For every value shown in the design panel, a **deviation indicator** is computed:

| State | Indicator | Meaning |
|---|---|---|
| Token match — exact | Green chip showing token name | Value is exactly on-system |
| Token match — near | Amber chip with `~` prefix | Value is close to a token; snap available |
| No token match | Orange dot next to the input | Value deviates from design system |
| No design language loaded | No indicator | Indicators only appear after upload |

Deviation indicators are computed lazily when the panel renders — `resolveValueToToken()` runs for each displayed value against the loaded token set.

### 9.5 Snap to Token

When a near-match amber chip is shown, a `Snap` button appears. Clicking it:
1. Replaces the current value with `token.rawValue`
2. Sends `PATCH_ELEMENT_STYLE` immediately (DOM preview)
3. Updates `styleEditQueue` with the snapped value
4. Queues an `IntentChange` with `tokenKey: token.key` and `confidence: 'exact'`
5. Chip turns green

### 9.6 Design Panel Integration

**Token chip behavior:**
Every color, spacing, radius, shadow, and typography input in the design panel is "token-aware". The input component has two modes:

**Token mode** (when a token match is found):
```
[ ● Color / Primary   ▾ ]  ← green/amber chip, click to open picker
```

**Raw mode** (click the chip, or when no token match):
```
[ #0066FF ____________ ]  ← standard hex input with orange dot if no match
```

Toggle between modes with a small `T` icon button on the input.

**Token input component interface:**
```ts
interface TokenAwareInputProps {
  cssProperty: string;
  value: string;
  tokenType: TokenType;
  onChange: (value: string, tokenKey?: string) => void;
}
```

### 9.7 Token Picker UI

A popover triggered from any token chip or `T` icon button:

```
┌───────────────────────────────────┐
│ 🔍  Search tokens...              │
├───────────────────────────────────┤
│ COLOR                             │
│  ● Primary       #0066FF  ← active│
│  ● Secondary     #7C3AED         │
│  ● Surface       #FFFFFF         │
│  ● Destructive   #E53E3E         │
├───────────────────────────────────┤
│ SPACING                           │
│  ▪ xs   4px                      │
│  ▪ sm   8px                      │
│  ▪ md   16px                     │
└───────────────────────────────────┘
```

- Grouped by token type
- Active token (current value) is highlighted
- Color tokens show a color swatch
- Spacing/radius tokens show a scale bar
- Search filters by name, key, or value
- Click applies immediately (DOM preview) and queues intent

### 9.8 Upload UX & Validation Flow

**Upload surface:** Workspace Settings → Design Language section.

Three input methods:
1. **Drag-and-drop** a `.json` file onto the upload zone
2. **Paste JSON** directly into a text area (for quick testing)
3. **Fetch from URL** — enter a URL that returns a JSON token file. The fetch is proxied server-side through `POST /api/design-language/fetch` (a new Next.js API route) to avoid CORS restrictions. The API route validates the URL is HTTPS and not a private IP before fetching. The raw JSON is returned to the client for the standard validation pipeline.

**Validation pipeline (runs before saving):**

```
Step 1: JSON parse
  → Failure: "Invalid JSON — check for missing commas or brackets"

Step 2: Format detection
  → Failure: "Unknown format. See supported formats: Style Dictionary, W3C DTCG, flat CSS variable map"

Step 3: Token extraction
  → Failure if zero tokens found: "No recognized tokens found in this file"
  → Partial failure (some tokens failed): log failed tokens, continue with valid ones

Step 4: Alias resolution
  → Detect and reject circular references
  → Failure: "Token `--color-primary` has a circular reference: → `--color-brand` → `--color-primary`"
  → Unresolvable aliases: mark token as invalid, skip it, include in partial failure count

Step 5: Type inference (for Format C)
  → Warn if > 20% of tokens are typed as 'other' (may indicate unexpected format)

Step 6: Preview summary
  → "Found 24 colors, 12 spacing values, 8 radii, 4 shadows, 6 typography tokens"
  → Color swatches preview (first 8 color tokens shown as a swatch strip)
  → Spacing scale preview (first 8 spacing tokens shown as a visual scale)
  → Confirm / Cancel buttons
```

After confirmation, tokens are saved to Supabase and `SET_DESIGN_TOKENS` is sent to all live artboards.

### 9.9 Error Handling Reference

| Error | User-facing message |
|---|---|
| Invalid JSON | "Invalid JSON in this file. Check for missing commas, quotes, or brackets." |
| Unknown format | "We couldn't detect the format. Expected: Style Dictionary, W3C DTCG, or flat CSS variable map (`{ \"--token\": \"value\" }`)." |
| Zero tokens found | "No recognized tokens found. Make sure the file contains token definitions, not component config." |
| Circular reference | "Token `{key}` has a circular reference: {chain}. Remove the cycle before uploading." |
| File too large (> 2MB) | "This file is larger than 2 MB. Most token files are under 100 KB — check you've uploaded the right file." |
| Network error on URL fetch | "Could not fetch from `{url}`. Check the URL is accessible and returns JSON." |
| Partial parse | "{N} tokens were imported successfully. {M} tokens were skipped due to unresolvable aliases — they will be listed in the import log." |

### 9.10 Storage — Supabase Schema

```sql
CREATE TABLE design_languages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES workspaces(id) NOT NULL UNIQUE,
  name            text NOT NULL DEFAULT 'Design Language',
  raw_json        jsonb NOT NULL,       -- original uploaded JSON, unchanged
  normalized      jsonb NOT NULL,       -- DesignToken[] after parsing
  source_format   text NOT NULL,        -- 'style-dictionary' | 'dtcg' | 'flat'
  token_count     integer NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Version history: keep the last 10 versions
CREATE TABLE design_language_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_language_id  uuid REFERENCES design_languages(id) NOT NULL,
  version             integer NOT NULL,
  raw_json            jsonb NOT NULL,
  normalized          jsonb NOT NULL,
  source_format       text NOT NULL,
  created_at          timestamptz DEFAULT now()
);
-- Enforce max 10 versions via a trigger that deletes the oldest on insert

CREATE INDEX idx_design_languages_workspace ON design_languages(workspace_id);

-- Enforce max 10 versions per design_language — delete oldest on insert
CREATE OR REPLACE FUNCTION prune_design_language_versions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM design_language_versions
  WHERE design_language_id = NEW.design_language_id
    AND id NOT IN (
      SELECT id FROM design_language_versions
      WHERE design_language_id = NEW.design_language_id
      ORDER BY version DESC
      LIMIT 9
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prune_dl_versions
AFTER INSERT ON design_language_versions
FOR EACH ROW EXECUTE FUNCTION prune_design_language_versions();
```

One design language per workspace (not per project). A workspace has at most one active design language row. On update, the existing row is updated and a version row is inserted.

### 9.11 Runtime Delivery

**On canvas session start:**
1. `GET /api/design-language?workspaceId=…` → returns `DesignToken[]` from Supabase
2. Stored in Zustand: `designLanguage: DesignToken[] | null`
3. Applied to all **currently mounted** artboards (Active and Near state per §3.6 viewport culling): for each mounted artboard, send `SET_DESIGN_TOKENS` with the full token map (`{ [token.key]: token.rawValue }`). **Far artboards** (iframe unmounted) receive the tokens on next activation — the canvas sends `SET_DESIGN_TOKENS` immediately after mounting an artboard's iframe during the culling transition (before any other message, including `SELECT_COMPONENT`), reading the current `designLanguage` from Zustand at that moment.

**On design language update (in settings):**
1. New tokens saved to Supabase
2. Zustand store updated in all open canvas tabs via a Supabase Realtime subscription initialised in `loadDesignLanguage()`:
```ts
supabase
  .channel('design_language_updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'design_languages',
    filter: `workspace_id=eq.${workspaceId}`,
  }, (payload) => {
    store.setDesignLanguage(payload.new.normalized as DesignToken[]);
  })
  .subscribe();
```
The subscription is torn down (`.unsubscribe()`) when the workspace changes or the canvas unmounts.
3. `SET_DESIGN_TOKENS` re-sent to all live artboards
4. Design panel re-runs deviation detection for current selection
5. Toast: "Design language updated — {N} tokens changed"

**Token resolver location:** Runs entirely in the canvas browser process. No server round-trip for resolution. `@originmain/design-language` exports `resolveValueToToken()` as a pure function — fast enough to run synchronously per panel render.

### 9.12 Version History

In Workspace Settings → Design Language:
- List of up to 10 previous versions with timestamp and token count
- "View diff" between any two versions: the diff is computed **client-side** by comparing two `DesignToken[]` arrays keyed on `token.key`. Added = key present in new version only; removed = key present in old version only; changed = key in both with a different `rawValue`. Displayed as a three-section table (Added / Removed / Changed) — no external library needed, this is a simple key-based diff. Color tokens show before/after color swatches inline. Spacing, radius, and shadow tokens show the before/after raw value as plain text.
- "Restore" button on any version: re-processes that version's `raw_json`, saves as a new version (does not delete current)

### 9.13 Agent Context

When an `IntentMessage` is built and `designLanguage` is loaded in Zustand:
- `intent.designLanguage.tokensUsed` = tokens found in the component's file by the AST indexer
- `intent.designLanguage.palette` = all tokens from the design language (key → rawValue)
- `intent.changes[n].tokenKey` = the token key if the target value maps to a token

This tells the agent: "instead of writing `border-radius: 12px`, write `border-radius: var(--radius-lg)`."

### 9.14 Files to Create / Change

| File | Change |
|---|---|
| `packages/renderer/src/protocol.ts` | Add `rootFontSizePx: number` to `ReadyMessage` |
| `packages/renderer/src/fiber-hook.ts` | Emit `rootFontSizePx: parseFloat(getComputedStyle(document.documentElement).fontSize)` in the `READY` post |
| `packages/app/src/store/canvas.ts` | Add `artboardRootFontSize: Record<string, number>`; populate on `READY` message receipt |
| `packages/design-language/src/parser.ts` | NEW — parses all 3 formats into `DesignToken[]` |
| `packages/design-language/src/resolver.ts` | NEW — `resolveValueToToken()`, color distance, unit normalization |
| `packages/design-language/src/validator.ts` | NEW — alias resolution, circular reference detection |
| `packages/design-language/src/index.ts` | Export all above |
| Note: `DesignInput.tsx` (raw CSS input, no token awareness) is built in Phase 2. It is upgraded to `TokenAwareInput.tsx` in Phase 6 when the token resolver is available. Phase 2 does not build TokenAwareInput. |
| `packages/app/src/components/inspector/TokenPicker.tsx` | NEW — token picker popover |
| `packages/app/src/app/settings/design-language/page.tsx` | NEW — upload UI, validation flow, version history |
| `packages/app/src/app/api/design-language/route.ts` | NEW — GET (load) / POST (save) |
| `packages/app/src/app/api/design-language/fetch/route.ts` | NEW — server-side proxy for URL fetch; validates HTTPS + non-private IP |
| `packages/app/src/store/canvas.ts` | Add `designLanguage: DesignToken[] \| null`, `loadDesignLanguage()` |
| `packages/app/src/store/canvas.ts` | Subscribe to Supabase realtime for design language changes |
| Database | Migration: `create-design-languages.sql` |
| Note: `DesignInput.tsx` (no token awareness) is built in Phase 2 (§5.12). Phase 6 builds `TokenAwareInput.tsx` as a wrapper around `DesignInput` that adds the token chip, picker, and deviation indicator. |

---

## 10. Complete Data Flow

```
── DEVELOPMENT MACHINE ────────────────────────────────────────────────────────

User's dev server     CLI Proxy      CLI Indexer    Originmain Canvas (browser)
    :3000               :4170            :4171
      │                   │                │                   │
      │  GET /dashboard   │                │                   │
      │◄──────────────────│                │                   │
      │  HTML + HMR       │                │                   │
      │──────────────────►│  inject        │                   │
      │                   │  fiber hook    │                   │
      │                   │  + index URL   │                   │
      │                   │───────────────────────────────────►│
      │                   │                │  full-scan on     │
      │                   │                │  startup          │
      │                   │                │◄ ─ ─ ─ ─ ─ ─ ─ ─ │ (canvas subscribes
      │                   │                │  INDEX_UPDATED     │  to SSE)
      │                   │                │──────────────────►│
      │                   │                │                   │
      │                   │                │  FIBER_TREE_UPDATE │
      │                   │◄───────────────────────────────────│
      │                   │                │  user clicks       │
      │                   │  COMPONENT_SELECTED + ELEMENT_STYLES│
      │                   │◄───────────────────────────────────│
      │                   │                │  panel renders,    │
      │                   │                │  deviation check   │
      │                   │                │  against tokens    │
      │                   │                │                   │
      │                   │                │  user adjusts      │
      │                   │  PATCH_ELEMENT_STYLE (DOM preview)  │
      │                   │───────────────────────────────────►│
      │                   │                │  "Preview Code"    │
      │                   │                │  GET /file?path=…  │
      │                   │                │◄──────────────────│
      │                   │                │  file content      │
      │                   │                │──────────────────►│
      │                   │                │  diff generated    │
      │                   │                │  Code tab shows    │
      │                   │                │  diff viewer       │
      │                   │                │                   │
      │                   │                │  "Send to Agent"   │

── CLOUD ──────────────────────────────────────────────────────────────────────

      │                   │                │  IntentMessage     │
      │                   │                │  → push_intent ───►│ Agent Bridge
      │                   │                │                   │  stores intent
      │                   │                │                   │  → INTENT_RECEIVED
      │                   │                │                   │──────────────────►
      │                   │                │                   │            Claude Code
      │                   │                │                   │         resolve_component?
      │                   │                │  GET /components?name=Card
      │                   │                │◄─────────────────────────────────────│
      │                   │                │  ComponentEntry                       │
      │                   │                │──────────────────────────────────────►│
      │                   │                │                   │         reads file
      │                   │                │                   │         applies diff
      │                   │                │                   │         saves file
      │  hot reload       │                │                   │
      │◄──────────────────│                │                   │
      │                   │  FIBER_TREE_UPDATE (post-edit)     │
      │                   │◄───────────────────────────────────│
      │                   │                │  update_diff_status(IMPLEMENTED)
      │                   │                │                   │◄─────────────────│
      │                   │                │  canvas shows ✓   │
```

---

## 11. Implementation Phases — Summary

| Phase | Name | Duration | Depends on | Milestone |
|---|---|---|---|---|
| 0 | Infinite Canvas & Multi-Artboard | 5–7 days | — | Multiple iframes on a pannable/zoomable canvas with device presets |
| 1 | `_debugSource` Extraction | 1–2 days | — (parallel with 0) | Inspector shows "used in src/app/page.tsx:34" |
| 2 | Figma-style Design Panel | 4–6 days | 0, 1 | Full 8-section panel with token-aware inputs (no tokens yet) |
| 3 | CLI AST Indexer | 3–4 days | — (parallel with 2) | `GET /components?name=Card` returns file + props; `GET /file` returns content |
| 4 | Code Diff Preview | 3–4 days | 2, 3 | User sees generated diff before sending; can edit it |
| 5 | Agent Bridge `push_intent` | 2–3 days | 4 | User sends intent; Claude Code receives it and opens the right file |
| 6 | Design Language System | 5–7 days | 2, 4, 5 | Upload JSON, see token chips in panel, deviation flags, agent writes `var(--token)` (agent context requires Phase 4 IntentMessage + Phase 5 Agent Bridge) |
| 7 | E2E Validation | 2 days | all | Full flow: select → edit → preview diff → send → agent applies → hot reload confirms |

**Total:** ~25–33 engineering days across all phases.

---

## 12. Resolved Decisions

| Decision | Resolution |
|---|---|
| Diff generation: client-side vs agent | **Client-side** — fast, works offline, deterministic for CSS changes |
| Canvas layout: auto-arrange vs freeform | **Both** — auto-arrange by default; user can drag to freeform; "Re-arrange all" to reset |
| Design panel: CSS-first vs props-first | **CSS-first** (Design tab always available) + Props tab when indexer is running |
| Component isolation artboards | **Yes** — CLI serves `/__om_isolation__` wrapper pages |
| Design language: V1 vs V2 | **V1 (Phase 6)** — it's what distinguishes this from DevTools; already half-wired in protocol |
| Intent confirm: auto-emit vs explicit | **Explicit** — "Preview Code Change" then "Send to Agent" — matches git mental model |
| Intent storage | **Supabase** `intent_diffs` table — integrates with existing diff lifecycle |
| Snapshot capture | **Before** on selection, **after** on confirm (100ms delay), both optional |
| `_debugSource` meaning | **Call site** (not definition file) — accurately named `callSite`; definition file from indexer |

---

## 13. Remaining Open Questions

### Q1: Tailwind class detection in diff generator
If the user's project uses Tailwind, a `border-radius` change means removing one class and adding another (e.g., `rounded` → `rounded-xl`). This requires Tailwind config awareness. Scope: Phase 4 can ship with a "Tailwind detected — diff is approximate" warning; full Tailwind class mapping is Phase 4.1.

### Q2: Multi-component selection
Figma supports selecting multiple elements simultaneously. For the canvas this is complex (each artboard is a separate iframe). Phase 0 ships with single-selection only. Multi-select within one artboard can come later.

### Q3: Undo after agent applies
Once the agent edits a file and hot-reload fires, the DOM preview change is "real". Should the canvas offer a "Revert intent" button that tells the agent to undo the edit (git checkout the file)? This requires a new Agent Bridge tool. Deferred to post-Phase 7.

### Q4: Design language sync from Figma Variables
Figma's Variables API can export the design language directly. A "Sync from Figma" button would call the Figma API and import variables in DTCG format. This is Phase 8+.

### Q5: Component prop defaults in AST indexer
Extracting default prop values requires evaluating expressions. Deferred to Phase 5+; Phase 3 extracts names and types only.

---

## 14. Non-Goals for This Iteration

- **Vue / Svelte support** — fiber hook is React-specific; DOM inspector is universal but no AST indexer equivalent
- **Production build support** — `_debugSource` and the fiber hook require dev builds
- **Multi-file edits** — one intent = one component change; refactors spanning multiple files are out of scope
- **Automatic code apply without agent** — canvas describes intent; an agent with file access applies it
- **Real-time collaboration** — multiple users editing the same canvas simultaneously; out of scope
- **Figma import / paste** — importing Figma designs as artboards; out of scope
