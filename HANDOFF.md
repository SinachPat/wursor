# Originmain — Implementation Handoff

> Living document. Updated after each layer is completed or substantially advanced.
> Reference: `Originmain-Implementation-Guide-v1_0.md` (v1.0, April 2026)

---

## Layer Status Summary

| Layer | Name                        | Status       | Notes                                                            |
|-------|-----------------------------|--------------|------------------------------------------------------------------|
| 0     | Infrastructure & DevOps     | ⏳ Deferred  | Skipped for now per plan                                         |
| 1     | Canvas UI Shell             | ✅ Complete  | ArtboardTree, CodebaseFileTree, CodeDiffPanel                    |
| 2     | Live Rendering Engine       | ✅ Revised   | CLI proxy + Live SDK; see RENDERING-ARCHITECTURE.md              |
| 3     | Visual Editing & Diff Engine| ✅ Complete  | Diff engine (49 tests), SelectionOverlay, history store          |
| 4     | Origin Graph & Data Store   | ✅ Complete  | 3 migrations, RLS, Zod types, query helpers                      |
| 5     | Design Language Runtime     | ✅ Complete  | New package, JSON Schema, Zod validator, token pipeline          |
| 6     | AI Completion Layer         | ✅ Complete  | Gateway, 5 features, prompt caching, Claude Opus 4.7             |
| 7     | Agent Bridge (MCP)          | ✅ Complete  | 5 tools, HMAC auth, rate limiter, Cursor + Claude Code adapters  |
| 8     | Multi-Origin Ingestion      | ✅ Complete  | OriginIngester interface + 4 connectors                          |
| 9     | Multiplayer & Presence      | ✅ Foundation | Room schema, adapter interface, cursor palette — no app integration yet |
| 10    | Platform & Extensions       | ✅ Foundation | Plugin API, enterprise types (SSO/SCIM/audit), white-label theming |

---

## Layer 1 — Canvas UI Shell ✅

**Completed:** 2026-04-25

### What was built

#### Diff Engine integration (pre-Layer 1)
- **`packages/diff-engine/src/schemas.ts`** — Zod schemas for `ComponentSnapshot` and `ComponentDiff`
- **`packages/diff-engine/src/engine.ts`** — Core diff computation, Myers LCS, recursive child diffing
- **`packages/diff-engine/src/myers.ts`** — Myers longest-common-subsequence algorithm
- **`packages/diff-engine/src/patch.ts`** — Unified patch generation
- **`packages/diff-engine/src/serialize.ts`** — Snapshot serialization to text
- **49 tests, ~88% coverage, all passing**

#### Canvas UI Shell components (NEW — additive only)
- **`packages/app/src/components/navigator/ArtboardTree.tsx`** — Fluent 2 `Tree`/`TreeItem`/`TreeItemLayout` for workspace artboard hierarchy
- **`packages/app/src/components/codebase/CodebaseFileTree.tsx`** — `@pierre/trees` standalone codebase file browser (separate from ArtboardNavigator.tsx)
- **`packages/app/src/components/diff/CodeDiffPanel.tsx`** — `@pierre/diffs` `PatchDiff` renderer with unified diff patch string input

### Critical invariants
- `ArtboardNavigator.tsx` must **never** be reversed or have its `@pierre/trees` FileTree removed
- `ArtboardTree.tsx` and `CodebaseFileTree.tsx` are **separate** components
- All new components are **additive**

---

## Layer 2 — Live Rendering Engine ✅ (Revised 2026-04-29)

**Original:** 2026-04-25 — postMessage protocol, fiber hook, MF config, LiveArtboard iframe
**Revised:** 2026-04-29 — Replaced non-functional cross-origin injection with two working modes

> See **`RENDERING-ARCHITECTURE.md`** for the full design document.

### Why the original approach was non-functional
The original `LiveArtboard.tsx` tried `iframe.contentDocument.createElement('script')` to inject the fiber hook. This fails for cross-origin iframes (the browser blocks DOM access), and the READY handshake had a circular dependency. See `RENDERING-ARCHITECTURE.md` §2 for details.

### Two rendering modes (both use the same postMessage protocol)

#### Mode A — CLI Proxy (`@originmain/cli`)
For active local development. User runs `npx @originmain/cli dev --target http://localhost:3000` and enters the proxy URL (`http://localhost:4170`) into the artboard.

The proxy:
1. Strips `X-Frame-Options` / CSP headers from responses
2. Injects the fiber hook `<script>` into HTML responses (before React loads)
3. Passes WebSocket upgrades through for HMR

#### Mode B — Live SDK (`@originmain/live`)
For preview deployments / GitHub integration. User installs `@originmain/live` in their app and imports it before React:
```ts
import '@originmain/live'; // must be first import
import React from 'react';
```

The SDK installs `__REACT_DEVTOOLS_GLOBAL_HOOK__` at module evaluation time and only activates inside an Originmain iframe (detected by `window.name` prefix `om:`).

