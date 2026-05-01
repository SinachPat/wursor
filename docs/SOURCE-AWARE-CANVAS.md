# Source-Aware Canvas & Agent Bridge: Implementation Design

**Status:** Draft — awaiting review before implementation begins  
**Scope:** Two-layer system to close the gap between visual intent and real code edits  
**Packages touched:** `@originmain/renderer`, `@originmain/cli`, `@originmain/agent-bridge`, `@originmain/app`

---

## 1. Problem Statement

The current canvas pipeline gives us **runtime truth** — what the component looks like, what props it accepts, what DOM rect it occupies — but zero **source truth**: which file defines it, what token it consumes, how to write a change back to disk.

Style patches applied via `PATCH_ELEMENT_STYLE` mutate the live DOM through `el.style.setProperty()`. They vanish on the next hot-reload. That is not an Intent Diff; it is DevTools with a nicer UI.

The corrected architecture requires two layers working together:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — Runtime (exists today)                            │
│  CLI proxy → iframe → fiber hook → FIBER_TREE_UPDATE         │
│  Gives: visual render, component name, DOM rect, live props  │
└───────────────────────────┬─────────────────────────────────┘
                            │ component name + _debugSource
┌───────────────────────────▼─────────────────────────────────┐
│  LAYER 2 — Source (what we are building)                     │
│                                                              │
│  2a. _debugSource extraction (renderer)                      │
│      React dev mode attaches fileName + lineNumber to every  │
│      fiber. We already walk the fiber tree — we just need    │
│      to forward this field. Zero CLI changes required.       │
│                                                              │
│  2b. CLI AST Indexer                                         │
│      Watches .tsx/.ts files, builds component→file map.      │
│      Exposes a local HTTP API: GET /components?name=Card     │
│      Returns: file, line, exported props, design tokens used │
│                                                              │
│  2c. Intent Message protocol                                 │
│      Canvas emits a structured Intent (not a DOM patch).     │
│      Intent carries: component, file, change, before/after.  │
│      Sent to Agent Bridge → Claude Code / Cursor apply it.   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. What Exists Today (audit)

### `@originmain/cli` — proxy only
- Reverse-proxies the user's dev server through port 4170
- Strips `X-Frame-Options` / CSP so the iframe can load
- Injects `buildProxyFiberHookScript()` into HTML responses via string injection
- Passes WebSocket upgrades for HMR
- **No AST indexing. No file watching. No component→file map.**

### `@originmain/renderer` — fiber hook + DOM inspector
- `buildProxyFiberHookScript()`: hooks `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot`
- Serialises the fiber tree → `FIBER_TREE_UPDATE` to parent canvas
- Sends `COMPONENT_SELECTED` on click, `ELEMENT_STYLES` on request
- Node IDs are stable path strings: `"ComponentName:idx/Child:idx/…"`
- `_debugSource` is present on fiber objects in dev mode but **is never read or forwarded**
- `PATCH_ELEMENT_STYLE` / `REMOVE_ELEMENT` apply DOM-only mutations — no source awareness

### `@originmain/agent-bridge` — MCP over JSON-RPC 2.0
- 5 tools: `get_pending_diffs`, `get_artboard_context`, `ask_design_agent`, `update_diff_status`, `get_design_language`
- Transport: WebSocket (long-running) or HTTP POST (polling)
- Auth: signed workspace token in first message (`AuthRequest`)
- Claude Code adapter generates `CLAUDE.md` section + `.claude/settings.json` block
- **No tool for "I changed this component — apply it to source"**
- **No tool for querying component→file mapping**

### `@originmain/app` — canvas host
- Canvas receives `FIBER_TREE_UPDATE`, stores in Zustand (`artboardFiberRoots`)
- Inspector reads `selectedComponentData` (a `FiberNode`) — name + props + domRect
- DOM patches queued in `styleEditQueue`, drained by `LiveArtboard`
- **No intent message emitted. Style changes stop at the DOM.**

---

## 3. Layer 2a — `_debugSource` Extraction (Quick Win)

**What it is:** React's dev build attaches `_debugSource: { fileName, lineNumber, columnNumber }` to every fiber created by JSX. This is the same data React DevTools uses to show "Defined in src/components/Card.tsx:12".

**What we need to do:**
- In `buildProxyFiberHookScript()` (renderer package), read `fiber._debugSource` during `serializeFiber()`
- Forward it as an optional `sourceFile: { fileName, lineNumber }` field on `FiberNode`
- Update the `FiberNode` TypeScript interface to include it

