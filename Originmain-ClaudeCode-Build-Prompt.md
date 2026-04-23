# Originmain — Claude Code Build Prompt
## Layer-by-Layer Engineering Guide for AI Coding Agents

**Product:** Originmain — AI-Native Design Engineering Platform  
**Stack:** React 19 · Next.js 15 · Fluent UI v9 · TypeScript 5 · PostgreSQL · Supabase · Webpack Module Federation · MCP · Claude Sonnet 4  
**Renderer:** @pierre/diffs (code diff display) · @pierre/trees (codebase file browser)  
**Tooling:** pnpm workspaces · Vitest · Playwright · ESLint strict · Zod  
**Date:** April 2026  

---

## How to Read This Document

This prompt is structured as a strict sequence of layers. Each layer has a **goal**, a set of **files to create or modify**, a **verification gate** you must pass before proceeding, and **critical constraints** that must not be violated. Do not begin a layer until the previous layer's gate passes. Do not skip gates under any circumstances.

When you see `[FILE]`, create or modify that file. When you see `[VERIFY]`, run the specified command and confirm it passes before continuing. When you see `[CRITICAL]`, treat that constraint as a hard requirement — violations will cause downstream failure.

---

## Repository Bootstrap (Before Layer 0)

```bash
# Initialise the pnpm monorepo
mkdir originmain && cd originmain
git init
pnpm init
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# Create all package directories
mkdir -p packages/{app,renderer,diff-engine,origin-graph,ai-layer,agent-bridge,ui,integrations}
mkdir -p .github/workflows
```

The root `package.json` sets `"type": "module"` and declares the pnpm workspace. All packages share TypeScript 5 strict config via a root `tsconfig.base.json`. All packages run tests via a root `vitest.config.ts` with `projects` pointing to each package.

---

## Layer 0 — Infrastructure & DevOps

**Goal:** A working monorepo skeleton that CI can lint, type-check, build, and test. No product logic yet.

### 0.1 Root Configuration

**[FILE] `tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "react-jsx",
    "paths": {
      "@originmain/ui": ["./packages/ui/src/index.ts"],
      "@originmain/diff-engine": ["./packages/diff-engine/src/index.ts"],
      "@originmain/origin-graph": ["./packages/origin-graph/src/index.ts"],
      "@originmain/agent-bridge": ["./packages/agent-bridge/src/index.ts"],
      "@originmain/ai-layer": ["./packages/ai-layer/src/index.ts"],
      "@originmain/renderer": ["./packages/renderer/src/index.ts"],
      "@originmain/integrations": ["./packages/integrations/src/index.ts"]
    }
  }
}
```

**[FILE] `.github/workflows/ci.yml`**  
Define a GitHub Actions workflow named `CI` that runs on every pull request to `main`. It must execute these steps in strict sequence:
1. `pnpm install --frozen-lockfile`
2. `pnpm run typecheck` (runs `tsc --noEmit` in every package)
3. `pnpm run lint` (ESLint with `@typescript-eslint/strict` ruleset, zero warnings policy)
4. `pnpm run test` (Vitest across all packages, minimum 80% coverage on `diff-engine` and `origin-graph`)
5. `pnpm run build` (Next.js production build for `packages/app`)
6. `pnpm run migration:dry-run` (Supabase migration dry-run against production schema snapshot)

No step may be skipped or made non-blocking. The CI pipeline is the product's quality gate.

**[FILE] `.github/workflows/preview.yml`**  
A separate workflow that deploys a Vercel preview URL on every PR and posts it as a PR comment.

### 0.2 Supabase Project Setup

Create a `supabase/` directory at the monorepo root. Initialise it with `supabase init`. The `supabase/config.toml` sets:
- `project_id = "originmain-local"`
- `db.port = 54322`
- `studio.port = 54323`
- `api.port = 54321`

The local Supabase instance is started with `supabase start` and used by all local development. Staging and production use separate Supabase cloud projects.

### 0.3 Environment Variables

**[FILE] `.env.example`** — document every required variable:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
LIVEBLOCKS_SECRET_KEY=
LINEAR_WEBHOOK_SECRET=
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
AGENT_BRIDGE_PORT=3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never commit `.env.local`. Add it to `.gitignore`. The CI pipeline uses GitHub Actions secrets injected as environment variables.

**[VERIFY]** Run `pnpm install` and `pnpm run typecheck`. Both must exit 0.

---

## Layer 1 — Canvas UI Shell

**Goal:** A navigable Next.js app with the Fluent 2 chrome, a working infinite canvas viewport, and the two-surface navigation architecture (artboard navigator + codebase file browser). No artboard content yet — placeholder divs only.

### 1.1 Package Setup (`packages/app`)

Install core dependencies:
```bash
cd packages/app
pnpm add next@15 react@19 react-dom@19
pnpm add @fluentui/react-components @fluentui/react-icons
pnpm add @pierre/trees
pnpm add zustand immer
pnpm add @tanstack/react-query
pnpm add -D typescript @types/react @types/node
```

The Next.js app uses the App Router (`app/` directory). No Pages Router.

### 1.2 Root Layout and Fluent Provider

**[FILE] `packages/app/src/app/layout.tsx`**
```tsx
import { FluentProvider } from '@fluentui/react-components';
import { originmainTheme } from '@originmain/ui';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FluentProvider theme={originmainTheme}>
          {children}
        </FluentProvider>
      </body>
    </html>
  );
}
```

**[FILE] `packages/ui/src/themes/originmain-theme.ts`**  
Create the Originmain brand theme using `createLightTheme` from `@fluentui/react-components`. The brand palette anchors at `#0F52BA`. Map this colour to all 16 `BrandVariants` slots (10 through 160 in increments of 10), interpolating from a near-white tint at the 10 end to a near-black shade at the 160 end. Export as `originmainTheme` and also export `originmainDarkTheme` using `createDarkTheme` with the same brand variants.