### Files created / modified
- **`packages/renderer/src/fiber-hook.ts`** — Added `buildProxyFiberHookScript()`: generic fiber hook that reads `window.name` for artboard ID (used by both CLI proxy and SDK). Original `buildFiberHookScript(id)` preserved but deprecated.
- **`packages/cli/`** (NEW) — CLI package:
  - `src/cli.ts` — CLI entry: `originmain dev --target <url> [--port <n>]`
  - `src/proxy.ts` — HTTP reverse proxy: header stripping, HTML injection, WebSocket passthrough
  - `src/inject.ts` — HTML injection logic: inserts `<script>` after `<head>`
- **`packages/live-sdk/`** (NEW) — SDK package:
  - `src/hook.ts` — Self-contained fiber hook: installs `__REACT_DEVTOOLS_GLOBAL_HOOK__`, serializes fiber tree, sends postMessage to parent
  - `src/index.ts` — Side-effect re-export
- **`packages/app/src/components/canvas/LiveArtboard.tsx`** — Removed broken `injectFiberHook()`. Added `name={`om:${id}`}` to iframe. READY handler no longer attempts injection.
- **`packages/app/src/components/canvas/Artboard.tsx`** — Updated `EmptyArtboardContent` to show proxy URL instructions and correct placeholder.
- **`packages/integrations/src/connectors/github.ts`** — Fixed `renderUrl`: now accepts `deploymentUrl` option (from deployment_status webhook) instead of using `pr.html_url` (which is un-iframeable).

### Key design decisions
- **Artboard ID via `window.name`**: `LiveArtboard` sets `name="om:{id}"` on the iframe. The fiber hook reads `window.name` to tag postMessage envelopes. Persists across SPA navigation, supports multiple artboards on one proxy.
- **No WebSocket relay needed**: postMessage works cross-origin; the CLI proxy makes the iframe renderable by stripping blocking headers. No additional relay infrastructure required.
- **Zero-dep SDK**: `@originmain/live` has no dependencies; it's a ~2 KB side-effect import that's a no-op outside Originmain iframes.

---

## Layer 3 — Visual Editing & Diff Engine ✅

**Completed:** 2026-04-25

### Files created
- **`packages/app/src/store/history.ts`** — Zustand store: `stacks: Record<string, {past, future}>`, `pushEdit()`, `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clearHistory()`. Max 100 entries per artboard.
- **`packages/app/src/components/canvas/SelectionOverlay.tsx`** — Transparent `cursor: crosshair` layer; `hitTestFiber()` depth-first Fiber tree search by mouse position + `domRect`; `SelectionHandles` corner drag-to-resize; commits `PropChange[]` via `pushEdit()`

---

## Layer 4 — Origin Graph & Data Store ✅

**Completed:** 2026-04-25

### Files created
- **`packages/origin-graph/migrations/001_initial_schema.sql`** — 5 enum types, 7 tables (workspaces, artboards, origins, intent_diffs, agent_sessions, design_language_files, team_members), FK indexes, `set_updated_at()` trigger
- **`packages/origin-graph/migrations/002_artboard_ancestry.sql`** — Recursive CTE materialized view `artboard_ancestry(artboard_id, ancestor_id, depth)`, unique index for `CONCURRENTLY` refresh, trigger on artboard insert/update
- **`packages/origin-graph/migrations/003_rls_policies.sql`** — `is_workspace_member(ws_id UUID)` SECURITY DEFINER function, SELECT/INSERT/UPDATE/DELETE policies on all 7 tables
- **`packages/origin-graph/src/types.ts`** — Zod schemas for all 7 tables + insert types
- **`packages/origin-graph/src/queries.ts`** — `DbClient` generic interface + 13 query helpers (no hard Supabase dependency)

---

## Layer 5 — Design Language Runtime ✅

**Completed:** 2026-04-25

### New package: `packages/design-language`

- **`src/schema.ts`** — `DesignLanguageFileBodySchema` with `tokens`, `components`, `screens`, `voice`, `accessibility` subsections
- **`src/validator.ts`** — `validateDesignLanguageFile()` returns `ValidationSuccess | ValidationFailure`; `checkComponentConstraints()` for real-time per-edit validation
- **`src/tokens.ts`** — `extractColorTokens()`, `tokensToCssVars()`, `dlfToCssVars()`, `dlfSummary()`
- **`tsconfig.base.json`** — path alias added: `"@originmain/design-language": ["./packages/design-language/src/index.ts"]`

---

## Layer 6 — AI Completion Layer ✅

**Completed:** 2026-04-25

### New package: `packages/ai-layer`

- **`src/client.ts`** — `getClient(): Anthropic`, `MODEL = 'claude-opus-4-7'`
- **`src/gateway.ts`** — `AIGateway` class: 60 RPM rate limiter, 3 retries on 429/529/5xx, cost tracking (`computeCost()`). Note: `thinking: {type: 'adaptive'}` pending SDK ≥0.58 upgrade
- **`src/prompts/system.ts`** — `buildSystemPrompt({role, dlfJson?})` returns `TextBlockParam[]`; DLF block has `cache_control: {type: 'ephemeral'}` as stable system prompt prefix
- **`src/completion-zone.ts`** — `fillCompletionZone()`: 3-retry JSON validation loop, temp 0.3
- **`src/diff-summary.ts`** — `generateDiffSummary()`: temp 0.3, 128 tokens max
- **`src/artboard-query.ts`** — `queryCrossArtboard()`: temp 0.3
- **`src/drift-report.ts`** — `generateDriftReport()`: base64 image, temp 0.3
- **`src/agent-qa.ts`** — `answerAgentQuestion()`: temp 0.7