**Protocol change — add to `FiberNode`:**
```ts
export interface FiberNode {
  id: string;
  name: string;
  props: Record<string, unknown>;
  children: FiberNode[];
  domRect?: DOMRectLike;
  // NEW
  sourceFile?: { fileName: string; lineNumber: number; columnNumber?: number };
}
```

**Constraint:** `_debugSource` is only present in development builds (when React is compiled with `__DEV__ = true`). Production builds strip it. The CLI proxy is a dev-only tool, so this is acceptable. The field must be optional everywhere.

**What this unlocks immediately (no CLI changes):**
- Inspector can show "Defined in `src/components/DashboardCard.tsx:12`"
- Intent messages can carry an accurate `file` field without needing the AST indexer
- The AST indexer becomes a fallback/enrichment path, not a blocker

**Files to change:**
| File | Change |
|---|---|
| `packages/renderer/src/fiber-hook.ts` | Read `fiber._debugSource` in `serializeFiber()`, include in serialised node |
| `packages/renderer/src/protocol.ts` | Add `sourceFile?` to `FiberNode` interface |
| `packages/app/src/components/inspector/Inspector.tsx` | Display file path + line in the Inspector panel |

---

## 4. Layer 2b — CLI AST Indexer

**What it does:** Watches the user's project `.tsx`/`.ts` files, builds and maintains an in-memory map of `componentName → { filePath, exportedProps, designTokensUsed }`. Exposes a local HTTP API the canvas queries to enrich intent messages.

### 4.1 The index structure

```ts
interface ComponentEntry {
  name: string;
  filePath: string;          // relative to project root, e.g. "src/components/Card.tsx"
  lineNumber: number;        // line of the export declaration
  isDefaultExport: boolean;
  props: PropEntry[];        // extracted from the component's Props interface / type
  tokensUsed: string[];      // CSS custom property references found in the file (--color-primary etc.)
  lastIndexed: number;       // Date.now() — for cache invalidation
}

interface PropEntry {
  name: string;
  type: string;              // string representation, e.g. "string | undefined"
  optional: boolean;
  defaultValue?: string;
}
```

### 4.2 AST parsing approach

Use TypeScript's compiler API (`ts.createSourceFile()`) — it is already available in the dev environment since projects are TypeScript. The indexer does NOT need to type-check; it only needs to parse.

**What to extract per file:**
1. All named and default exported functions/arrow functions that start with a capital letter (component heuristic)
2. Their associated `Props` / `interface` / `type` parameter (first parameter type annotation)
3. All string literals matching `var(--…)` in JSX attribute values and template literals (design token references)

**What NOT to do:**
- Full type resolution (expensive, requires full `tsconfig` program)
- Module graph traversal (only index direct file exports)
- Watch `node_modules` (skip entirely)

### 4.3 Local HTTP API (exposed by CLI)

The CLI adds a second local server on port `4171` (or configurable):

```
GET  /components             → ComponentEntry[]    all indexed components
GET  /components?name=Card   → ComponentEntry[]    fuzzy-matched by name
GET  /components?file=src/…  → ComponentEntry[]    all exports from a file
GET  /health                 → { status, indexed, lastScan }
POST /reindex                → triggers full rescan (useful after large refactors)
```

**The canvas calls this API when an intent is about to be emitted** — it enriches the intent with `props` and `tokensUsed` before sending it to the Agent Bridge.

### 4.4 File watching

Use Node's `fs.watch()` (recursive, available since Node 22 which is the CLI's minimum). On change events, re-index only the changed file (incremental update, not full rescan). Full rescan on startup.

### 4.5 CLI command change

```
originmain dev --target http://localhost:3000 [--port 4170] [--index-port 4171] [--no-index]
```

`--no-index` disables the AST indexer for users who only want the proxy (e.g., non-TypeScript projects). The indexer is opt-in-by-default, gracefully degraded.

### 4.6 Files to create / change

| File | Change |
|---|---|
| `packages/cli/src/indexer.ts` | NEW — AST walker, component→file map, file watcher |
| `packages/cli/src/index-server.ts` | NEW — HTTP API server on port 4171 |
| `packages/cli/src/cli.ts` | Add `--index-port` / `--no-index` flags, start indexer alongside proxy |
| `packages/cli/src/proxy.ts` | Inject index server URL into HTML as `window.__OM_INDEX_URL__` |

---

## 5. Layer 2c — Intent Message Protocol

An Intent Message is the structured description of **what the user wants to change** — precise enough for a coding agent to apply it without guessing.

### 5.1 Intent Message format

