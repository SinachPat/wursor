# Changelog

All notable changes to Originmain are documented here.  
Format: [version] — date — summary

---

## [Unreleased]

### Added
- **Design tab** — New first-position inspector tab (Design / Props / Diff / Graph). When a component is selected in a live artboard, computed CSS properties appear grouped into Typography, Layout, and Visual sections. Every property is inline-editable: changes apply immediately to the live iframe with zero source-code modifications.
- **Live style patching** — `PATCH_ELEMENT_STYLE` protocol message applies an inline-style override to a fiber node's DOM element in real time. Non-destructive — source files are unchanged; changes are exportable as diffs.
- **Element style inspection** — `REQUEST_ELEMENT_STYLES` / `ELEMENT_STYLES` protocol round-trip: the CLI proxy hook reads `window.getComputedStyle()` for ~30 curated CSS properties (typography, layout, visual) and posts them back to the host.
- **Route-aware artboards** — Each artboard now has an optional `route` field (e.g. `/dashboard`). The iframe src becomes `baseUrl + route`, letting designers have one artboard per screen with a single shared proxy URL. Route is editable inline in the Props tab.
- **Multi-screen workflow** — Create one artboard per page, assign routes, get a full-app design view on the canvas. The `CanvasArtboard` type and `useArtboards` hook now surface the `route` field.
- **On-canvas onboarding** — The empty canvas now shows a 3-step guide (Press A → run CLI → paste proxy URL) including the exact CLI command, replacing the single-line hint.
- **@originmain/cli v0.0.3** — Published to npm. README covers quick start, CLI flags, programmatic API (`startProxy`, `injectFiberHook`), and architecture notes.
- **Artboard creation fixed** — Removed the `e.target === e.currentTarget` guard that permanently broke artboard creation because the canvas transform layer always intercepts pointer events.
- **Artboard drag fixed** — Stale closure bug in `onUp`: final drag position now reads from a mutable ref (`dragOffsetRef`) rather than captured state, so artboards land where the user dropped them.

### Changed
- Inspector default tab changed from **Props** to **Design** — mirrors Figma's inspect-first workflow.
- `selectComponent` store action now clears `selectedComponentStyles` on every selection change so stale data never bleeds into a new selection.
- `selectArtboard` store action clears both component selection and styles.
- Tab order: **Design → Props → Diff → Graph** (was Props → Diff → Graph).

### Fixed
- HTTP 204 with body in `/api/design-language` route (RFC 7230 §3.3 violation) — now returns 200 with `null` body.
- `tools/list` MCP endpoint now includes `inputSchema` per spec so IDE clients can construct valid calls without out-of-band documentation.
- `ProjectSettingsForm` role check used the wrong constant (`'DEVELOPER'` → `'ENGINEER'`); delete-confirm compared against mutable `name` state instead of the original `initialName`.
- Removed dead `INJECT_FIBER_HOOK` message type from the renderer protocol.

---

## [0.0.3] — 2026-04-28
- CLI proxy published to npm as `@originmain/cli`
- README added covering quick start, CLI flags, programmatic API

## [0.0.2] — 2026-04-27
- Live rendering foundation: fiber hook injection, X-Frame-Options stripping, WebSocket passthrough
- Canvas artboard system: create, drag, rename, delete
- Inspector: Props / Diff / Graph tabs
- Live artboard iframe with bidirectional postMessage protocol
- Click-to-select components in live render with blue highlight ring
- Design token injection via CSS custom properties
- Drift report generation via AI layer
- Diff export with AI-generated summaries
- MCP agent bridge with JSON-RPC 2.0 workspace token auth
- Origin Graph query tab in inspector