### SDK note
`@anthropic-ai/sdk` upgraded to **v0.91.1** in Session 4. All 5 feature files now use `thinking: {type: 'adaptive'}` via the gateway. `temperature` parameter removed from `GatewayRequest` interface and all feature call sites (Opus 4.7 with adaptive thinking rejects temperature with HTTP 400).

---

## Layer 7 — Agent Bridge (MCP) ✅

**Completed:** 2026-04-26

### New package: `packages/agent-bridge`

- **`src/protocol.ts`** — JSON-RPC 2.0 types: `JsonRpcRequest`, `JsonRpcSuccess<T>`, `JsonRpcError`, `MCP_ERROR` constants (`UNAUTHORIZED: -32001`, `RATE_LIMITED: -32002`), `AuthRequest`/`AuthAck` handshake, `textResult()`/`jsonResult<T>()` helpers
- **`src/auth.ts`** — `issueWorkspaceToken(workspaceId, agentType)` HMAC-SHA256 base64url token; `verifyWorkspaceToken(token)` with timing-safe comparison, 30-day TTL; uses Node `crypto` built-in
- **`src/rate-limiter.ts`** — Sliding window: 100 requests/60-min/workspace; in-process Map of timestamp arrays (replace with Redis for multi-instance)
- **`src/tools.ts`** — `ToolContext` interface (db + ai adapters), `McpTool` interface, 5 tools: `get_pending_diffs` (rate-guarded), `get_artboard_context`, `ask_design_agent`, `update_diff_status`, `get_design_language`; `TOOLS` array, `TOOL_MAP`, `getToolList()`
- **`src/adapters/cursor.ts`** — `generateCursorConfig()`: generates `.cursorrules` markdown + `cursor_settings.json` MCP server entry with Bearer auth
- **`src/adapters/claude-code.ts`** — `generateClaudeCodeConfig()`: generates `CLAUDE.md` section + `.claude/settings.json` MCP server declaration with SSE transport

### Notes
- Added `@types/node` devDep + `"types": ["node"]` in tsconfig for `crypto`/`Buffer`/`process`
- `AgentType`: `'CURSOR' | 'CLAUDE_CODE' | 'GENERIC'`

---

## Layer 8 — Multi-Origin Ingestion ✅

**Completed:** 2026-04-26

### Package: `packages/integrations`

- **`src/types.ts`** — `OriginIngester<TPayload>` interface: `parsePayload(raw): TPayload` + `ingest(payload): IngestionResult`; `IngestionResult` carries `origin: InsertOrigin`, `artboardTitle`, optional `renderUrl`
- **`src/connectors/linear.ts`** — `linearIngester`: Zod-validates Linear Issue webhook payload; maps to `LINEAR_ISSUE` origin; prefers attachment URL for `renderUrl`
- **`src/connectors/slack.ts`** — `slackIngester`: Zod-validates Slack `message_posted` event; extracts first image attachment; maps to `SLACK_MESSAGE` origin
- **`src/connectors/github.ts`** — `githubIngester`: Zod-validates GitHub `pull_request` webhook (opened/synchronize/reopened/closed); maps to `GIT_COMMIT` origin with PR metadata
- **`src/connectors/intercom.ts`** — `intercomIngester`: Zod-validates Intercom `conversation.user.created` webhook; extracts annotated screenshot attachment; maps to `URL` origin with user context

### Design note
Each connector validates untrusted webhook JSON at the boundary with Zod (`parsePayload` throws `ZodError` on invalid input). The `origin` output maps directly to `InsertOrigin` from `@originmain/origin-graph` — no `workspace_id` on origins (that scoping lives on the `artboards` table via `origin_id`).

---

## Package Inventory