```ts
interface IntentMessage {
  // Identity
  intentId: string;                  // uuid, for tracking
  workspaceId: string;
  artboardId: string;

  // Component context
  component: {
    name: string;                    // "DashboardCard"
    nodeId: string;                  // fiber path ID "DashboardCard:0/..."
    sourceFile?: string;             // "src/components/DashboardCard.tsx"
    sourceLine?: number;             // 12
    props: Record<string, unknown>;  // current runtime props
    propsSchema?: PropEntry[];       // from AST indexer (richer type info)
  };

  // The change(s) — an array to support multi-property edits
  changes: IntentChange[];

  // Before/after visual evidence
  snapshot?: {
    before: string;                  // base64 PNG of the component at the time of selection
    after?: string;                  // base64 PNG after DOM preview (optional, captured on confirm)
  };

  // Context the agent needs
  designLanguage?: {
    tokensUsed: string[];            // CSS custom props referenced in source
    palette: Record<string, string>; // current token values
  };

  createdAt: string;                 // ISO 8601
}

interface IntentChange {
  type: 'style' | 'prop' | 'layout' | 'remove';
  cssProperty?: string;             // for type: 'style'  e.g. "border-radius"
  propName?: string;                // for type: 'prop'   e.g. "variant"
  from: unknown;                    // previous value
  to: unknown;                      // intended value
  confidence: 'exact' | 'approximate'; // 'exact' = token match; 'approximate' = raw value
}
```

### 5.2 Where intent is created — canvas flow

```
User adjusts border-radius slider in Inspector
         ↓
Inspector dispatches patchStyleEdit() to Zustand
         ↓
LiveArtboard applies PATCH_ELEMENT_STYLE → DOM preview
         ↓
Inspector shows "Confirm as Intent" button
         ↓
User clicks Confirm
         ↓
Canvas builds IntentMessage:
  - component name + sourceFile from selectedComponentData (fiber node)
  - change: { cssProperty: 'border-radius', from: '8px', to: '12px' }
  - enriches with indexer API if available (/components?name=DashboardCard)
         ↓
Canvas sends IntentMessage to Agent Bridge via new MCP tool: push_intent
         ↓
Agent Bridge stores intent, forwards to connected Claude Code / Cursor session
         ↓
Agent reads file, makes edit, hot reload confirms visually
```

### 5.3 The "Confirm as Intent" UX decision

There are two valid approaches here, with different trade-offs:

**Option A — Optimistic / auto-emit**
Every DOM patch immediately generates an intent. No confirm button. The agent applies changes in real-time as the user drags.

- Pro: Fluid, no friction
- Con: Noisy — dragging a slider fires dozens of intents. The agent would be overwhelmed. Race conditions between hot-reload and the next drag.

**Option B — Explicit confirm**
DOM patch is a preview only. A "Commit as Intent →" button appears. The user confirms when satisfied.

- Pro: Clean one-shot intents. Agent gets a stable before/after to work with.
- Con: Extra click. Users might forget to commit.

**Recommendation: Option B** — matches the git mental model (stage → commit). The canvas already has the `styleEditQueue` pattern which fits this model. A "commit" button in the Inspector is the natural end of the interaction.

---

## 6. Layer 2d — Agent Bridge Enhancements

Two new MCP tools and one protocol extension are required.

### 6.1 New tool: `push_intent`

**Direction:** Canvas → Agent Bridge → coding agent  
**Purpose:** Deliver a confirmed IntentMessage to the connected agent session

```ts
// Input schema
{
  workspace_id: z.string().uuid(),
  intent: z.object({
    component: z.object({
      name: z.string(),
      sourceFile: z.string().optional(),
      sourceLine: z.number().optional(),
    }),
    changes: z.array(z.object({
      type: z.enum(['style', 'prop', 'layout', 'remove']),
      cssProperty: z.string().optional(),
      propName: z.string().optional(),
      from: z.unknown(),
      to: z.unknown(),
    })),
    snapshot: z.object({
      before: z.string(),    // base64 PNG
      after: z.string().optional(),
    }).optional(),
  }),
}
```

**What the tool does:**
1. Stores the intent in the `intent_diffs` table with status `EXPORTED`
2. Broadcasts it over the WebSocket connection to any connected agent
3. Returns the intent's ID so the canvas can poll for `IMPLEMENTED` status

The existing `update_diff_status` tool is how the agent signals completion. No changes needed there.

### 6.2 New tool: `resolve_component`

**Direction:** Coding agent → Agent Bridge → CLI indexer  
**Purpose:** Let Claude Code ask "where is `DashboardCard` defined?" without needing direct filesystem access through the MCP.