**[CRITICAL]** The `FluentProvider` wraps the entire application. No component outside it uses Fluent 2 hooks or tokens. This is a hard constraint — Fluent 2's context system requires it.

### 1.3 Canvas Viewport

**[FILE] `packages/app/src/store/viewport.store.ts`**

A Zustand store that manages:
```typescript
interface ViewportState {
  panX: number;        // pixels
  panY: number;        // pixels
  zoom: number;        // 0.1 to 4.0
  setPan: (x: number, y: number) => void;
  setZoom: (level: number, originX: number, originY: number) => void;
  resetViewport: () => void;
}
```

The `setZoom` function adjusts `panX` and `panY` to keep the zoom origin stationary on screen (the same point under the cursor before and after zooming).

**[FILE] `packages/app/src/components/canvas/Canvas.tsx`**

A full-viewport div with `overflow: hidden` and a pointer-event handler that:
- On mouse drag (middle button or space+left): updates `setPan`
- On scroll wheel: calls `setZoom` with the wheel delta and current cursor position
- On pinch gesture (via `onPointerDown` multi-touch detection): calls `setZoom`

Inside, render a transform div:
```tsx
<div
  style={{
    transform: `matrix(${zoom}, 0, 0, ${zoom}, ${panX}, ${panY})`,
    transformOrigin: '0 0',
    willChange: 'transform',
  }}
>
  {children}
</div>
```

**[CRITICAL]** The canvas transform is applied via a CSS matrix to a single container. Never apply individual transforms to artboard elements. This is the only way to achieve 60fps pan/zoom without re-rendering artboard content.

### 1.4 Navigation Architecture

**[FILE] `packages/app/src/components/navigator/ArtboardNavigator.tsx`**

Uses Fluent 2's `Tree` and `TreeItem` components to render the workspace hierarchy:
- Workspace (root)
  - Project folders
    - Artboard groups
      - Individual artboards

Each `TreeItem` renders the artboard's origin badge (Linear issue, Git commit, User feedback, Manual) alongside its name. Clicking selects the artboard and centres the canvas viewport on it.

```typescript
// Data shape this component expects:
interface NavigatorNode {
  id: string;
  label: string;
  type: 'workspace' | 'folder' | 'group' | 'artboard';
  originType?: 'linear' | 'git' | 'feedback' | 'manual';
  children?: NavigatorNode[];
}
```

**[FILE] `packages/app/src/components/codebase/CodebaseFileTree.tsx`**

Uses `@pierre/trees` to render the connected application's repository file tree. This component is entirely separate from the artboard navigator — it lives in a collapsible side panel on the opposite side of the canvas.

```tsx
import { FileTree } from '@pierre/trees';

interface CodebaseFileTreeProps {
  nodes: FileTreeNode[];    // from the renderer's component tree extraction
  onFileSelect: (path: string) => void;
}

export function CodebaseFileTree({ nodes, onFileSelect }: CodebaseFileTreeProps) {
  return (
    <div
      className="codebase-file-tree"
      style={{
        // Map Fluent 2 tokens to @pierre/trees CSS custom properties
        '--tree-background': 'var(--colorNeutralBackground2)',
        '--tree-item-hover': 'var(--colorNeutralBackground3)',
        '--tree-item-selected': 'var(--colorBrandBackground2)',
        '--tree-text-color': 'var(--colorNeutralForeground1)',
        '--tree-secondary-text': 'var(--colorNeutralForeground3)',
        '--tree-git-added': 'var(--colorPaletteGreenForeground1)',
        '--tree-git-modified': 'var(--colorPaletteYellowForeground1)',
        '--tree-git-deleted': 'var(--colorPaletteRedForeground1)',
      } as React.CSSProperties}
    >
      <FileTree
        nodes={nodes}
        gitStatus={true}
        flattenEmptyDirectories={true}
        fileTreeSearchMode="filter"
        onSelect={(node) => node.type === 'file' && onFileSelect(node.path)}
      />
    </div>
  );
}
```

**[CRITICAL]** The CSS custom property names above match the ones @pierre/trees exposes for theming. Verify against the @pierre/trees documentation before shipping. Never hardcode colour values — always reference Fluent 2 tokens.

### 1.5 Chrome Layout

**[FILE] `packages/app/src/app/(workspace)/layout.tsx`**

A three-column layout: left panel (ArtboardNavigator, 240px), centre (Canvas, flex 1), right panel (Inspector + CodebaseFileTree, 320px). All panels use Fluent 2's `makeStyles` from Griffel for styling. No external CSS files.

Fluent 2 Toolbar across the top with these tool groups (left to right): Workspace name, Select tool, Pan tool, Artboard tools (new, duplicate, fork), AI tools (Completion Zone trigger), Export, Settings.

**[VERIFY]** `pnpm run build` passes. `pnpm run dev` opens the canvas in a browser with visible toolbar, left panel, and right panel. Panning and zooming work.

---

## Layer 2 — Live Rendering Engine

**Goal:** Originmain can connect to a running Next.js application, render one of its routes as a Live Artboard in the canvas, and extract the component tree from the rendered iframe.

### 2.1 Package Setup (`packages/renderer`)

```bash
cd packages/renderer
pnpm add react@19 react-dom@19
pnpm add -D webpack@5 @module-federation/enhanced
pnpm add -D typescript zod
```

### 2.2 The Renderer Protocol

**[FILE] `packages/renderer/src/protocol.ts`**

Define the message contract between the iframe and the host application:

```typescript
export type RendererMessage =
  | { type: 'COMPONENT_TREE_READY'; payload: ComponentTreeNode }
  | { type: 'COMPONENT_SELECTED'; payload: { componentId: string; rect: DOMRect } }
  | { type: 'THEME_INJECTED'; payload: { success: boolean } }
  | { type: 'ROUTE_CHANGED'; payload: { path: string } }
  | { type: 'RENDER_ERROR'; payload: { message: string; stack?: string } };

export type HostMessage =
  | { type: 'SELECT_COMPONENT'; payload: { componentId: string } }
  | { type: 'INJECT_THEME'; payload: { tokens: Record<string, string> } }
  | { type: 'NAVIGATE'; payload: { path: string } }
  | { type: 'REQUEST_TREE' };

export interface ComponentTreeNode {
  id: string;                      // stable ID derived from fiber key + display name
  displayName: string;             // React component display name
  filePath?: string;               // source file path (from sourcemaps)
  props: Record<string, unknown>;  // serialisable props only
  rect: DOMRect;                   // bounding rect at render time
  designTokens?: Record<string, string>;  // resolved Fluent 2 token values
  children: ComponentTreeNode[];
}
```

All messages are validated with Zod schemas before processing. Invalid messages are silently dropped.

### 2.3 The Fiber Tree Injector

**[FILE] `packages/renderer/src/fiber-injector.ts`**

A script injected into the iframe before the remote application initialises. It hooks into React's DevTools global hook (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) to intercept the Fiber tree after each render commit. From the Fiber tree, it extracts `ComponentTreeNode` records by walking the `child` / `sibling` / `return` fiber links. It posts the extracted tree to the parent frame via `window.parent.postMessage`.

**[CRITICAL]** This injector must never import React or any application code — it runs in the iframe's global scope and must be a plain IIFE. It reads from the global hook only, produces a serialisable data structure, and posts it. Do not access `fiber.stateNode` beyond reading its bounding rect.

### 2.4 The Artboard Iframe Wrapper

**[FILE] `packages/app/src/components/artboard/ArtboardFrame.tsx`**

```tsx
interface ArtboardFrameProps {
  artboardId: string;
  remoteUrl: string;   // URL of the connected app's Module Federation entry
  route: string;       // path to render (e.g., '/dashboard')
  width: number;
  height: number;
}
```

The component renders an `<iframe>` with:
```
sandbox="allow-scripts allow-same-origin allow-forms"
```

Before setting `src`, it injects the fiber injector script via the `srcdoc` attribute (a minimal HTML shell that loads the injector, then redirects to the remote app). The component listens for `RendererMessage` via `window.addEventListener('message', ...)`, validates each message against the Zod schema, and dispatches the payload to the artboard Zustand store.

An overlay `<div>` positioned absolutely over the iframe at the same dimensions intercepts pointer events for the visual editing system (Layer 3).

### 2.5 Module Federation Configuration

**[FILE] `packages/renderer/webpack.config.ts`**

Configure Webpack 5 with `@module-federation/enhanced`'s `ModuleFederationPlugin`. Originmain acts as the host (`name: 'originmain'`). Connected applications register as remotes. The remote URL is set dynamically at runtime from the artboard's `remoteUrl` prop.

Document the configuration that connected apps must add to their own webpack config to expose themselves as a Module Federation remote. This configuration lives at `packages/renderer/docs/connected-app-setup.md`.

### 2.6 Rendering Triggers

**[FILE] `packages/app/src/components/artboard/ArtboardIngestionPanel.tsx`**

A Fluent 2 `Drawer` component that presents four artboard creation paths:

1. **App Route**: Input a URL path from the connected application. The renderer loads that route in the iframe.
2. **Linear Issue**: Input a Linear issue ID. The ingestion connector fetches the issue, extracts the linked screenshot or route, and pre-populates the artboard with issue metadata.
3. **Git Commit**: Input a commit SHA. The ingestion connector checks out that revision of the connected app and renders the specified route at that point in history.
4. **Manual / Blank**: Creates an empty artboard with a placeholder iframe and no origin.

Each path calls `POST /api/artboards` with the appropriate origin payload. The API validates the payload with Zod, creates the artboard record in the Origin Graph, and returns the artboard ID. The canvas then renders a new `ArtboardFrame` at a default position.

**[VERIFY]** With a local Next.js test app running (any basic Next.js starter) configured as a Module Federation remote, Originmain can render its `/` route as a Live Artboard. The component tree is extracted and visible in the browser console. No CSP errors.

---

## Layer 3 — Visual Editing & Diff Engine

**Goal:** A user can click a component in a rendered artboard, modify its visual properties (colour, padding, component swap), and the system produces a correctly typed `IntentDiff` for every change. The code-level diff renders in the export panel using @pierre/diffs.

### 3.1 Package Setup (`packages/diff-engine`)

```bash
cd packages/diff-engine
pnpm add typescript-estree @babel/parser
pnpm add -D vitest typescript
```

No @pierre/diffs here — the diff engine is the computation layer only. @pierre/diffs is installed in `packages/app` for rendering.

```bash
cd packages/app
pnpm add @pierre/diffs
```

### 3.2 The Intent Diff Schema

**[FILE] `packages/diff-engine/src/types.ts`**

```typescript
import { z } from 'zod';

export const ComponentChangeSchema = z.object({
  componentId: z.string(),
  displayName: z.string(),
  filePath: z.string().optional(),
  changeType: z.enum(['prop_change', 'component_swap', 'layout_change', 'token_change', 'removal', 'insertion']),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
  humanSummary: z.string(),   // AI-generated: "Replace secondary button with primary button"
});

export const IntentDiffSchema = z.object({
  id: z.string().uuid(),
  artboardId: z.string().uuid(),
  timestamp: z.string().datetime(),
  authorId: z.string(),
  sessionId: z.string(),
  changes: z.array(ComponentChangeSchema).min(1),
  aggregateSummary: z.string(),   // AI-generated summary of all changes combined
  beforeScreenshot: z.string().url().optional(),
  afterScreenshot: z.string().url().optional(),
  exportedCode: z.string().optional(),  // generated TypeScript/JSX expressing the changes
  status: z.enum(['draft', 'exported', 'acknowledged', 'implemented', 'rejected']),
});

export type IntentDiff = z.infer<typeof IntentDiffSchema>;
export type ComponentChange = z.infer<typeof ComponentChangeSchema>;
```