| Package                    | Status      | Notes                                                       |
|----------------------------|-------------|-------------------------------------------------------------|
| `packages/app`             | Active      | Next.js 15 app; Layers 1–3 complete                         |
| `packages/diff-engine`     | Complete    | 49 tests, ~88% coverage                                     |
| `packages/ui`              | Active      | Theme + FluentProvider                                      |
| `packages/renderer`        | Complete    | Layer 2: postMessage protocol, fiber hook (proxy-compatible), MF config |
| `packages/cli`             | Complete    | Layer 2: CLI proxy for live rendering (`originmain dev`)    |
| `packages/live-sdk`        | Complete    | Layer 2: `@originmain/live` SDK for preview deployments     |
| `packages/origin-graph`    | Complete    | Layer 4: migrations, RLS, Zod types, query helpers; 45 tests, 100% types.ts coverage |
| `packages/design-language` | Complete    | Layer 5: DLF schema, validator, token pipeline              |
| `packages/ai-layer`        | Complete    | Layer 6: gateway, 5 features, prompt library; SDK v0.91.1, adaptive thinking |
| `packages/agent-bridge`    | Complete    | Layer 7: MCP tools, auth, rate limiter, adapters            |
| `packages/integrations`    | Complete    | Layer 8: OriginIngester + 4 connectors                      |
| `packages/multiplayer`     | Foundation  | Layer 9: room schema, MultiplayerAdapter, cursor palette    |
| `packages/platform`        | Foundation  | Layer 10: Plugin API, SSO/SCIM/audit types, theming         |
| `packages/e2e`             | Not started | Playwright E2E; Phase 1 completion target                   |

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Artboard tree | Fluent 2 `Tree`/`TreeItem` | ARIA, Fluent token integration, <100s of nodes |
| Codebase file tree | `@pierre/trees` | Virtualization for 5k+ files, git status, search |
| Diff renderer | `@pierre/diffs` `PatchDiff` | Shiki syntax highlight, split/unified modes |
| Canvas state | Zustand | Lightweight, supports undo/redo middleware |
| TS imports in Next.js | `extensionAlias` `.js → .ts` | ESM-compatible workspace packages |
| AI model | Claude Opus 4.7 | Max intelligence for design engineering tasks |
| Prompt caching | DLF as stable system prompt prefix | ~60% input token cost saving per session |
| MCP auth | HMAC-SHA256 workspace token | Stateless, 30-day TTL, timing-safe verify |
| Rate limit | In-process sliding window | Simple; swap for Redis in multi-instance deploy |
| Webhook validation | Zod at connector boundary | `ZodError` → HTTP 400 before any DB write |
| `exactOptionalPropertyTypes` | Conditional spread `...(v !== undefined ? {k: v} : {})` | Required by strict TS config throughout monorepo |

---

## Layer 9 — Multiplayer & Presence (Foundation) ✅

**Completed:** 2026-04-26 (Phase 3 foundation only — no Liveblocks app integration per guide)

### New package: `packages/multiplayer`

- **`src/room-schema.ts`** — Liveblocks room schema types:
  - `UserPresence` — cursor `{x,y}`, `activeArtboardId`, `selectedComponentIds`, `cursorColor`; updated ≤50ms throttle
  - `ArtboardStorageObject` — CRDT-backed artboard state (viewport, locked, lastModifiedAt)
  - `WorkspaceStorage` — `artboards: Record<id, ArtboardStorageObject>` + `artboardOrder`
  - `LiveblocksRoomTypes` — generic type params for `createRoomContext<Presence, Storage, UserMeta, RoomEvent>`
  - `RoomEvent` — broadcast events: `ARTBOARD_LOCKED`, `DIFF_EXPORTED`, `COMPLETION_ZONE_ACCEPTED`
  - `workspaceRoomId(workspaceId)` — room ID convention: `"workspace:<uuid>"`
- **`src/adapter.ts`** — `MultiplayerAdapter` interface matching Zustand store API surface (presence reads/writes, artboard storage, subscribe); `createLocalAdapter()` stub for Phase 1/2
- **`src/cursor-colors.ts`** — `cursorColorForUser(userId)` deterministic 12-colour palette assignment

### Phase 3 integration note
Actual `createClient` / `createRoomContext` calls go in `packages/app/src/lib/liveblocks.ts` (Phase 3). `@liveblocks/client` and `@liveblocks/react` are declared as optional peer deps — not installed yet.

---

## Layer 10 — Platform & Extensions (Foundation) ✅

**Completed:** 2026-04-26 (Phase 4 foundation — types and contracts only)

### New package: `packages/platform`

- **`src/plugin-api.ts`** — Plugin API:
  - `PluginManifest` — reverse-DNS `id`, `version`, `entryUrl`, `bundleHash`, `permissions[]`
  - `PluginPermission` — 7 scopes: `artboards:read`, `artboards:write`, `diffs:read`, `diffs:export`, `completion-zones:register`, `ingesters:register`, `design-language:read`
  - `PluginReadAPI` / `PluginWriteAPI` — async APIs exposed to sandboxed plugin via postMessage
  - `PluginContext` — `read`, `write` (null unless `artboards:write` granted), `notify()`
  - `CustomCompletionZoneDefinition` — custom zone type with `systemPromptAddendum` + `outputSchema`
  - `CustomIngesterDefinition` — custom connector `handleWebhook()` interface
  - `PluginRegistry` — `list / install / uninstall / setEnabled` per workspace
- **`src/enterprise.ts`** — Enterprise features:
  - `SsoConfig` — SAML 2.0: `idpEntityId`, `idpSsoUrl`, `idpCertificate`, `enforced`, `emailDomains`; providers: okta/azure/google-workspace/onelogin/custom
  - `ScimUser` / `ScimGroup` — SCIM 2.0 normalized objects with `role` mapped to `TeamRole`
  - `AuditLogEntry` — 30 audit actions across auth/workspace/artboard/diff/AI/plugin/DLF/agent-bridge
  - `buildAuditEntry()` — convenience constructor with auto-timestamp
- **`src/theming.ts`** — White-label theming:
  - `BrandTokens` — `primaryColor`, `secondaryColor`, `logoUrl`, `productName`, `faviconUrl`
  - `brandVariantsFromHex(hex)` — derives 16-shade Fluent 2 `BrandVariants` from single hex colour via HSL interpolation (shade10=lightest → shade160=darkest)

---

## Known Pending Items

