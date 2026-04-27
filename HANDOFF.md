# Originmain — Implementation Handoff

> Living document. Updated after each layer is completed or substantially advanced.
> Reference: `Originmain-Implementation-Guide-v1_0.md` (v1.0, April 2026)

---

## Layer Status Summary

| Layer | Name                        | Status       | Notes                                                            |
|-------|-----------------------------|--------------|------------------------------------------------------------------|
| 0     | Infrastructure & DevOps     | ⏳ Deferred  | Skipped for now per plan                                         |
| 1     | Canvas UI Shell             | ✅ Complete  | ArtboardTree, CodebaseFileTree, CodeDiffPanel                    |
| 2     | Live Rendering Engine       | ✅ Complete  | postMessage protocol, fiber hook, MF config, LiveArtboard iframe |
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

## Layer 2 — Live Rendering Engine ✅

**Completed:** 2026-04-25

### Files created
- **`packages/renderer/src/protocol.ts`** — `HostMessage`/`RendererMessage` unions, `isHostEnvelope()`, `isRendererEnvelope()`, `createHostEnvelope()`, `createRendererEnvelope()`; source discriminants `'originmain-host'` / `'originmain-renderer'`
- **`packages/renderer/src/fiber-hook.ts`** — `buildFiberHookScript(artboardId)` generates injectable script that patches `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot`, walks Fiber tree, posts `FIBER_TREE_UPDATE` envelopes to `window.parent`
- **`packages/renderer/src/module-federation.ts`** — `createRendererHostConfig()` and `createRemoteConfig()` MF host config helpers with shared React singleton
- **`packages/renderer/src/index.ts`** — exports all of the above
- **`packages/app/src/components/canvas/LiveArtboard.tsx`** — React iframe component; `sandbox="allow-scripts allow-same-origin allow-forms"`; injects fiber hook on `READY`; sends `SET_DESIGN_TOKENS` on token change

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
| `packages/renderer`        | Complete    | Layer 2: postMessage protocol, fiber hook, MF config        |
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

### 🔧 Remaining — Lower Priority

- [ ] **Multiplayer**: Wire `MultiplayerAdapter` into app (install `@liveblocks/client` + `@liveblocks/react`; create `packages/app/src/lib/liveblocks.ts`)
- [ ] **Plugin system stub page**: UI route at `/workspace/[wid]/plugins` listing installed plugins
- [ ] **`packages/e2e`**: Playwright E2E tests not yet created
- [ ] **Redis rate limiter**: Replace in-process rate limiter in agent-bridge for multi-instance support

**Webhook project_id:**
`/api/webhooks/[provider]/route.ts` currently sets `project_id: null`. Read the `?project=` query param from the request URL (`new URL(req.url).searchParams.get('project')`) and pass it to the ingestion result.

*Last updated: 2026-04-26 — Session 3 complete*
