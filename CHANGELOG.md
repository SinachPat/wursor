# Changelog

All notable changes to Originmain are documented here.  
Format: [version] — date — summary

---

## [Unreleased]

### Added
- **Figma-style Design panel** — Inspector Design tab rebuilt from scratch with semantic Figma-parity layout:
  - **Dimensions block** — W/H stepper inputs always at top, arrow-key ±1 (Shift ±10) while preserving CSS unit
  - **Fill** — colour-picker swatch (opens native `<input type="color">`) + hex text input + alpha %; hidden when background is transparent
  - **Text Color** — same colour-swatch treatment for `color` property
  - **Typography** — font family full-width text input, compact row of Size / Weight / Line-H, letter-spacing + text-align toggle group (L/C/R/J icon buttons)
  - **Layout** — Display select, flex-direction toggle (→↓←↑), Gap, Align/Justify selects, 4-corner padding grid (↑→↓←)
  - **Appearance** — Radius + Opacity side-by-side, border colour/width (shown only when border exists), box-shadow text input
  - All inputs fire `patchStyleEdit` on every change — live preview in the iframe with zero latency
- **Live resize handles** — SelectionOverlay handles call `patchStyleEdit` on every `mousemove` during drag, giving real-time iframe feedback
- **8 resize handles** — 4 corners (nwse/nesw cursors) + 4 edge midpoints (ns/ew cursors), matching Figma's control points
- **Delete component** — "✕ delete" button in the selection label bar + Delete/Backspace keyboard shortcut; sends `REMOVE_ELEMENT` to iframe (sets `display: none`, non-destructive)
- **Auto multi-screen layout** — When a live artboard connects, `ROUTES_DISCOVERED` message auto-creates new artboards for every undiscovered route in a horizontal row (80 px gaps). Designers see all app screens on the canvas without manual setup.
- **Route discovery in hook** — `discoverRoutes()` scans `<a href>` DOM links + fiber tree for Link/NavLink/RouterLink components; fires on READY and on `popstate`
- **Live style patching** — `PATCH_ELEMENT_STYLE` protocol message applies an inline-style override to a fiber node's DOM element in real time. Non-destructive — source files are unchanged; changes are exportable as diffs.
- **Element style inspection** — `REQUEST_ELEMENT_STYLES` / `ELEMENT_STYLES` protocol round-trip: hook reads `window.getComputedStyle()` for ~30 CSS properties and posts them back to the host.
- **Route-aware artboards** — Each artboard has an optional `route` field (e.g. `/dashboard`). The iframe src becomes `baseUrl + route`. Route is editable inline in the Props tab.
- **On-canvas onboarding** — The empty canvas shows a 3-step guide (Press A → run CLI → paste proxy URL) including the exact CLI command.

### Changed
- Inspector default tab changed from **Props** to **Design** — mirrors Figma's inspect-first workflow.
- Tab order: **Design → Props → Diff → Graph**.
- `selectComponent` store action clears `selectedComponentStyles` on every selection change.
- `selectArtboard` store action clears both component selection and styles.

### Fixed
- HTTP 204 with body in `/api/design-language` route — now returns 200.
- `tools/list` MCP endpoint now includes `inputSchema` per spec.
- `ProjectSettingsForm` role check used wrong constant (`'DEVELOPER'` → `'ENGINEER'`).
- Removed dead `INJECT_FIBER_HOOK` message type from renderer protocol.
- Zustand v5 compatibility: replaced `subscribe(selector, listener)` (removed in v5) with `useEffect` + selector hook.

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