1. **Redis-backed rate limiter** — `packages/agent-bridge/src/rate-limiter.ts` is in-process only; needs Redis for multi-instance MCP server deployment
2. **Layer 0** — Infrastructure (Vercel, Supabase, Render, GitHub Actions) deferred per plan
3. **Layer 9 Phase 3** — Wire `MultiplayerAdapter` into app components; add `createClient`/`createRoomContext` in `packages/app/src/lib/liveblocks.ts`; install `@liveblocks/client` + `@liveblocks/react`
4. **Layer 10 Phase 4** — Plugin sandbox runtime (iframe + postMessage bridge); SCIM webhook endpoint; SSO provider registration UI; audit log Supabase table + extension
5. **`packages/e2e`** — Playwright E2E tests not yet created

---

---

## Product Bug Audit (2026-04-26) — Work In Progress

The following is a second-pass audit of all real product gaps, independent of layer status. These are being worked on in the current session.

### ✅ Completed — Session 1
- `.env.example` fixed: `CLERK_PUBLISHABLE_KEY` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, added `AGENT_BRIDGE_SECRET`, `GITHUB_WEBHOOK_SECRET`, `INTERCOM_WEBHOOK_SECRET`
- `project_id` added to `ArtboardSchema` in `types.ts` and `getArtboards` query
- `createArtboardMutation` exported from `useArtboards.ts`, used in `Canvas.tsx` artboard tool
- `useArtboards` returns `rawArtboards: Artboard[]` (full DB rows) alongside canvas-mapped shapes
- Inspector props tab now shows real `metadata_jsonb` fields from selected artboard
- ArtboardNavigator shows real artboard names (not hardcoded FILE_PATHS)
- Canvas keyboard shortcuts: V/H/A/Z for tools, Escape to cancel
- All 4 error boundary files created (global, workspaces, workspace, canvas)
- Design Language upload UI in workspace page
- Webhook `project_id: null` placeholder added (awaiting full project param support)
- `PATCH /api/artboards/[id]` + `DELETE /api/artboards/[id]` + origin-graph helpers
- `POST /api/workspace/[id]/tokens` — workspace token issuance for IDE integration
- `WorkspaceCard.tsx` + `ProjectCard.tsx` extracted as `'use client'` components → fixed server-side exception on breadcrumb click

### ✅ Completed — Session 2 (2026-04-26)
- **Server-side crash fixed**: `workspaces/page.tsx` and `workspace/[wid]/page.tsx` confirmed using `WorkspaceCard`/`ProjectCard` client components
- **Inspector fully rewired**: uses `useDiffs` (DB) + `useHistory` (pending); Export Diff button; `renderUrl` inline editor; live status bar reads `liveArtboardIds`
- **Empty canvas state**: DEMO_ARTBOARDS removed; Canvas shows hint when empty
- **Zone tool drag preview**: live dashed rectangle + dimension label
- **Workspace settings page**: `GET+PATCH /api/workspace/[id]`, rename, IDE token issuance, danger zone
- **Settings link** added to workspace page

### ✅ Completed — Session 3 (2026-04-26)
- **Canvas store `artboardFiberRoots`**: new `setFiberRoot(artboardId, root)` — Artboard calls it on every fiber update; Inspector Graph tab reads from it
- **Inspector Graph tab**: shows real collapsible `FiberTreeView` from live artboard; shows node count + depth; placeholder when no live render
- **Inspector Props tab — component selection**: when a component is clicked via `SelectionOverlay`, fiber props appear in a `↳ ComponentName` section above artboard metadata
- **Artboard delete button**: ✕ icon appears in label when artboard is selected; confirm dialog → `DELETE /api/artboards/[id]` → invalidate query
- **Artboard drag + rename**: already implemented (drag label to move, double-click to rename inline)
- **Navigator delete/rename**: hover on artboard row reveals pencil (rename) and trash (delete) icon buttons; calls `patchArtboard` / `DELETE` API
- **Zone prompt popup**: after zone drag ends, `ZonePromptOverlay` floats at zone position; textarea + "Generate ⌘↵" → `POST /api/ai/completion-zone`; shows result; Escape/close to dismiss
- **Dead demo code removed**: `ArtboardContent`, `DashboardCard`, `UserProfile`, `NavSidebar`, `DataTable` all deleted from `Artboard.tsx`

### ✅ Completed — Session 4 (2026-04-26)
- **Viewport per-workspace persistence**: `viewport.ts` `restore()` action + `AppChrome.tsx` useEffect saves/restores `panX/panY/zoom` per workspace in localStorage under `originmain:viewport:{workspaceId}`
- **Webhook `?project=` param**: `/api/webhooks/[provider]/route.ts` reads `project` query param → `project_id` on created artboard
- **Navigator live render badge**: artboard rows show pulsing green dot when artboard ID is in `liveArtboardIds`
- **Navigator real graph stats**: `artboardFiberRoots` traversal gives true component counts; live artboard count from `liveArtboardIds.size`
- **Cross-Artboard Query UI**: `CrossArtboardQuery` component in Navigator, queries `POST /api/ai/query`
- **Drift Report UI**: "↻ Generate drift report" button at bottom of Inspector Props tab; calls `POST /api/ai/drift-report`; shows scrollable pre-formatted result panel
- **`@anthropic-ai/sdk` upgraded to v0.91.1**: adaptive thinking wired in gateway; `temperature` removed from interface + all 5 feature files
- **Team invitation UI**: `TeamInviteForm` added to `WorkspaceSettingsForm` — Clerk userId + role picker → `POST /api/workspace/[id]/invite`; conflict/error/success feedback
- **Project settings page**: `/workspace/[wid]/project/[pid]/settings` — rename, description, app URL, framework selector, type-to-confirm delete; gear icon in AppChrome breadcrumb
- **Vitest: diff-engine**: stray test moved to correct location; all 49 tests pass, 88% coverage
- **Vitest: origin-graph**: 45 new Zod schema tests in `__tests__/types.test.ts`; 100% `types.ts` coverage