```ts
// Input
{ component_name: z.string() }

// Output
{
  name: string;
  sourceFile: string;
  sourceLine: number;
  props: PropEntry[];
  tokensUsed: string[];
}
```

**How it works:** The Agent Bridge proxies the request to the CLI indexer's HTTP API (`GET /components?name=DashboardCard`). This requires the CLI to register its indexer URL with the Agent Bridge on startup.

**CLI registration flow:**
```
originmain dev starts
  → proxy on :4170
  → indexer on :4171
  → POST /api/agent-bridge/register-indexer
    { workspaceToken, indexerUrl: "http://localhost:4171" }
  → Agent Bridge stores indexerUrl per workspace session
  → resolve_component proxies to it
```

### 6.3 Protocol extension — server-initiated INTENT_RECEIVED

The Agent Bridge needs to push intents to the agent without the agent polling. For WebSocket connections this is a server-initiated message (not a JSON-RPC request/response):

```ts
// Server pushes to agent over WebSocket
{
  type: 'INTENT_RECEIVED',
  intent: IntentMessage,
}
```

Claude Code / Cursor sessions listening over WebSocket receive this immediately after `push_intent` is called from the canvas.

### 6.4 Files to create / change

| File | Change |
|---|---|
| `packages/agent-bridge/src/tools.ts` | Add `push_intent` and `resolve_component` tools |
| `packages/agent-bridge/src/protocol.ts` | Add `IntentMessage`, `IntentChange` types; `INTENT_RECEIVED` server push |
| `packages/agent-bridge/src/index.ts` | Handle `/register-indexer` endpoint, store per-workspace indexer URL |
| `packages/agent-bridge/src/adapters/claude-code.ts` | Document new tools in `CLAUDE.md` section |
| `packages/app/src/app/api/agent-bridge/route.ts` | Wire `push_intent` and `resolve_component` to the tool executor |

---

## 7. Complete Data Flow

```
─────────────────────────────────────── DEVELOPMENT MACHINE ────
user's next dev       originmain CLI        Originmain canvas
  server :3000     proxy :4170  indexer:4171    (browser tab)
      │                │              │               │
      │   GET /page    │              │               │
      │◄───────────────│              │               │
      │   HTML + HMR   │              │               │
      │───────────────►│  inject      │               │
      │                │  fiber hook  │               │
      │                │─────────────────────────────►│
      │                │              │    READY       │
      │                │◄─────────────────────────────│
      │                │   FIBER_TREE_UPDATE           │
      │                │◄─────────────────────────────│
      │                │              │  user clicks   │
      │                │   COMPONENT_SELECTED          │
      │                │◄─────────────────────────────│
      │                │              │  user adjusts  │
      │                │   PATCH_ELEMENT_STYLE         │
      │                │───────────────────────────── │
      │   DOM preview  │              │               │
      │                │              │  user confirms │
      │                │   GET /components?name=Card  │
      │                │──────────────►│              │
      │                │   ComponentEntry             │
      │                │◄─────────────│              │
      │                │              │  IntentMessage │
      │                │              │◄──────────────│
─────────────────────────────── CLOUD ──────────────────────────
      │                │              │  push_intent   │
      │                │              │───────────────►│ Agent Bridge
      │                │              │                │   stores intent
      │                │              │                │   → INTENT_RECEIVED
      │                │              │                │───────────────►
      │                │              │                │            Claude Code
      │                │              │                │         reads file, edits
      │                │              │                │◄───────────────
      │   hot reload   │              │   FIBER_TREE_UPDATE (post-edit)
      │◄───────────────│◄─────────────────────────────│
      │                │              │  update_diff_status(IMPLEMENTED)
```

---

## 8. Implementation Phases

### Phase 1 — `_debugSource` (1–2 days, no dependency)
1. Extend `FiberNode` in `renderer/src/protocol.ts`
2. Read `fiber._debugSource` in `buildProxyFiberHookScript()`
3. Display file path in Inspector panel
4. No CLI or Agent Bridge changes needed

**Milestone:** Inspector shows "src/components/DashboardCard.tsx:12" for any selected component.

---

### Phase 2 — Intent Message + "Commit" UX (2–3 days, depends on Phase 1)
1. Define `IntentMessage` and `IntentChange` types in a new shared package or `agent-bridge/src/protocol.ts`
2. Add "Commit as Intent →" button to Inspector (appears after any DOM patch)
3. Canvas builds `IntentMessage` from `selectedComponentData` + `styleEditQueue`
4. For now, log intent to console and show a "copied to clipboard" confirmation
5. No Agent Bridge wiring yet — this phase validates the UX

