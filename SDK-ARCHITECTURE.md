# Originmain SDK Architecture
### From Proxy to SDK — System Design & Implementation Progress

> **Living document.** Updated every time a piece of this architecture is implemented.
> Supersedes `RENDERING-ARCHITECTURE.md` (proxy-era, now deprecated).
>
> Last updated: 2026-05-13

---

## Table of Contents

1. [Why We Moved Away From the Proxy](#1-why-we-moved-away-from-the-proxy)
2. [Target Architecture](#2-target-architecture)
3. [System Components](#3-system-components)
4. [Wire Protocol](#4-wire-protocol)
5. [Implementation Progress](#5-implementation-progress)
6. [Package Map](#6-package-map)
7. [Data Flow — Step by Step](#7-data-flow--step-by-step)
8. [Local Dev Problem & Tunnel Strategy](#8-local-dev-problem--tunnel-strategy)
9. [Edge Cases](#9-edge-cases)
10. [What Remains To Be Built](#10-what-remains-to-be-built)

---

## 1. Why We Moved Away From the Proxy

The original approach (`@originmain/cli`) ran a local HTTP reverse proxy that injected a
`<script>` tag into every HTML response. This failed in practice for four compounding reasons:

| Failure | Root Cause | Fatal? |
|---|---|---|
| Script never executed | React 19 `hydrateRoot(document, ...)` reconciles the entire `<head>` and removes any `<script>` tag not present in React's VDOM | ✅ Yes |
| `window.name` always empty | Chrome 88+ strips `window.name` on cross-origin iframe loads (Spectre mitigation) — the SDK used this as its artboard ID source | ✅ Yes |
| Inline script blocked | CSPs without `'unsafe-inline'` blocked the injected `<script>…</script>` content | ✅ Yes |
| Hook installed too late | `__REACT_DEVTOOLS_GLOBAL_HOOK__` must exist **before** React's module body evaluates. Injected scripts run after HTML parses — after React is already loaded | ✅ Yes |

**The only reliable fix**: the fiber hook must be installed by the app itself, not by an external injector. That means it ships as an npm package the developer imports **before React** in their app entry point.

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ORIGINMAIN CLOUD  (originmain.com)                                         │
│                                                                             │
│  ┌─────────────────────────────┐     ┌──────────────────────────────────┐  │
│  │  Canvas  (Next.js app)      │◄───►│  WebSocket Bridge                │  │
│  │  • Artboards / iframes      │     │  /api/sdk/[projectId]            │  │
│  │  • Inspector / Editor       │     │  • auth via SDK token            │  │
│  │  • File diff viewer         │     │  • routes messages to user       │  │
│  └─────────────────────────────┘     └──────────────────────────────────┘  │
│                                                        ▲                   │
└────────────────────────────────────────────────────────│───────────────────┘
                                                         │ WSS
                                                         │ (wss://originmain.com/api/sdk/[projectId])
┌────────────────────────────────────────────────────────│───────────────────┐
│  USER MACHINE  (localhost / staging)                    │                   │
│                                                         ▼                   │
│  ┌──────────────────────────┐     ┌────────────────────────────────────┐   │
│  │  Next.js dev server      │◄───►│  @originmain/dev  (SDK)            │   │
│  │  (next dev / Vercel)     │     │  • client runtime in browser       │   │
│  │                          │     │  • server runtime in Node          │   │
│  │                          │     │  • direct React fiber access       │   │
│  │  Components.tsx ◄────────┼─────┤  • file-write capability           │   │
│  │                          │     │  • opens WSS to cloud canvas       │   │
│  └──────────────────────────┘     └────────────────────────────────────┘   │
│                                                                             │
│  next.config.js — wrapped with @originmain/next plugin                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key invariant**: the fiber hook lives *inside* the user's app bundle.
No proxy, no injection, no external script — the user's `import '@originmain/live'`
is what instruments React.

---

## 3. System Components

### 3.1 `@originmain/live` (client runtime) — `packages/live-sdk`

The browser-side SDK. A side-effect import that:

- Installs `__REACT_DEVTOOLS_GLOBAL_HOOK__` **before React evaluates** (module-load time)
- Resolves the artboard ID from three sources in priority order:
  1. URL fragment: `location.hash` contains `#__om_artboard=<id>` ← primary, cross-origin safe
  2. `window.name`: starts with `om:` (same-origin iframes only)
  3. postMessage handshake: sends `{ __om_init_request: true }` to parent, awaits reply
- Runs the full postMessage protocol (see §4) once the artboard ID is known
- Is a **complete no-op** outside an Originmain artboard iframe (zero runtime cost in production)

### 3.2 `@originmain/next` (build plugin) — `packages/next`

A `withOriginmain(nextConfig)` wrapper for `next.config.ts` that:

- Prepends `@originmain/live` to every client-side webpack entry point
- Ensures the fiber hook import runs **before any other module** in the bundle
- Skips the server-side bundle (fiber hook is browser-only)
- Is idempotent (safe to wrap twice)
- Delegates to any existing `webpack` customisation in the user's config

### 3.3 `@originmain/dev` (full SDK) — `packages/dev` ❌ NOT BUILT YET

The full SDK intended for local development. Will combine:

- Everything in `@originmain/live` (client runtime, fiber hook)
- A **server runtime** that runs inside the Next.js dev server process
- A **WebSocket client** that connects outbound to the cloud canvas bridge
- **File-write capability**: receives design panel edits from the canvas and applies them to source files (`.tsx`, `.ts`, CSS modules)

### 3.4 WebSocket Bridge — `packages/app/src/app/api/sdk/[projectId]/` ❌ NOT BUILT YET

A Next.js API route on the cloud canvas that:

- Accepts an inbound WSS connection from `@originmain/dev`
- Authenticates via a project-scoped SDK token (issued in project settings)
- Routes messages bidirectionally:
  - SDK → Canvas: `FIBER_TREE_UPDATE`, `ELEMENT_STYLES`, `ROUTES_DISCOVERED`, etc.
  - Canvas → SDK: `PATCH_ELEMENT_STYLE`, `REQUEST_ELEMENT_STYLES`, `CAPTURE_SNAPSHOT`, etc.
- Maintains one WebSocket connection per active project session

### 3.5 Canvas (Next.js app) — `packages/app`

Originmain's cloud editor. Current transport: **postMessage via iframe**.
Future transport: **WebSocket via bridge** (for `@originmain/dev` local dev).

Key components:
- `LiveArtboard.tsx` — manages the `<iframe>`, postMessage listener, message dispatch
- `DesignTab.tsx` — design property sections (Frame, Layout, Fill, Typography, etc.)
- `Inspector.tsx` — tab container (Design / Props / Code / Diff / Graph)
- `Artboard.tsx` — artboard frame, selection overlay, static-page detection
- `Canvas.tsx` — infinite canvas, zoom/pan, artboard layout, onboarding overlay

---

## 4. Wire Protocol

Defined in `packages/renderer/src/protocol.ts`. Both the postMessage transport
(current) and the WebSocket transport (planned) use the same message shapes.

### 4.1 Canvas → App (Host → Renderer)

| Message | Payload | Purpose |
|---|---|---|
| `SET_DESIGN_TOKENS` | `{ tokens: Record<string, string> }` | Push CSS custom property values |
| `NAVIGATE` | `{ path: string }` | SPA navigation inside the iframe |
| `SELECT_COMPONENT` | `{ nodeId: string }` | Show highlight ring on component |
| `DESELECT` | — | Remove highlight ring |
| `REQUEST_ELEMENT_STYLES` | `{ nodeId: string }` | Ask for computed CSS properties |
| `PATCH_ELEMENT_STYLE` | `{ nodeId, property, value }` | Apply one inline CSS override |
| `PATCH_CHILDREN_STYLE` | `{ parentNodeId, selector, property, value }` | Patch CSS on all matching children |
| `REMOVE_ELEMENT` | `{ nodeId: string }` | Set `display:none` on element |
| `CAPTURE_THUMBNAIL` | — | Capture full-page JPEG via html2canvas |
| `CAPTURE_SNAPSHOT` | `{ nodeId: string }` | Capture selected element PNG |
| `CANCEL_SNAPSHOT` | — | Abort in-flight snapshot |

### 4.2 App → Canvas (Renderer → Host)

| Message | Payload | Purpose |
|---|---|---|
| `READY` | `{ rootFontSizePx?: number }` | Hook active, React detected |
| `FIBER_TREE_UPDATE` | `{ root: FiberNode }` | Full serialized component tree |
| `COMPONENT_SELECTED` | `{ nodeId, rect }` | User clicked a component |
| `COMPONENT_DESELECTED` | — | User clicked empty space |
| `ELEMENT_STYLES` | `{ nodeId, styles, hasDirectText, hasParagraphChildren }` | Computed CSS response |
| `ROUTES_DISCOVERED` | `{ routes: Array<{ path, label }> }` | App's navigation routes |
| `THUMBNAIL_READY` | `{ dataUrl: string \| null }` | JPEG data URL or null |
| `SNAPSHOT_READY` | `{ dataUrl: string \| null, nodeId: string }` | PNG data URL or null |
| `ERROR` | `{ message: string }` | Hook or serialization error |

### 4.3 Envelope Format (postMessage)

```ts
// Canvas → App
{ source: 'originmain-host', artboardId: string, message: HostMessage }

// App → Canvas
{ source: 'originmain-renderer', artboardId: string, message: RendererMessage }
```

### 4.4 Artboard ID Resolution (how the SDK finds its artboard)

The canvas appends the artboard ID to the iframe's `src` as a URL fragment:

```tsx
// LiveArtboard.tsx
src={url + '#__om_artboard=' + encodeURIComponent(id)}
```

The SDK reads it in priority order:
```
1. location.hash  →  /__om_artboard=abc123/   (primary, cross-origin safe)
2. window.name    →  "om:abc123"              (same-origin iframes)
3. postMessage handshake                      (async fallback, 10s timeout)
```

---

## 5. Implementation Progress

### ✅ Done

| Component | File(s) | Notes |
|---|---|---|
| `@originmain/live` client runtime | `packages/live-sdk/src/hook.ts` | Full rewrite. URL fragment guard. Full protocol parity. html2canvas support. |
| `@originmain/live` build step | `packages/live-sdk/build.mjs` | esbuild → `dist/index.js` (9.4kb browser ESM bundle, minified). |
| `@originmain/next` build plugin | `packages/next/src/index.ts` | `withOriginmain()` — webpack entry prepend. Idempotent. |
| `@originmain/next` build step | `packages/next/build.mjs` | esbuild → ESM + CJS; tsc → `dist/index.d.ts` type declarations. |
| Root `sdk:build` script | `package.json` | `pnpm sdk:build` builds both SDK packages in order. |
| SDK token auth | `packages/app/src/lib/sdk-auth.ts` | `issueSdkToken()` / `verifySdkToken()` — HMAC-SHA256, 90-day TTL, project-scoped. |
| SDK bridge registry | `packages/app/src/lib/sdk-bridge-registry.ts` | In-process SSE sink Map — pushToCanvas / pushToSdk. |
| SDK bridge fiber events route | `packages/app/src/app/api/sdk/[projectId]/route.ts` | GET (canvas SSE) + POST (SDK pushes fiber data). |
| SDK bridge commands route | `packages/app/src/app/api/sdk/[projectId]/commands/route.ts` | GET (SDK SSE) + POST (canvas pushes commands). |
| SDK token issuance route | `packages/app/src/app/api/sdk/token/route.ts` | POST: canvas issues a project-scoped token for `@originmain/dev`. |
| LiveArtboard postMessage handshake | `packages/app/src/components/canvas/LiveArtboard.tsx` | Responds to `__om_init_request` from SDK |
| LiveArtboard URL fragment injection | `packages/app/src/components/canvas/LiveArtboard.tsx` | Appends `#__om_artboard=<id>` to all iframe src URLs |
| Style refresh after design panel edit | `packages/app/src/components/canvas/LiveArtboard.tsx` | 120ms debounced `REQUEST_ELEMENT_STYLES` after queue drains |
| Design panel → history tracking | `packages/app/src/components/inspector/DesignTab.tsx` | `pushEdit()` on every `patch()` call — feeds Diff tab |
| Design panel → optimistic styles | `packages/app/src/components/inspector/DesignTab.tsx` | `setComponentStyles()` optimistic update — inputs reflect change immediately |
| Canvas onboarding UI | `packages/app/src/components/canvas/Canvas.tsx` | Updated from proxy instructions to SDK install instructions |
| Static page banner | `packages/app/src/components/canvas/Artboard.tsx` | Now says "add `import '@originmain/live'`" instead of confusing message |
| `tsconfig.base.json` path alias | `tsconfig.base.json` | `@originmain/next` added to paths |

### 🚧 In Progress / Partially Done

| Component | File(s) | Status | Blocker |
|---|---|---|---|
| `@originmain/live` publishing | `packages/live-sdk/package.json` | Build complete. `"private": false`. **Not yet `npm publish`-ed** | Run `pnpm sdk:build && cd packages/live-sdk && npm publish` |
| `@originmain/next` publishing | `packages/next/package.json` | Build complete. `"private": false`. **Not yet `npm publish`-ed** | Same (depends on live being published first) |
| CLI proxy deprecation | `packages/cli/` | Still exists and still works | Can delete once SDK is published and users migrate |
| SDK bridge persistent pub/sub | `packages/app/src/lib/sdk-bridge-registry.ts` | In-process Maps (works for local dev / single server) | For Vercel serverless: replace with Supabase Realtime or Redis |

### ❌ Not Built

| Component | Target File(s) | Priority | Depends On |
|---|---|---|---|
| WebSocket bridge API route | `packages/app/src/app/api/sdk/[projectId]/route.ts` | HIGH | — |
| `@originmain/dev` package | `packages/dev/` | HIGH | WebSocket bridge |
| SDK server runtime (Node.js) | `packages/dev/src/server.ts` | HIGH | WebSocket bridge |
| File-write capability | `packages/dev/src/file-writer.ts` | HIGH | Server runtime |
| SDK token issuance in canvas | `packages/app/src/app/api/sdk/token/route.ts` | HIGH | WebSocket bridge |
| Local dev tunnel (localhost → WSS) | TBD | MEDIUM | `@originmain/dev` |
| `IsolationFrame.tsx` SDK migration | `packages/app/src/components/canvas/IsolationFrame.tsx` | LOW | `@originmain/dev` |

---

## 6. Package Map

```
packages/
├── app/               @originmain/app      — Cloud canvas (Next.js, Vercel)
├── live-sdk/          @originmain/live     — Client SDK: browser fiber hook ✅ DONE
├── next/              @originmain/next     — Next.js build plugin ✅ DONE
├── dev/               @originmain/dev      — Full SDK (client + server) ❌ NOT BUILT
├── renderer/          @originmain/renderer — Protocol types, message shapes
├── cli/               @originmain/cli      — Legacy proxy (deprecated, not deleted yet)
├── diff-engine/       @originmain/diff-engine
├── design-language/   @originmain/design-language
├── agent-bridge/      @originmain/agent-bridge
├── ai-layer/          @originmain/ai-layer
├── platform/          @originmain/platform
├── multiplayer/       @originmain/multiplayer
├── origin-graph/      @originmain/origin-graph
├── ui/                @originmain/ui
└── e2e/               (test suite)
```

---

## 7. Data Flow — Step by Step

### 7.1 Current Flow (postMessage via iframe)

```
1.  User adds @originmain/live to their Next.js app
2.  User wraps next.config.ts with withOriginmain()
3.  User deploys to Vercel — @originmain/live is in the bundle

4.  Canvas: user pastes Vercel URL → artboard created in DB
5.  Canvas: LiveArtboard renders <iframe src="https://app.vercel.app/route#__om_artboard=abc123">
6.  Browser: iframe loads app from Vercel

7.  App bundle: @originmain/live runs (module-level side effect, before React)
    → installs __REACT_DEVTOOLS_GLOBAL_HOOK__
    → reads location.hash → finds __om_artboard=abc123
    → calls startMainLoop("abc123")

8.  React evaluates → sees hook → registers onCommitFiberRoot

9.  App renders → React commits
    → onCommitFiberRoot fires
    → SDK serializes fiber tree
    → postMessage({ source: 'originmain-renderer', artboardId: 'abc123',
                    message: { type: 'FIBER_TREE_UPDATE', root: ... } })

10. Canvas: LiveArtboard.handleMessage receives FIBER_TREE_UPDATE
    → setFiberRoot(artboardId, root) [Zustand]
    → SelectionOverlay renders component hit-test overlay
    → Inspector shows component tree (Graph tab)

11. User clicks a component in the iframe
    → SDK: click handler → getFiberKey(el) → walk fiber.return chain
    → postMessage COMPONENT_SELECTED { nodeId, rect }

12. Canvas: receives COMPONENT_SELECTED
    → selectComponent(nodeId) [Zustand]
    → LiveArtboard sends REQUEST_ELEMENT_STYLES { nodeId }

13. SDK: respondWithStyles() → getComputedStyle(el) → all CSS properties
    → postMessage ELEMENT_STYLES { nodeId, styles, hasDirectText, hasParagraphChildren }

14. Canvas: setComponentStyles(styles) [Zustand]
    → DesignTab re-renders with actual computed values
    → Frame/Layout/Fill/Typography sections show live data

15. User edits width in Frame section: 200px → 250px
    [DesignTab.patch('width', '250px')]
    → patchStyleEdit(artboardId, nodeId, 'width', '250px') → styleEditQueue
    → setComponentStyles({ ...styles, width: '250px' })   → optimistic panel update
    → pushEdit({ key: 'width', before: '200px', after: '250px', ... }) → history

16. LiveArtboard: styleEditQueue effect drains
    → postMessage PATCH_ELEMENT_STYLE { nodeId, property: 'width', value: '250px' }
    → starts 120ms debounce timer

17. SDK: patchElementStyle(nodeId, 'width', '250px')
    → el.style.setProperty('width', '250px')
    → iframe visually updates ✅

18. 120ms later: LiveArtboard sends REQUEST_ELEMENT_STYLES
    → SDK: getComputedStyle now returns '250px' (inline style overrides)
    → ELEMENT_STYLES response → panel shows accurate computed value

19. Diff tab: pendingChanges = [{ key: 'width', before: '200px', after: '250px' }]
    → "Export diff →" button active
    → Code tab shows generated file patch
    → "Send to Agent" sends diff to AI for code application
```

### 7.2 Target Flow (WebSocket — not built yet)

Same as above, except steps 5–9 use WebSocket instead of postMessage:

```
5.  Canvas: LiveArtboard connects to wss://originmain.com/api/sdk/abc123
6.  @originmain/dev (server runtime): connects to same WSS URL with SDK token
7.  Bridge authenticates token, pairs the two connections
8.  All messages flow through the bridge instead of postMessage
    → This unlocks local dev (no Vercel deploy required)
    → This enables file-write (SDK has Node.js fs access)
```

---

## 8. Local Dev Problem & Tunnel Strategy

### The Problem

The cloud canvas (`https://originmain.com`) is served over HTTPS. Browsers
enforce **mixed content policy**: an HTTPS page cannot iframe `http://localhost:3000`.
This means the current SDK approach (iframe + postMessage) **only works for deployed apps**
(Vercel, Netlify, etc.) — not for local development.

### Current Workaround (v1)

Users must deploy to Vercel (or any HTTPS host) to use the canvas.
Vercel's preview deployments are free and instant (`vercel deploy --prod` is optional).

### Planned Solution (`@originmain/dev` + WebSocket bridge)

When the WebSocket bridge exists:
- `@originmain/dev` runs a Node.js server alongside `next dev`
- It connects **outbound** from the user's machine via WSS to the canvas bridge
- Outbound WSS from localhost → cloud is always allowed (no mixed content issue)
- The canvas receives fiber data via the bridge, not via the iframe
- The iframe can be replaced with a screenshot stream or kept pointing to a tunnel URL

### Tunnel Options (if iframe is still needed for visual rendering)

| Option | Effort | Notes |
|---|---|---|
| Vercel deploy (v1 recommendation) | Lowest | Works today. No extra tooling. |
| `cloudflared tunnel` (user-run) | Low | `npx cloudflared tunnel --url http://localhost:3000` |
| Originmain-managed tunnel | High | Requires Originmain to run tunnel infrastructure |

---

## 9. Edge Cases

### 9.1 React DevTools Coexistence

React DevTools extension installs its own `__REACT_DEVTOOLS_GLOBAL_HOOK__` first.
The SDK detects the existing hook and wraps `onCommitFiberRoot` — both DevTools and
Originmain receive fiber commits. Neither overwrites the other.

### 9.2 HMR (Hot Module Replacement)

When webpack/turbopack pushes a hot update, React re-renders affected components.
`onCommitFiberRoot` fires again → SDK sends a new `FIBER_TREE_UPDATE` → canvas updates.
The artboard ID is stable across hot updates (URL fragment persists).

### 9.3 SPA Navigation

SPA routers change the URL without a full page reload. React re-renders.
`onCommitFiberRoot` fires → new `FIBER_TREE_UPDATE`. Route discovery re-runs via
a `popstate` listener. The SDK sends updated `ROUTES_DISCOVERED`.

### 9.4 React 19 Server Components

Server Components don't produce fiber nodes in the client tree — they're rendered
to RSC payload and hydrated as static DOM. The SDK correctly skips these
(they have no `type` function). Only client components appear in the tree.

### 9.5 Non-React Pages (Static HTML)

If the app serves a page with no React (e.g., a static landing page),
`onCommitFiberRoot` never fires. The `READY` message is still sent.
After 8 seconds with no `FIBER_TREE_UPDATE`, `LiveArtboard` calls
`onStaticPageDetected()` → the "No React detected" banner appears.

### 9.6 Multiple Artboards, Same App

Multiple artboards can iframe the same app at different routes. Each gets a
unique `#__om_artboard=<id>` in its URL. The SDK is a module singleton — it runs
once per page load — and binds to the single artboard ID from the URL fragment.
Each iframe is a separate browsing context with its own SDK instance.

### 9.7 CSP (`script-src 'self'`)

Since the SDK ships in the app's own bundle (not injected externally), CSP
`script-src 'self'` does not block it. The SDK is part of the same origin as the app.

---

## 10. What Remains To Be Built

Priority order for next implementation sprint:

### Priority 1 — Publish packages (unblocks users) ✅ BUILD COMPLETE

- [x] Add esbuild build step for `@originmain/live` → `packages/live-sdk/build.mjs`
- [x] Add esbuild + tsc build step for `@originmain/next` → `packages/next/build.mjs`
- [x] Update exports in both `package.json` files to point to `dist/`
- [x] Add `@originmain/live` as workspace dependency of `@originmain/next`
- [x] Root `pnpm sdk:build` script for one-command build
- [ ] `npm publish` `@originmain/live` — ready to publish, command: `cd packages/live-sdk && npm publish`
- [ ] `npm publish` `@originmain/next` — depends on live being published first

### Priority 2 — WebSocket Bridge (unblocks local dev) ✅ DONE (SSE transport)

> Implemented as SSE (bidirectional via two channels) rather than raw WebSocket
> to be compatible with Next.js App Router and Vercel's serverless runtime.
> Functionally equivalent — real WebSocket can replace SSE in a future iteration
> without changing the client API.

- [x] SDK token auth (`packages/app/src/lib/sdk-auth.ts`)
- [x] In-process SSE registry (`packages/app/src/lib/sdk-bridge-registry.ts`)
- [x] Fiber events channel: `GET` (canvas SSE) + `POST` (SDK → bridge) — `packages/app/src/app/api/sdk/[projectId]/route.ts`
- [x] Commands channel: `GET` (SDK SSE) + `POST` (canvas → bridge) — `packages/app/src/app/api/sdk/[projectId]/commands/route.ts`
- [x] Token issuance: `POST /api/sdk/token` — `packages/app/src/app/api/sdk/token/route.ts`

### Priority 3 — `@originmain/dev` package (file-write, local dev)

- [ ] `packages/dev/src/client.ts` — re-export `@originmain/live`
- [ ] `packages/dev/src/server.ts` — Node.js WebSocket client, connects to bridge
- [ ] `packages/dev/src/file-writer.ts` — applies design panel patches to source files
  - Parse `PATCH_ELEMENT_STYLE` messages → locate source file via `callSite`
  - Rewrite Tailwind classes / CSS modules / inline styles
- [ ] `packages/next/src/index.ts` — extend `withOriginmain()` to also start the server runtime

### Priority 4 — SDK token issuance

- [ ] Project settings UI: "Generate SDK token" button
- [ ] `packages/app/src/app/api/sdk/token/route.ts` — create/rotate tokens
- [ ] Store tokens in Supabase (scoped to project, revocable)

### Priority 5 — IsolationFrame migration

- [ ] Migrate `IsolationFrame.tsx` from proxy URL to SDK-based approach
  - Currently still requires the CLI proxy to serve `/__om_isolation__/*`

---

*Document owner: engineering*
*Last updated: 2026-05-13*
*Next review: when WebSocket bridge is implemented*