### ✅ Completed — Session 5 (2026-04-28)

- **Completion zone payload fixed**: `POST /api/ai/completion-zone` now adapts canvas UI shape `{artboard_id, bounds, prompt}` → `CompletionZoneInput {componentTreeJson, intent}`. Auto-loads active DLF from workspace. Returns `description` + backwards-compat `result`/`completion` keys.
- **Cross-artboard query fixed**: `POST /api/ai/query` now adapts navigator UI shape `{workspace_id, question}` → `ArtboardQueryInput {query, artboardsJson}`. Fetches live artboard list from DB. Returns `{results, reasoning, answer}`.
- **DELETE /api/workspace/:id**: Owner-only workspace deletion. `deleteWorkspace()` added to `origin-graph/queries.ts`. WorkspaceSettingsForm danger zone now calls the endpoint and redirects to `/workspaces` on success.
- **Diff summary wired**: `POST /api/ai/diff-summary` route created. DiffTab export now calls it before `POST /api/diffs` — summary included in the diff payload. Export button shows "Summarising…" → "Exporting…" states.
- **Artboard fork**: Fork button (branch icon) added to navigator artboard rows. Creates child artboard with `parent_artboard_id` set, offset 40px right of source, same `renderUrl` + `origin_id` inherited.
- **Migration split fixed**: Migrations 002–005 copied to `supabase/migrations/`. `get_diffs_by_status` RPC appended to `origin-graph/migrations/001_initial_schema.sql`.
- **Dead code removed**: `packages/app/src/hooks/useDiff.ts` and `packages/app/src/data/artboard-snapshots.ts` deleted (no imports, confirmed safe).
- **Dark mode**: `packages/app/src/store/theme.ts` (Zustand persist, key `originmain:theme`). `providers.tsx` reads `useTheme` to pick `originmainLightTheme`/`originmainDarkTheme`. Sun/moon toggle button in AppChrome breadcrumb bar.
- **Plugin stub page**: `/workspace/[wid]/plugins` — full page with permissions preview, Phase 4 roadmap note. Linked from workspace page header alongside Settings.
- **Agent status badges**: `Artboard.tsx` calls `useDiffs(id)` and renders compact colored chips (draft/reviewed/applied/blocked) bottom-right of each artboard frame when diffs exist.
- **TypeScript**: `tsc --noEmit` exits 0 on both `packages/app` and `packages/origin-graph`.

### ✅ Completed — Session 6 (2026-04-29)

#### Full-app dark/light theme system

- **`packages/app/src/store/canvasTheme.ts`** (NEW) — `CanvasTokens` interface (24 typed tokens); `DARK_TOKENS` + `LIGHT_TOKENS` constant sets; `useCanvasTheme()` hook reads `useTheme` store and returns the active token set.
- **`packages/app/src/app/globals.css`** — Added 17 CSS variables in `:root` + `[data-theme="dark"]` overrides: `--page-bg/text`, `--card-bg/border/text/muted/subtle/icon-bg/icon-fg`, `--input-bg/border/text`, `--btn-bg/fg`, `--btn-idle-bg/fg/border`.
- **`packages/app/src/app/providers.tsx`** — `useEffect` syncs Zustand `mode` → `document.documentElement.setAttribute('data-theme', mode)` so CSS variables cascade to server-rendered pages.
- **Canvas editor — all panels now theme-aware** via `useCanvasTheme()`:
  - `Toolbar.tsx` — all tokens replaced; `Sep`/`TBtn` sub-components accept `T: CanvasTokens` prop
  - `Canvas.tsx` — `canvasBg`, `dotColor` tokens
  - `ArtboardNavigator.tsx` — full token conversion; `NavRow`/`IconBtn` accept `T` prop; `treeThemeStyles` reactive; all micro-components (`SectionLabel`, `HSep`, `GraphStat`, `CrossArtboardQuery`) call `useCanvasTheme()` directly
  - `Inspector.tsx` — all sub-components (`PropsTab`, `Section`, `PropRow`, `GraphTab`, `FiberTreeView`, `GraphNode`, `DiffTab`, `SavedDiffRow`) call `useCanvasTheme()` directly
  - `AppChrome.tsx` breadcrumb bar — logo, separators, links, settings gear, theme toggle icon all use `CT.*` tokens (no more hardcoded `rgba(255,255,255,*)`)