**Milestone:** User can make a visual change and see a well-formed IntentMessage describing it.

---

### Phase 3 — CLI AST Indexer (3–4 days, parallel to Phase 2)
1. Implement `packages/cli/src/indexer.ts` — TypeScript AST walker
2. Implement `packages/cli/src/index-server.ts` — HTTP API on :4171
3. Wire into `cli.ts` alongside proxy
4. Inject `window.__OM_INDEX_URL__` into proxied HTML
5. Canvas queries indexer to enrich IntentMessage before emit

**Milestone:** `GET http://localhost:4171/components?name=DashboardCard` returns file path, props, tokens.

---

### Phase 4 — Agent Bridge `push_intent` + `resolve_component` (2–3 days, depends on Phase 2)
1. Add `push_intent` tool to `agent-bridge/src/tools.ts`
2. Add `resolve_component` tool (proxies to CLI indexer via registered URL)
3. Add `/register-indexer` endpoint
4. Implement `INTENT_RECEIVED` server push over WebSocket
5. Update Claude Code adapter's `CLAUDE.md` section to document the new workflow
6. Wire canvas Intent emit through to the API route → Agent Bridge

**Milestone:** User confirms an intent in the canvas; Claude Code session receives it and can open the right file.

---

### Phase 5 — E2E validation (1–2 days)
1. Full flow test: proxy → fiber hook → component select → DOM patch → confirm → Claude Code applies edit → hot reload
2. Validate that `_debugSource.fileName` matches the AST indexer's `filePath` for the same component
3. Edge cases: components without `_debugSource` (production build, dynamically generated), components defined in `node_modules`

---

## 9. Open Questions / Decisions Needed

### Q1: Intent storage — Supabase or in-memory only?

`push_intent` can either:
- **A) Write to Supabase** `intent_diffs` table, return an ID, allow polling via existing `get_pending_diffs`. Agent Bridge is stateless.
- **B) In-memory queue per WebSocket session**. Simpler, no DB write, but intents are lost if the agent disconnects.

Option A integrates with the existing diff workflow and gives the canvas visibility into `IMPLEMENTED` status. Option B is faster to ship but creates a parallel, disconnected system.

**Recommendation:** Option A. The existing `DiffStatus` enum (`DRAFT → EXPORTED → IMPLEMENTED → BLOCKED`) maps cleanly onto the intent lifecycle. The canvas already has diff-tracking UX built.

---

### Q2: Source of truth for component→file mapping — `_debugSource` or AST indexer?

| | `_debugSource` | AST Indexer |
|---|---|---|
| Availability | Dev builds only, present in fiber | Any .ts/.tsx file |
| Accuracy | Exact (React sets it) | High (AST, not heuristics) |
| Prop types | Not available | Full type extraction |
| Token refs | Not available | String-literal scan |
| Setup cost | Zero | CLI must be running |
| Fallback if absent | Graceful (no file info) | N/A — indexer is offline |

**Recommendation:** Use `_debugSource` as the primary source (always present if CLI is running in dev). Use AST indexer as enrichment (adds prop schema + token list). If neither is available, IntentMessage is valid but less specific.

---

### Q3: Snapshot capture — before only, or before + after?

Capturing a before-snapshot when the component is selected is straightforward (`html2canvas` or `getComputedStyle` snapshot). Capturing an after-snapshot requires waiting for the DOM patch to settle.

**Recommendation:** Capture before on component selection (cheap). Capture after on "Confirm" click with a 100ms delay to allow the DOM patch to apply. Make both optional — the agent can act on the textual change description alone.

---

### Q4: AST indexer scope — props only, or prop defaults too?

Extracting default values requires evaluating expressions (e.g., `const { size = 'md' } = props`). This touches type inference territory and can be expensive.

**Recommendation:** Phase 3 extracts prop names and types only. Default values are Phase 5+ once the basic pipeline is proven.

---

## 10. Non-Goals for This Iteration

- **Vue / Svelte support**: The fiber hook is React-specific. The DOM inspector (`buildDomInspectorScript`) is framework-agnostic but has no AST indexer equivalent. Out of scope.
- **Production build support**: `_debugSource` is dev-only. Intent messages from production artboards will lack source file info; the AST indexer can partially fill this gap via name matching.
- **Multi-file edits**: A single intent maps to a single component change. Refactoring that spans multiple files (e.g., extracting a token to a design system) is out of scope for Phase 1–4.
- **Automatic apply without agent**: The Agent Bridge is the exit point. We are not building a code-writing engine inside the canvas. The canvas describes intent; an agent with file access applies it.