### 3.3 The AST Differ

**[FILE] `packages/diff-engine/src/ast-differ.ts`**

The core computation engine. Takes two `ComponentTreeNode` snapshots (before and after a visual edit) and produces an array of `ComponentChange` records.

```typescript
export function computeIntentDiff(
  before: ComponentTreeNode,
  after: ComponentTreeNode,
  sessionId: string,
  authorId: string
): IntentDiff
```

The differ performs a depth-first tree walk, matching nodes by their stable `id`. For each matched pair:

- **Prop change**: any prop value differs → `changeType: 'prop_change'`, `before: { [propName]: oldValue }`, `after: { [propName]: newValue }`
- **Token change**: a design token reference in a prop changes → `changeType: 'token_change'`
- **Layout change**: position or size changes (derived from `rect` delta) → `changeType: 'layout_change'`
- **Component swap**: `displayName` differs for same `id` → `changeType: 'component_swap'`
- **Insertion**: node exists in `after` but not `before` → `changeType: 'insertion'`
- **Removal**: node exists in `before` but not `after` → `changeType: 'removal'`

The `humanSummary` field for each change is initially generated by a simple rule-based string template (e.g., `"Changed ${propName} on ${displayName} from ${oldValue} to ${newValue}"`). The AI layer (Layer 6) upgrades these summaries to natural language. Until Layer 6 is complete, the template strings are the source of truth.

**[CRITICAL]** The AST differ has zero dependencies on React, the browser, or any UI library. It is a pure function: `(before, after, meta) => IntentDiff`. This must be enforced with an ESLint no-restricted-imports rule in `packages/diff-engine/.eslintrc.json`.

### 3.4 Visual Editing Overlay

**[FILE] `packages/app/src/components/artboard/EditingOverlay.tsx`**

An absolutely positioned transparent div rendered over the artboard iframe. It receives the `ComponentTreeNode` from the artboard store and renders:

- A selection indicator (Fluent 2 border-style outline at the selected component's rect)
- Eight resize handles at the corners and midpoints
- A component picker popover (Fluent 2 `Popover` with `Combobox`) for component swapping

When the user drags a resize handle, the overlay translates the pixel delta into a prop change on the target component. It then takes a new snapshot of the iframe's component tree and calls `computeIntentDiff` with the before and after snapshots.

Every completed edit appends a new `ComponentChange` to the session's running `IntentDiff` in the artboard Zustand store.

### 3.5 Diff Inspector Sidebar

**[FILE] `packages/app/src/components/inspector/DiffInspector.tsx`**

Renders the current session's `IntentDiff` as a structured panel in the right column using Fluent 2 components:

- `Card` + `CardHeader`: artboard name, author, timestamp
- `Accordion` + `AccordionItem`: one item per `ComponentChange`, expanded by default
- Each `AccordionItem` body shows: `displayName`, `changeType` badge, before/after prop values in a two-column layout
- `aggregateSummary` in a `MessageBar` at the top of the panel
- "Export Diff" `Button` (primary) at the bottom

**[FILE] `packages/app/src/components/diff/CodeDiffPanel.tsx`**

The code-level diff view shown when the user clicks "Export Diff". Rendered inside a Fluent 2 `Drawer` (large, from the right edge).

```tsx
import { FileDiff, MultiFileDiff } from '@pierre/diffs/react';

interface CodeDiffPanelProps {
  diff: IntentDiff;
  isOpen: boolean;
  onClose: () => void;
}

export function CodeDiffPanel({ diff, isOpen, onClose }: CodeDiffPanelProps) {
  // Map IntentDiff changes to file-based diff format expected by @pierre/diffs
  const fileDiffs = mapIntentDiffToFileDiffs(diff);

  return (
    <Drawer type="overlay" position="end" size="large" open={isOpen} onOpenChange={onClose}>
      <DrawerHeader>
        <DrawerHeaderTitle>Code Changes</DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div
          style={{
            '--diff-background': 'var(--colorNeutralBackground1)',
            '--diff-gutter-background': 'var(--colorNeutralBackground2)',
            '--diff-added-line': 'var(--colorPaletteGreenBackground1)',
            '--diff-removed-line': 'var(--colorPaletteRedBackground1)',
            '--diff-annotation-color': 'var(--colorNeutralForeground3)',
          } as React.CSSProperties}
        >
          <MultiFileDiff
            diffs={fileDiffs}
            mode="split"                     // side-by-side: before | after
            theme="github-light"             // matches webLightTheme; dark variant uses github-dark-dimmed
            annotations={buildAnnotations(diff)}  // line-anchored Intent Diff summaries
          />
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" onClick={() => exportToAgent(diff)}>
          Send to Coding Agent
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
```

**[FILE] `packages/app/src/components/diff/diff-mappers.ts`**  
Implement `mapIntentDiffToFileDiffs(diff: IntentDiff)` and `buildAnnotations(diff: IntentDiff)`.

`mapIntentDiffToFileDiffs` converts `ComponentChange` records to the file diff format @pierre/diffs expects. Each change that has a known `filePath` becomes a separate file in the `MultiFileDiff`. Changes without a `filePath` are grouped under a synthetic file called `intent-diff.tsx` that shows the structural prop-level changes.

`buildAnnotations` anchors each `humanSummary` string to the line number of its corresponding change in the rendered diff. This produces the connected "design intent → code line" view that is Originmain's signature export experience.

**[CRITICAL]** The mode (`"split"` vs `"stacked"`) must respond to the drawer width. Use a `ResizeObserver` on the drawer body: if width < 640px, switch to `"stacked"`. This is not optional — split mode is unreadable at narrow widths.

**[VERIFY]** Make a visual change (e.g., change a button's `appearance` prop from `"secondary"` to `"primary"` by clicking it in the editing overlay). Confirm:
1. The DiffInspector shows the change with correct `displayName` and prop values
2. "Export Diff" opens the Drawer with a rendered code diff
3. The `humanSummary` text is visible as an annotation anchored to the relevant line
4. The diff correctly reflects only the changed prop, not unrelated code

---

## Layer 4 — Origin Graph & Data Store

**Goal:** All artboard metadata, provenance, and intent diffs are persisted in PostgreSQL and queryable via the GraphQL API.

### 4.1 Database Schema

**[FILE] `supabase/migrations/001_origin_graph.sql`**

```sql
-- Workspaces
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    text not null,  -- Clerk user ID
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Artboards
create table artboards (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  parent_id       uuid references artboards(id),  -- null for root artboards
  route           text,         -- the app route this artboard renders
  remote_url      text,         -- the Module Federation remote URL
  width           integer not null default 1440,
  height          integer not null default 900,
  created_by      text not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Origins — the provenance record for every artboard
create table origins (
  id              uuid primary key default gen_random_uuid(),
  artboard_id     uuid not null references artboards(id) on delete cascade,
  origin_type     text not null check (origin_type in ('route', 'linear', 'git', 'slack', 'feedback', 'fork', 'manual')),
  source_id       text,        -- Linear issue ID, Git SHA, Slack message TS, etc.
  source_url      text,
  source_metadata jsonb,       -- arbitrary origin-specific context
  screenshot_url  text,
  created_at      timestamptz default now()
);

-- Intent Diffs
create table intent_diffs (
  id                  uuid primary key default gen_random_uuid(),
  artboard_id         uuid not null references artboards(id) on delete cascade,
  author_id           text not null,
  session_id          text not null,
  changes             jsonb not null,   -- ComponentChange[]
  aggregate_summary   text not null,
  before_screenshot   text,
  after_screenshot    text,
  exported_code       text,
  status              text not null default 'draft'
                        check (status in ('draft','exported','acknowledged','implemented','rejected')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Agent sessions (for the Agent Bridge)
create table agent_sessions (
  id              uuid primary key default gen_random_uuid(),
  artboard_id     uuid not null references artboards(id),
  diff_id         uuid references intent_diffs(id),
  agent_type      text not null,   -- 'cursor', 'claude-code', 'generic'
  status          text not null default 'pending',
  messages        jsonb not null default '[]',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Design Language Files
create table design_language_files (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  content         jsonb not null,
  is_active       boolean not null default true,
  created_by      text not null,
  created_at      timestamptz default now()
);

-- Row-level security (enable on all tables)
alter table workspaces enable row level security;
alter table artboards enable row level security;
alter table origins enable row level security;
alter table intent_diffs enable row level security;
alter table agent_sessions enable row level security;
alter table design_language_files enable row level security;

-- RLS policies (workspace membership check via Clerk JWT claim)
create policy "workspace members can access" on workspaces
  for all using (owner_id = auth.uid()::text);

-- ... (create equivalent policies for all other tables referencing workspace_id)
```

### 4.2 TypeScript Client (`packages/origin-graph`)

**[FILE] `packages/origin-graph/src/client.ts`**  
A thin typed wrapper around `@supabase/supabase-js` that exposes CRUD functions for each table. All functions are fully typed against the Zod schemas from `packages/diff-engine`. No raw SQL in application code — all queries go through this client.

**[FILE] `packages/origin-graph/src/queries.ts`**  
Implement these queries:
- `getArtboardsByWorkspace(workspaceId: string): Promise<Artboard[]>`
- `getOriginGraph(artboardId: string): Promise<{ artboard: Artboard; origin: Origin; diffs: IntentDiff[] }>`
- `getDiffsByStatus(workspaceId: string, status: IntentDiff['status']): Promise<IntentDiff[]>`
- `searchArtboards(workspaceId: string, query: string): Promise<Artboard[]>` — uses Supabase full-text search on `name`, `route`, and `jsonb` metadata fields

**[VERIFY]** `pnpm run migration:apply` on a fresh local Supabase instance completes without errors. `supabase db diff` shows zero unexpected schema changes. All TypeScript types resolve without errors.

---

## Layer 5 — Design Language Runtime

**Goal:** Teams can upload a Design Language File. The runtime loads it and uses it to validate visual edits and AI completions in real time.

### 5.1 Design Language File Schema

**[FILE] `packages/diff-engine/src/design-language.schema.ts`**

```typescript
export const DesignLanguageFileSchema = z.object({
  version: z.literal('1.0'),
  tokens: z.object({
    colors: z.record(z.string()),       // name → hex or token reference
    typography: z.record(z.string()),
    spacing: z.record(z.string()),
    motion: z.record(z.string()).optional(),
  }),
  components: z.record(z.object({
    allowedProps: z.record(z.array(z.string())).optional(),   // prop → allowed values
    forbiddenVariants: z.array(z.string()).optional(),
    requiredAria: z.array(z.string()).optional(),
  })),
  screens: z.record(z.object({
    allowedComponents: z.array(z.string()).optional(),
    forbiddenComponents: z.array(z.string()).optional(),
    requiredSections: z.array(z.string()).optional(),
  })).optional(),
  voice: z.object({
    tone: z.array(z.string()),
    avoidWords: z.array(z.string()).optional(),
  }).optional(),
  accessibility: z.object({
    minContrastRatio: z.number().default(4.5),
    minTouchTargetPx: z.number().default(44),
    requireAltText: z.boolean().default(true),
  }).optional(),
});
```

### 5.2 Validation Engine

**[FILE] `packages/diff-engine/src/design-language-validator.ts`**

```typescript
export interface ValidationResult {
  valid: boolean;
  violations: DesignViolation[];
}

export interface DesignViolation {
  componentId: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export function validateChange(
  change: ComponentChange,
  dlf: DesignLanguageFile,
): ValidationResult
```

The validator checks each `ComponentChange` against the active Design Language File. Violations are returned as an array — they do not block the edit but are shown as inline annotations on the artboard (Fluent 2 `Badge` with `appearance="filled"` and `color="warning"` or `color="danger"`).

**[VERIFY]** Upload a Design Language File via the settings panel. Make a visual edit that violates a constraint (e.g., set a component's colour to a value not in the token palette). Confirm a warning annotation appears on the artboard.

---

## Layer 6 — AI Completion Layer

**Goal:** AI Completion Zones work end-to-end. Visual edit summaries are upgraded to natural language. The Claude Sonnet 4 API is the only AI provider.

### 6.1 Package Setup (`packages/ai-layer`)

```bash
cd packages/ai-layer
pnpm add @anthropic-ai/sdk
pnpm add -D typescript zod
```

**[CRITICAL]** No AI calls are made from the frontend. All Claude API calls go through `packages/ai-layer`. The Next.js app calls `packages/ai-layer` via tRPC server-side routes only. The Anthropic API key is never exposed to the browser.

### 6.2 The AI Gateway

**[FILE] `packages/ai-layer/src/gateway.ts`**

A class `AIGateway` that wraps the Anthropic SDK with:
- API key validation on construction
- Request ID tracking for cost attribution per workspace
- Rate limit handling with exponential backoff (max 3 retries)
- Structured logging of every request (model, token count, cost estimate, latency)
- A prompt version registry: all prompts are versioned strings imported from `packages/ai-layer/src/prompts/`

```typescript
class AIGateway {
  async generateDiffSummary(changes: ComponentChange[], dlf?: DesignLanguageFile): Promise<string>
  async fillCompletionZone(zone: CompletionZoneSpec, dlf: DesignLanguageFile): Promise<CompletionZoneResult>
  async queryArtboards(query: string, workspaceContext: WorkspaceContext): Promise<string>
  async answerAgentQuery(question: string, diff: IntentDiff, dlf: DesignLanguageFile): Promise<string>
}
```

### 6.3 Prompt Files

**[FILE] `packages/ai-layer/src/prompts/diff-summary.prompt.ts`**  
The system prompt for generating `humanSummary` strings for `ComponentChange` records and the `aggregateSummary` for full `IntentDiff` records.

Structure: system message that includes the Design Language File (if available) and instructs the model to describe changes in terms of user-visible impact, not technical prop names. Temperature 0.2. Max tokens 300 per change, 500 for aggregate.

**[FILE] `packages/ai-layer/src/prompts/completion-zone.prompt.ts`**  
The system prompt for filling Completion Zones. Includes: the team's DLF as a hard constraint block, the component tree context of the surrounding region, any user-provided reference screenshot, and the zone intent string. Temperature 0.3. Output is a structured JSON response validated against a Zod schema before being accepted.

**[FILE] `packages/ai-layer/src/prompts/agent-query.prompt.ts`**  
The system prompt for answering coding agent questions through the Agent Bridge. Includes: the full IntentDiff as context, before/after screenshots, and the DLF. Temperature 0.1 (factual, not creative). The model's role is "design agent" — it speaks with authority about design intent and can answer questions like "Is 16px or 24px padding intended here?" directly from the IntentDiff data.

### 6.4 Completion Zone UI

**[FILE] `packages/app/src/components/canvas/CompletionZone.tsx`**

A React component rendered in the UI chrome layer (above the canvas, pointer-events enabled) as a dashed-border rectangle that the designer draws over a region of the artboard. Internally it uses:

- `useRef` to track the drawing gesture
- A `Popover` (Fluent 2) for the intent input form
- An `Input` + `Textarea` for the intent string and optional reference description
- A `Button` (primary) "Generate" that calls the tRPC mutation `completionZone.generate`
- A preview overlay showing the AI-generated completion on the artboard
- `Button` pair: "Accept" (commits to IntentDiff) and "Reject" (discards)

**[VERIFY]** Mark a region of an artboard as a Completion Zone, enter an intent like "Fill this table with 5 rows of realistic customer data matching the existing column structure", and click Generate. The AI response should appear as a preview overlay within 8 seconds. Accepting it should add a `ComponentChange` with `changeType: 'insertion'` to the session's IntentDiff.

---

## Layer 7 — Agent Bridge (MCP)

**Goal:** A running MCP server that a Cursor or Claude Code instance can connect to, receive Intent Diffs, and send implementation status back to Originmain.

### 7.1 Package Setup (`packages/agent-bridge`)

```bash
cd packages/agent-bridge
pnpm add @modelcontextprotocol/sdk
pnpm add ws zod
pnpm add -D typescript
```

### 7.2 MCP Server Tools

**[FILE] `packages/agent-bridge/src/server.ts`**

An MCP server built with `@modelcontextprotocol/sdk`. Register these tools:

```typescript
// Returns the latest exported IntentDiff for a connected artboard
tool: 'get_intent_diff'
input: { artboard_id: string }
output: IntentDiff

// Returns component tree for a specific artboard
tool: 'get_component_tree'
input: { artboard_id: string }
output: ComponentTreeNode

// Returns the active Design Language File for the connected workspace
tool: 'get_design_language'
input: { workspace_id: string }
output: DesignLanguageFile

// The coding agent reports its implementation status
tool: 'report_status'
input: { diff_id: string; status: 'implemented' | 'blocked' | 'needs_clarification'; message?: string }
output: { acknowledged: boolean }

// The coding agent asks the design agent a clarifying question
tool: 'ask_design_agent'
input: { diff_id: string; question: string }
output: { answer: string }  // AI-generated via packages/ai-layer
```

The `ask_design_agent` tool calls `AIGateway.answerAgentQuery` with the diff's full context. The answer is returned synchronously to the coding agent.

### 7.3 Cursor Adapter

**[FILE] `packages/agent-bridge/src/adapters/cursor.ts`**

Generates a `.cursorrules` file and `cursor_settings.json` MCP server configuration for a connected workspace. The `.cursorrules` content instructs Cursor to query Originmain's MCP server before making any UI-related code change and to report back when each change is applied.

### 7.4 Claude Code Adapter

**[FILE] `packages/agent-bridge/src/adapters/claude-code.ts`**

Generates a `CLAUDE.md` preamble and an MCP server declaration for Claude Code. The `CLAUDE.md` preamble instructs Claude Code to treat the `get_intent_diff` and `get_design_language` tools as primary sources of truth for all UI work.

### 7.5 Status Sync

When `report_status` is called, the Agent Bridge:
1. Updates `intent_diffs.status` in the Origin Graph via `packages/origin-graph`
2. Broadcasts a real-time update to the connected Originmain canvas via Supabase Realtime
3. The canvas updates the corresponding artboard's component badges (Fluent 2 `PresenceBadge`) to reflect the new status

**[VERIFY]** Start the MCP server with `node packages/agent-bridge/dist/server.js`. Configure a local Claude Code session to connect to it. Run `get_intent_diff` from the Claude Code session and confirm the correct IntentDiff is returned. Call `report_status` with `status: 'implemented'` and confirm the artboard badge updates in the Originmain canvas.

---

## Layer 8 — Integrations (Multi-Origin Ingestion)

**Goal:** Artboards can be created from Linear issues, Slack screenshots, and Git commit renders. Each integration is an isolated connector.

### 8.1 Shared Interface (`packages/integrations`)

**[FILE] `packages/integrations/src/types.ts`**

```typescript
export interface OriginIngester<TSource> {
  validate(source: TSource): Promise<boolean>;
  ingest(source: TSource): Promise<Origin>;
}

export interface Origin {
  type: 'linear' | 'slack' | 'git' | 'feedback';
  sourceId: string;
  sourceUrl: string;
  metadata: Record<string, unknown>;
  screenshotUrl?: string;
  suggestedRoute?: string;   // the app route this origin most likely relates to
}
```

### 8.2 Linear Connector

**[FILE] `packages/integrations/src/linear/index.ts`**

Uses `@linear/sdk` to fetch the issue by ID. Extracts: title, description, priority, assignee, linked screenshots or attachments, labels, and team. Returns an `Origin` with all this data in `metadata`. If the issue has an attached screenshot, store it and return the URL as `screenshotUrl`. If the issue body contains a route reference (e.g., `/settings/billing`), extract it as `suggestedRoute`.

### 8.3 Slack Connector

**[FILE] `packages/integrations/src/slack/index.ts`**

Uses `@slack/bolt` to handle webhook events. On a message containing a screenshot or URL, downloads the attachment and stores it. Extracts the message text and sender identity into the origin metadata. The Slack connector runs as a serverless function behind a webhook endpoint.

### 8.4 Git Connector

**[FILE] `packages/integrations/src/git/index.ts`**

Uses `@octokit/rest` to fetch the diff between a given commit SHA and the previous commit. Identifies changed files that are React components (`.tsx`, `.jsx`). Returns an `Origin` with the commit message, author, timestamp, and changed file paths. The `suggestedRoute` is derived from the route mapping in the connected app's Next.js config if available.

**[VERIFY]** Create an artboard from a real Linear issue in a test Linear workspace. Confirm the artboard's metadata panel shows the issue title, description, and a link to the original issue.

---

## Layer 9 — Multiplayer & Presence (Phase 3)

**Goal:** Multiple users can work on the same workspace simultaneously. Cursors, selections, and artboard edits are synchronised in real time without conflicts.

### 9.1 Liveblocks Setup

```bash
cd packages/app
pnpm add @liveblocks/client @liveblocks/react @liveblocks/react-ui
```

**[FILE] `packages/app/src/liveblocks.config.ts`**

Define the Liveblocks type system:
```typescript
import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';

type Presence = {
  cursor: { x: number; y: number } | null;
  activeArtboardId: string | null;
  selectedComponentId: string | null;
  userInfo: { name: string; avatarUrl: string; color: string };
};

type Storage = {
  artboards: LiveMap<string, LiveObject<ArtboardState>>;
};
```

One Liveblocks room per workspace. The room name is `workspace-${workspaceId}`.

### 9.2 Presence Rendering

**[FILE] `packages/app/src/components/canvas/PresenceLayer.tsx`**

Renders other users' cursors as Fluent 2 `Avatar` components with a pointer indicator, positioned absolutely at their reported canvas coordinates. Updates at a 50ms throttle (Liveblocks' recommended rate). Each cursor fades out after 3 seconds of no movement.

**[VERIFY]** Open two browser sessions in the same workspace. Confirm cursor positions update in both sessions. Confirm making an artboard edit in session A is reflected in session B within 100ms.

---

## Layer 10 — Cross-Artboard Querying & Drift Detection (Phase 3)

**Goal:** Natural-language queries across the artboard workspace return relevant results. Design system drift is automatically detected and corrective diffs are generated.

### 10.1 Search Infrastructure

**[FILE] `supabase/migrations/008_search.sql`**

Add a generated `tsvector` column to `artboards` and `origins` for full-text search. Create a GIN index on both. Add a PostgreSQL function `search_artboards(query text, workspace_id uuid)` that performs weighted full-text search across names, route paths, origin metadata, and diff summaries.

### 10.2 Natural Language Query

**[FILE] `packages/ai-layer/src/prompts/workspace-query.prompt.ts`**

The system prompt for natural-language artboard queries. The model receives: the user's query, the workspace's artboard list (names + routes + origin types + creation dates), and the Design Language File. It returns a structured filter object that maps to the PostgreSQL search query. Temperature 0.1.

Example: "Show me every artboard linked to a user complaint this sprint" → `{ originType: 'feedback', dateAfter: '<sprint start>', dateRange: '<sprint end>' }`

### 10.3 Drift Detection

**[FILE] `packages/diff-engine/src/drift-detector.ts`**

```typescript
export function detectDrift(
  liveComponentTree: ComponentTreeNode,
  dlf: DesignLanguageFile,
): DriftReport
```

Walks the live component tree and compares each component's resolved design token values against the DLF's token definitions. Identifies:
- Components using deprecated tokens (tokens that existed in an older DLF version)
- Components using non-DLF colours (hardcoded hex or RGB values)
- Components using forbidden variants
- Layout violations (spacing values not in the DLF spacing scale)

The `DriftReport` lists each violation with enough context (componentId, filePath, offending value, correct value) to generate a corrective `IntentDiff` automatically.

---

## Layer 11 — Testing Strategy

**Goal:** The 10 critical E2E journeys all pass. Coverage gates are met.

### 11.1 Unit Tests (Vitest)

All unit tests live in `__tests__/` directories alongside the code they test. Required coverage:

- `packages/diff-engine`: 90% line coverage. The AST differ, validator, and drift detector are pure functions and are fully testable without a browser.
- `packages/origin-graph`: 85% coverage on query functions (mock Supabase client).
- `packages/ai-layer`: 80% coverage on gateway and prompt functions (mock Anthropic SDK).
- `packages/agent-bridge`: 85% coverage on MCP tool handlers.

### 11.2 E2E Tests (Playwright)

**[FILE] `e2e/critical-journeys.spec.ts`**

Implement Playwright tests for all 10 critical journeys documented in the Implementation Guide. Each test uses a dedicated Supabase project (provisioned per test run in CI) and a Module Federation test app (`e2e/test-app/`).

The test app is a minimal Next.js app with 3 routes (`/`, `/dashboard`, `/settings`) and 5 components. It is deterministic and produces known component trees — this makes diff assertions exact rather than approximate.

**[VERIFY]** `pnpm run test:e2e` passes all 10 journeys in under 5 minutes.

---

## Performance Targets (Verify Before Each Phase Ships)

| Metric | Target | Measurement |
|---|---|---|
| Canvas 60fps pan/zoom | < 2ms frame budget for transform application | Chrome DevTools Performance panel |
| Artboard first render | < 3s from iframe src set to component tree extraction | `performance.mark()` in the renderer protocol |
| Intent Diff computation | < 100ms for trees up to 500 nodes | Vitest benchmark in diff-engine |
| @pierre/diffs first paint | < 200ms for diffs up to 50 files | Playwright `page.coverage()` |
| @pierre/trees 5,000 nodes | < 50ms initial render | Playwright performance trace |
| AI Completion Zone (p50) | < 6s wall clock | Gateway request log |
| MCP tool response | < 200ms for read tools, < 500ms for write tools | Agent Bridge integration test |

---

## Security Checklist (Review Before Each Production Deployment)

- [ ] Iframe sandbox attribute contains exactly `allow-scripts allow-same-origin allow-forms` — no additions without security review
- [ ] All postMessage handlers validate origin against an allowlist of known remote URLs
- [ ] All postMessage payloads are validated with Zod before processing
- [ ] The Anthropic API key is never in any client bundle — verify with `pnpm run build && grep -r "sk-ant" .next/` (must return zero results)
- [ ] RLS policies prevent cross-workspace data access — verify with a Supabase policy test that a workspace A user cannot read workspace B data
- [ ] The MCP server validates the `workspace_id` in every tool call against the authenticated session
- [ ] Design Language Files are validated against the JSON Schema before storage — malformed files are rejected with a user-facing error, not silently stored
- [ ] All external URLs (Linear, Slack, Git) fetched via integrations are proxied server-side — never fetched client-side

---

## Appendix: Package Dependency Map

```
packages/app
  ├── @originmain/ui
  ├── @originmain/diff-engine
  ├── @originmain/origin-graph
  ├── @originmain/ai-layer (server-side only, via tRPC)
  ├── @originmain/agent-bridge (MCP client config only)
  ├── @originmain/renderer
  ├── @originmain/integrations (server-side only)
  ├── @fluentui/react-components
  ├── @pierre/diffs
  └── @pierre/trees

packages/diff-engine
  └── zod (no UI dependencies — enforced by ESLint)

packages/origin-graph
  ├── @supabase/supabase-js
  ├── @originmain/diff-engine
  └── zod

packages/ai-layer
  ├── @anthropic-ai/sdk
  ├── @originmain/diff-engine
  └── zod

packages/agent-bridge
  ├── @modelcontextprotocol/sdk
  ├── @originmain/diff-engine
  ├── @originmain/origin-graph
  └── @originmain/ai-layer

packages/renderer
  ├── @module-federation/enhanced
  └── zod

packages/integrations
  ├── @linear/sdk
  ├── @slack/bolt
  ├── @octokit/rest
  └── @originmain/origin-graph

packages/ui
  └── @fluentui/react-components
```

---

*End of Originmain Claude Code Build Prompt — v1.0 — April 2026*