- **Shell pages — CSS variable adoption** (`var(--card-bg)`, `var(--card-text)`, `var(--input-bg)`, `var(--btn-bg)`, etc.):
  - `ProjectCard.tsx`, `WorkspaceCard.tsx`, `DesignLanguageUpload.tsx`
  - `ProjectSettingsForm.tsx`, `WorkspaceSettingsForm.tsx` — static `SECTION`/`LABEL`/`INPUT`/`BTN_PRIMARY` const objects updated to use CSS vars
  - `workspace/[wid]/page.tsx`, `workspace/[wid]/plugins/page.tsx`
  - `workspace/[wid]/project/new/page.tsx`, `workspaces/new/page.tsx`
  - `workspace/[wid]/project/[pid]/settings/page.tsx`
  - `onboarding/page.tsx`, `error.tsx`
- **`AppHeader.tsx`** (shell) — converted to `'use client'`; `useTheme` hook; sun/moon toggle button before `UserButton`; breadcrumb colors theme-aware.

#### AI layer fixes

- **`claude-opus-4-7` + `thinking: {type: 'adaptive'}`** confirmed correct and restored (earlier session accidentally introduced invalid model name and deprecated `{type:'enabled', budget_tokens:N}` format).
- **Defensive JSON stripping** in `artboard-query.ts`, `agent-qa.ts`, `completion-zone.ts`, `drift-report.ts` — strips ` ```json ``` ` code fences before `JSON.parse` to handle model responses that wrap JSON in markdown blocks.
- **Stale webpack cache cleared** — `packages/app/.next/cache/webpack/server-development` removed to force recompile of changed `ai-layer` source.

#### Marketing page (`public/marketing.html`)

- **Dark mode CSS block** — `[data-theme="dark"]` overrides all CSS variables; sun/moon toggle in desktop nav and mobile drawer; syncs to both `om-theme` (marketing) and `originmain:theme` (Zustand/app) localStorage keys.
- **`cmp-card.hero-card` bug fixed** — was `background: var(--fg)` which = near-white in dark mode (white text on white card). Fixed to always-dark `#06060E` with blue `rgba(51,133,255,0.4)` glow border; eyebrow/tags get blue tint; body contrast improved.
- **Bottom CTA (`#cta-bottom`) bug fixed** — was `background: var(--bg-inv)` which = light gray in dark mode, making `btn-outline-white` invisible. Fixed to always-dark `#06060E`; headline/subtext use fixed white alphas; gradient intensity slightly increased.

### ✅ Completed — Session 7 (2026-04-29)

#### Rendering Architecture Overhaul

The original Layer 2 rendering system used direct cross-origin iframe script injection, which was non-functional (see RENDERING-ARCHITECTURE.md §2). Replaced with two working modes:

- **`RENDERING-ARCHITECTURE.md`** (NEW) — Full design document: problem statement, two rendering modes, postMessage protocol, sequence diagrams, edge cases, package reference, migration notes.

- **`packages/renderer/src/fiber-hook.ts`** — Added `buildProxyFiberHookScript()`: generates a generic fiber hook script that reads `window.name` for artboard ID routing. Exported from package index. Original `buildFiberHookScript(id)` preserved as deprecated.

- **`packages/cli/`** (NEW) — `@originmain/cli` CLI package:
  - `src/cli.ts` — Entry: `originmain dev --target <url> [--port <n>]` with argument validation
  - `src/proxy.ts` — Reverse HTTP proxy: strips X-Frame-Options/CSP, injects fiber hook into HTML, passes WebSocket upgrades for HMR, adds CORS headers
  - `src/inject.ts` — HTML injection: inserts `<script>` after `<head>` (with `<html>` and prepend fallbacks)
  - `src/index.ts` — Programmatic API export

- **`packages/live-sdk/`** (NEW) — `@originmain/live` SDK package:
  - `src/hook.ts` — Self-contained fiber hook: installs `__REACT_DEVTOOLS_GLOBAL_HOOK__`, wraps existing DevTools handler, serializes fiber tree, sends postMessage with artboard ID from `window.name`. No-op when not in an Originmain iframe.
  - `src/index.ts` — Side-effect re-export

- **`packages/app/src/components/canvas/LiveArtboard.tsx`** — Removed broken `injectFiberHook()` helper. Added `name={`om:${id}`}` to iframe for artboard ID routing. READY handler no longer attempts script injection.

- **`packages/app/src/components/canvas/Artboard.tsx`** — `EmptyArtboardContent` updated: shows CLI proxy command hint, placeholder changed to `:4170`, URL input hint explains both connection modes.

- **`packages/integrations/src/connectors/github.ts`** — Fixed `renderUrl`: accepts `deploymentUrl` option from caller instead of using `pr.html_url` (which is un-iframeable). Uses `exactOptionalPropertyTypes`-safe conditional spread.

- **`packages/integrations/src/types.ts`** — `OriginIngester.ingest()` now accepts optional `opts` parameter for connector-specific configuration.

- **`tsconfig.base.json`** — Added path aliases for `@originmain/cli` and `@originmain/live`.

- **TypeScript**: Full monorepo `pnpm -r run typecheck` passes — all 12 packages, zero errors.

### 🔧 Remaining — Lower Priority

- [ ] **Multiplayer**: Wire `MultiplayerAdapter` into app (install `@liveblocks/client` + `@liveblocks/react`; create `packages/app/src/lib/liveblocks.ts`)
- [ ] **`packages/e2e`**: Playwright E2E tests not yet created
- [ ] **Redis rate limiter**: Replace in-process rate limiter in `agent-bridge/src/rate-limiter.ts` for multi-instance MCP support
- [ ] **Product analytics**: Instrument PostHog for activation/engagement metrics (GTM requirement)
- [ ] **Onboarding wizard**: Step-by-step "connect your app" flow from signup to first live artboard
- [ ] **GitHub App + deployment_status webhook**: Full OAuth flow to connect GitHub repos + auto-populate `deploymentUrl` from Vercel/Netlify deployment webhooks
- [ ] **Marketing page — remaining `section-dark` / `--bg-inv` surfaces**: other sections using `background: var(--bg-inv)` (e.g. `#features-alt`, footer) should be audited for the same light-mode-in-dark-mode inversion issue if the marketing page is expected to fully support theme toggling

### ✅ Completed — Session 8 (2026-04-30)

#### Canvas artboard creation fixed
- **Bug**: `e.target === e.currentTarget` guard in `Canvas.tsx` was always false because the canvas has a full-size `position:absolute; inset:0; z-index:2` transform layer that intercepts all pointer events. Pressing A + clicking the canvas never created an artboard.
- **Fix**: Removed the guard. Added `onMouseDown={(e) => e.stopPropagation()}` to the artboard root div so clicks on existing artboards don't bubble up and trigger creation.

#### Artboard drag stale-closure fix
- **Bug**: `onUp` closed over `dragOffset` state from `useCallback` creation time (always `{dx:0,dy:0}`). Artboards snapped back to original position after drag.
- **Fix**: Added `dragOffsetRef` mutable ref. `onMove` updates both state and ref; `onUp` reads only from ref.

#### Design tab (live CSS inspector + editor)
- **`packages/renderer/src/protocol.ts`** — Two new message types:
  - `REQUEST_ELEMENT_STYLES { nodeId }` (Host → Renderer)
  - `ELEMENT_STYLES { nodeId, styles }` (Renderer → Host)
  - `PATCH_ELEMENT_STYLE { nodeId, property, value }` (Host → Renderer)
- **`packages/live-sdk/src/hook.ts`** — Three new handlers:
  - `REQUEST_ELEMENT_STYLES` → reads `window.getComputedStyle(el)` for ~30 curated properties → posts `ELEMENT_STYLES`
  - `PATCH_ELEMENT_STYLE` → calls `el.style.setProperty(property, value)` on the fiber's DOM element
- **`packages/app/src/store/canvas.ts`** — Added `selectedComponentStyles`, `setComponentStyles`, `styleEditEvent` mailbox, `patchStyleEdit`, `clearStyleEdit`.
- **`packages/app/src/components/canvas/LiveArtboard.tsx`** — Sends `REQUEST_ELEMENT_STYLES` immediately after `COMPONENT_SELECTED`. Handles `ELEMENT_STYLES` response. Watches Zustand `styleEditEvent` and forwards `PATCH_ELEMENT_STYLE` to the iframe.
- **`packages/app/src/components/canvas/Artboard.tsx`** — Wires `onComponentStylesUpdate` → `setComponentStyles`; handles deselect with styles clear.
- **`packages/app/src/components/inspector/Inspector.tsx`** — **DESIGN** tab added as first tab. `DesignTab` component shows Typography, Layout, Visual sections. Every property is inline-editable — changes send `PATCH_ELEMENT_STYLE` via the Zustand mailbox for immediate live preview.
- **Inspector tab order**: Design → Props → Diff → Graph (was Props → Diff → Graph).
- **Default tab**: Design (was Props).

#### Route-aware artboards (multi-screen workflow)
- **`packages/app/src/hooks/useArtboards.ts`** — `CanvasArtboard` gets `route?: string`; `toCanvasArtboard` extracts `metadata_jsonb.route`.
- **`packages/app/src/components/canvas/Artboard.tsx`** — `route` prop; `buildSrc(base, route)` helper combines base URL + path. Artboards on the same proxy now show different pages.
- **`packages/app/src/components/inspector/Inspector.tsx`** — `route` field in PropsTab Render Target section; editable inline; saved to `metadata_jsonb.route`. `reservedKeys` set expanded to exclude `route` from "extra props" section.

#### On-canvas onboarding
- **`packages/app/src/components/canvas/Canvas.tsx`** — Empty canvas now shows a 3-step guide: ① Press A + click, ② CLI command (with copy-ready code block), ③ Paste proxy URL. Replaces the single-line hint.

#### CLI published
- `@originmain/cli@0.0.3` on npm. README covers quick start, flags, programmatic API, how it works.

#### Bug fixes (prior sessions)
- HTTP 204 with body in `GET /api/design-language` (RFC 7230 §3.3 violation)
- `tools/list` MCP endpoint missing `inputSchema` (breaks IDE clients)
- `ProjectSettingsForm` wrong role constant + wrong delete-confirm comparison target

*Last updated: 2026-04-30 — Session 8 complete*
