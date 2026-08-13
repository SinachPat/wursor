# Implementation Guide — Wursor v1

**Version:** 1.0  
**Source:** [PRD.md](./PRD.md) v1.2  
**Method:** Test-driven development (TDD) — every module is written against its tests before its implementation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Build Phases](#3-build-phases)
4. [Phase 1 — Foundation (Weeks 1–8)](#4-phase-1--foundation-weeks-18)
   - [Sprint 1: Electron shell + project scaffold](#sprint-1-electron-shell--project-scaffold)
   - [Sprint 2: wp-env runtime manager](#sprint-2-wp-env-runtime-manager)
   - [Sprint 3: Agent tool bus](#sprint-3-agent-tool-bus)
   - [Sprint 4: Agent chat + diff review](#sprint-4-agent-chat--diff-review)
   - [Sprint 5: WP-CLI tool + permission engine](#sprint-5-wp-cli-tool--permission-engine)
   - [Sprint 6: P0 playbooks + first-run](#sprint-6-p0-playbooks--first-run)
   - [Sprint 7: Integration + exit criteria](#sprint-7-integration--exit-criteria)
   - [Sprint 8: Polish + alpha readiness](#sprint-8-polish--alpha-readiness)
5. [Phase 2 — Intelligence (Weeks 9–16)](#5-phase-2--intelligence-weeks-916)
6. [TDD Rules](#6-tdd-rules)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Glossary](#8-glossary)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Electron Shell (Code-OSS core)                      │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Editor pane   │ │ Terminal │ │ Wursor panels    │ │
│  │ (Code-OSS)    │ │ (xterm)  │ │ preview, diff,   │ │
│  │               │ │          │ │ state, chat      │ │
│  └──────┬───────┘ └────┬─────┘ └────────┬─────────┘ │
└─────────┼──────────────┼────────────────┼───────────┘
          │              │                │
          ▼              ▼                ▼
┌─────────────────────────────────────────────────────┐
│  Agent Tool Bus (Node.js process)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ fs       │ │ wpcli    │ │ site     │ │ db      │ │
│  │ tools    │ │ runner   │ │ runtime  │ │ query   │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ lint     │ │ index    │ │ permission engine    │ │
│  │ tools    │ │ search   │ │ + secret redaction   │ │
│  └──────────┘ └──────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  Site Runtime (wp-env / Docker)                       │
│  WordPress + MySQL + WP-CLI                           │
└─────────────────────────────────────────────────────┘
```

**Key structural decisions:**
- **Monorepo** with `packages/` directories — one package per layer
- Each package has its own `__tests__/` directory and `vitest.config.ts`
- Integration tests use fixture-based WordPress repos in CI
- E2E tests use Playwright against the Electron shell

---

## 2. Project Structure

```
wursor/
├── electron/                    # Electron shell + main process
│   ├── src/
│   │   ├── main.ts              # Electron main process entry
│   │   ├── preload.ts           # Context bridge
│   │   ├── windows/
│   │   │   ├── main-window.ts   # Main window factory
│   │   │   └── preview-window.ts# Preview webview
│   │   ├── ipc/                 # IPC handlers
│   │   │   ├── filesystem.ts    # File read/write via IPC
│   │   │   ├── docker.ts        # Docker socket access
│   │   │   └── shell.ts         # Terminal spawn
│   │   └── menu.ts              # Application menu
│   ├── __tests__/
│   │   ├── main.test.ts
│   │   └── preload.test.ts
│   ├── electron-builder.yml     # Build config
│   └── package.json
│
├── packages/
│   ├── editor-core/             # Code-OSS extension layer
│   │   ├── src/
│   │   │   ├── extension.ts     # Activation entry
│   │   │   ├── panels/
│   │   │   │   ├── preview-panel.ts
│   │   │   │   ├── diff-panel.ts
│   │   │   │   ├── state-diff-panel.ts
│   │   │   │   └── chat-panel.ts
│   │   │   ├── commands/
│   │   │   │   ├── open-project.ts
│   │   │   │   ├── run-playbook.ts
│   │   │   │   └── verify-preview.ts
│   │   │   └── providers/
│   │   │       ├── status-bar.ts
│   │   │       └── tree-view.ts
│   │   ├── __tests__/
│   │   │   ├── panels.test.ts
│   │   │   └── commands.test.ts
│   │   └── package.json
│   │
│   ├── tool-bus/                # Agent tool schemas + execution
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── registry.ts      # Tool registry (name → schema → handler)
│   │   │   ├── tools/
│   │   │   │   ├── fs.ts        # fs.read, fs.write, fs.apply_patch
│   │   │   │   ├── wpcli.ts     # wpcli.run (categorized)
│   │   │   │   ├── site.ts      # site.browse, site.screenshot, site.request
│   │   │   │   ├── db.ts        # db.query (read-only)
│   │   │   │   ├── lint.ts      # lint.phpcs
│   │   │   │   ├── test.ts      # test.phpunit
│   │   │   │   └── index.ts     # index.search, index.graph_lookup
│   │   │   ├── schemas.ts       # JSON Schema for each tool
│   │   │   └── executor.ts      # Shell executor (spawn, stream, timeout)
│   │   ├── __tests__/
│   │   │   ├── registry.test.ts
│   │   │   ├── tools/fs.test.ts
│   │   │   ├── tools/wpcli.test.ts
│   │   │   ├── tools/site.test.ts
│   │   │   ├── tools/db.test.ts
│   │   │   └── executor.test.ts
│   │   └── package.json
│   │
│   ├── knowledge-index/         # WordPress Knowledge Graph
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── scanner/
│   │   │   │   ├── static-scanner.ts   # PHP/JSON file scan
│   │   │   │   └── runtime-enricher.ts # WP-CLI enrichment
│   │   │   ├── graph/
│   │   │   │   ├── node.ts
│   │   │   │   ├── edge.ts
│   │   │   │   └── store.ts
│   │   │   ├── freshness.ts     # Staleness tracking
│   │   │   └── queries.ts       # Graph query API
│   │   ├── __tests__/
│   │   │   ├── scanner/static-scanner.test.ts
│   │   │   ├── scanner/runtime-enricher.test.ts
│   │   │   ├── graph/store.test.ts
│   │   │   └── queries.test.ts
│   │   ├── fixtures/            # Test WP repos
│   │   │   ├── classic-theme/
│   │   │   ├── block-theme/
│   │   │   └── single-plugin/
│   │   └── package.json
│   │
│   ├── state-diff/              # State Diff lifecycle
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── lifecycle.ts     # create → review → stage → apply → verify → commit
│   │   │   ├── evaluator.ts     # Evaluate intent + blast radius
│   │   │   ├── rollback.ts      # Inverse / rollback generation
│   │   │   ├── serializer.ts    # .state-diff.json format
│   │   │   └── types.ts
│   │   ├── __tests__/
│   │   │   ├── lifecycle.test.ts
│   │   │   ├── evaluator.test.ts
│   │   │   ├── rollback.test.ts
│   │   │   └── serializer.test.ts
│   │   └── package.json
│   │
│   ├── runtime-manager/         # Site runtime lifecycle
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── interface.ts     # Runtime interface (abstraction layer)
│   │   │   ├── adapters/
│   │   │   │   └── wp-env.ts    # wp-env adapter (v1 only)
│   │   │   ├── lifecycle.ts     # start/stop/reset/status
│   │   │   └── logs.ts          # Log tailing
│   │   ├── __tests__/
│   │   │   ├── adapters/wp-env.test.ts
│   │   │   ├── lifecycle.test.ts
│   │   │   └── logs.test.ts
│   │   └── package.json
│   │
│   ├── permission-engine/       # Policy engine
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tiers.ts         # Permission tiers definition
│   │   │   ├── evaluator.ts     # Evaluate tool call against policy
│   │   │   ├── redactor.ts      # Secret redaction
│   │   │   └── config.ts        # User-defined policy
│   │   ├── __tests__/
│   │   │   ├── tiers.test.ts
│   │   │   ├── evaluator.test.ts
│   │   │   └── redactor.test.ts
│   │   └── package.json
│   │
│   ├── verify/                  # Preview verification
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── screenshot.ts    # Screenshot capture
│   │   │   ├── http-check.ts    # URL load + status + error sniff
│   │   │   ├── editor-check.ts  # Block editor route check
│   │   │   └── reporter.ts      # Verify result formatting
│   │   ├── __tests__/
│   │   │   ├── screenshot.test.ts
│   │   │   ├── http-check.test.ts
│   │   │   └── reporter.test.ts
│   │   └── package.json
│   │
│   ├── agent-bridge/            # Agent API client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts        # Claude API client (BYO key)
│   │   │   ├── tool-schemas.ts  # Tool schemas → Claude format
│   │   │   ├── context.ts       # Build system prompt + context
│   │   │   └── fallback.ts      # Error handling + retry
│   │   ├── __tests__/
│   │   │   ├── client.test.ts
│   │   │   ├── tool-schemas.test.ts
│   │   │   └── context.test.ts
│   │   └── package.json
│   │
│   └── playbooks/               # Reusable agent workflows
│       ├── src/
│       │   ├── index.ts
│       │   ├── registry.ts      # Playbook registry
│       │   ├── dynamic-block.ts
│       │   ├── child-theme.ts
│       │   ├── cpt.ts
│       │   └── plugin.ts
│       ├── __tests__/
│       │   ├── registry.test.ts
│       │   ├── dynamic-block.test.ts
│       │   ├── child-theme.test.ts
│       │   └── cpt.test.ts
│       └── package.json
│
├── e2e/                         # End-to-end tests
│   ├── electron/
│   │   ├── open-project.test.ts
│   │   ├── detect-wp.test.ts
│   │   ├── boot-preview.test.ts
│   │   ├── playbook-dynamic-block.test.ts
│   │   └── verify-preview.test.ts
│   ├── fixtures/
│   │   ├── sample-theme/        # Minimal WP theme repo
│   │   └── sample-plugin/       # Minimal WP plugin repo
│   └── playwright.config.ts
│
├── tsconfig.base.json
├── vitest.workspace.ts
├── package.json                 # Root package.json (workspaces)
├── pnpm-workspace.yaml
└── .github/workflows/
    ├── ci.yml                   # Unit + integration on PR
    └── e2e.yml                  # E2E on release branch
```

---

## 3. Build Phases

The implementation follows the roadmap from §12 of the PRD.

| Phase | Weeks | Output | Exit criteria |
|-------|-------|--------|---------------|
| **Phase 1** | 1–8 | Electron shell, wp-env runtime, agent tool bus, chat, WP-CLI, playbooks, first-run | Clean machine → live preview ≤10 min; P0 playbook completes |
| **Phase 2** | 9–16 | Knowledge graph, State Diffs, quality gates, staging pull, closed alpha | All §11 baselines collected; State Diff lifecycle demoed |
| **Phase 3** | 17–28 | Block/FSE workshop, deploy connectors, team playbooks, paid beta | — |
| **Phase 4** | 29+ | WooCommerce, multisite, maintenance agents, ecosystem | — |

This guide details **Phase 1** only. Phase 2 will be broken down after Phase 1 exit criteria are met.

---

## 4. Phase 1 — Foundation (Weeks 1–8)

Organized into **8 sprints** (one per week). Every sprint produces a **run integration test** that passes before the sprint is done.

---

### Sprint 1: Electron shell + project scaffold

**Goal:** Ship a working Electron window wrapping Code-OSS that opens a folder and shows a Wursor sidebar.

#### TDD sequence

**Step 1 — Write the test that defines "done"**

```typescript
// e2e/electron/open-project.test.ts
import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';

test('opens a folder and shows Wursor sidebar', async () => {
  const app = await electron.launch({
    args: ['/path/to/fixtures/sample-theme'],
  });
  const window = await app.firstWindow();
  await expect(window.locator('.wursor-sidebar')).toBeVisible();
  await expect(window.locator('.monaco-editor')).toBeVisible();
  await app.close();
});
```

**Step 2 — Write the code to pass it**

- **`electron/src/main.ts`** — Create BrowserWindow, load Code-OSS, pass `--folder-uri` arg
- **`electron/src/preload.ts`** — Expose Wursor API via contextBridge
- **`electron/src/windows/main-window.ts`** — Window factory: size, menu, webview preload
- **`electron/electron-builder.yml`** — macOS + Windows targets
- **`packages/editor-core/src/extension.ts`** — Code-OSS extension that activates on `wursor.*` commands
- **`packages/editor-core/src/panels/chat-panel.ts`** — Sidebar webview (placeholder)

**Step 3 — Write the unit tests**

```typescript
// electron/__tests__/main.test.ts
describe('Electron main process', () => {
  it('creates a BrowserWindow', () => { /* ... */ });
  it('loads the Code-OSS editor core', () => { /* ... */ });
  it('exposes Wursor API via preload', () => { /* ... */ });
});
```

**Step 4 — Integration test**

```bash
pnpm test:e2e -- --grep "opens a folder and shows Wursor sidebar"
```

#### Deliverables

- Electron app that opens a folder and shows a sidebar
- `e2e/electron/open-project.test.ts` passing
- `electron/__tests__/main.test.ts` passing
- `packages/editor-core/__tests__/extension.test.ts` passing

---

### Sprint 2: wp-env runtime manager

**Goal:** Start/stop/reset a WordPress site via wp-env, show status in the sidebar.

#### TDD sequence

**Step 1 — Write the integration test**

```typescript
// e2e/electron/boot-preview.test.ts
test('boots a WordPress site via wp-env and shows preview', async () => {
  const app = await electron.launch({ args: ['/path/to/fixtures/sample-theme'] });
  const window = await app.firstWindow();
  await window.locator('.wursor-start-runtime').click();
  await expect(window.locator('.wursor-status-indicator')).toHaveText('running');
  await expect(window.locator('.wursor-preview-frame')).toBeVisible();
  await app.close();
});
```

**Step 2 — Write the unit tests**

```typescript
// packages/runtime-manager/__tests__/lifecycle.test.ts
describe('RuntimeManager', () => {
  it('starts wp-env and returns status', async () => {
    const manager = new RuntimeManager();
    const status = await manager.start();
    expect(status).toBe('running');
  });
  it('stops wp-env and cleans up', async () => { /* ... */ });
  it('reports status as stopped when not running', async () => { /* ... */ });
  it('streams logs from wp-env', async () => { /* ... */ });
});

// packages/runtime-manager/__tests__/adapters/wp-env.test.ts
describe('WpEnvAdapter', () => {
  it('spawns wp-env start', async () => { /* ... */ });
  it('parses wp-env output for URL and credentials', async () => { /* ... */ });
  it('handles wp-env not found', async () => { /* ... */ });
});
```

**Step 3 — Implement**

- **`packages/runtime-manager/src/interface.ts`** — `RuntimeAdapter` interface (start, stop, reset, status, logs, url, credentials)
- **`packages/runtime-manager/src/adapters/wp-env.ts`** — Implements `RuntimeAdapter` via `child_process.spawn('npx wp-env start')`
- **`packages/runtime-manager/src/lifecycle.ts`** — State machine: stopped → starting → running → stopping → stopped
- **`packages/runtime-manager/src/logs.ts`** — Tail `wp-env logs` output stream
- **`packages/editor-core/src/panels/preview-panel.ts`** — iframe pointing to `http://localhost:{port}`
- **`packages/editor-core/src/providers/status-bar.ts`** — Runtime status indicator

#### Deliverables

- Runtime manager package with unit tests
- Preview panel showing the live site
- Status bar showing runtime state
- `e2e/electron/boot-preview.test.ts` passing

---

### Sprint 3: Agent tool bus

**Goal:** Each tool from §8.3 is a registered schema with a handler that executes in the local environment.

#### TDD sequence

**Step 1 — Write the unit tests**

```typescript
// packages/tool-bus/__tests__/registry.test.ts
describe('ToolRegistry', () => {
  it('registers a tool with name, schema, and handler', () => {
    const registry = new ToolRegistry();
    registry.register('fs.read', fsReadSchema, fsReadHandler);
    expect(registry.get('fs.read')).toBeDefined();
  });
  it('throws on duplicate tool name', () => { /* ... */ });
  it('returns all tool schemas for the agent', () => { /* ... */ });
});

// packages/tool-bus/__tests__/tools/fs.test.ts
describe('fs.read', () => {
  it('reads a file and returns its content', async () => {
    const result = await fsReadHandler({ path: 'fixtures/sample.txt' });
    expect(result.content).toBe('hello');
  });
  it('rejects paths outside the workspace', async () => { /* ... */ });
  it('handles missing files gracefully', async () => { /* ... */ });
});

// packages/tool-bus/__tests__/tools/wpcli.test.ts
describe('wpcli.run', () => {
  it('runs a WP-CLI command and returns output', async () => {
    const result = await wpcliRunHandler({ command: 'wp option get blogname' });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Wursor');
  });
  it('rejects commands in the destructive category without confirm', async () => { /* ... */ });
  it('timeouts after 30 seconds', async () => { /* ... */ });
});

// packages/tool-bus/__tests__/tools/site.test.ts
describe('site.browse', () => {
  it('returns the HTML of a URL', async () => { /* ... */ });
});

// packages/tool-bus/__tests__/tools/db.test.ts
describe('db.query', () => {
  it('executes a read-only SQL query', async () => { /* ... */ });
  it('rejects INSERT/UPDATE/DELETE queries', async () => { /* ... */ });
});

// packages/tool-bus/__tests__/executor.test.ts
describe('Executor', () => {
  it('spawns a shell command and captures output', async () => { /* ... */ });
  it('applies a timeout to long-running commands', async () => { /* ... */ });
  it('streams output to a callback', async () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`packages/tool-bus/src/registry.ts`** — Map of tool name → { schema, handler, category }
- **`packages/tool-bus/src/schemas.ts`** — JSON Schema for each tool
- **`packages/tool-bus/src/tools/fs.ts`** — File system operations (path-scoped to workspace)
- **`packages/tool-bus/src/tools/wpcli.ts`** — WP-CLI runner with categorized allowlist
- **`packages/tool-bus/src/tools/site.ts`** — HTTP fetch + screenshot via Puppeteer
- **`packages/tool-bus/src/tools/db.ts`** — MySQL read-only query via wp-env credentials
- **`packages/tool-bus/src/tools/lint.ts`** — PHPCS wrapper
- **`packages/tool-bus/src/tools/test.ts`** — PHPUnit wrapper
- **`packages/tool-bus/src/tools/index.ts`** — Knowledge graph search (stub until Phase 2)
- **`packages/tool-bus/src/executor.ts`** — `child_process.spawn` wrapper with timeout + streaming

#### Deliverables

- Tool registry with all 9 tools from §8.3
- Each tool has unit tests for happy path, error path, and security boundary
- `packages/tool-bus/__tests__/*` all passing

---

### Sprint 4: Agent chat + diff review

**Goal:** Chat panel that sends tasks to Claude, receives tool calls, executes them, and shows diffs.

#### TDD sequence

**Step 1 — Write the unit tests**

```typescript
// packages/agent-bridge/__tests__/client.test.ts
describe('AgentClient', () => {
  it('sends a message to Claude API and returns a response', async () => {
    const client = new AgentClient({ apiKey: 'test-key' });
    const response = await client.send('Add a paragraph to index.php');
    expect(response.type).toBe('tool_call');
  });
  it('handles API errors with a clear message', async () => { /* ... */ });
  it('retries on transient failures', async () => { /* ... */ });
});

// packages/agent-bridge/__tests__/tool-schemas.test.ts
describe('ToolSchemas', () => {
  it('converts tool registry schemas to Claude format', () => {
    const schemas = toClaudeFormat(registry.getAll());
    expect(schemas[0].name).toBe('fs.read');
    expect(schemas[0].input_schema).toBeDefined();
  });
});

// packages/agent-bridge/__tests__/context.test.ts
describe('ContextBuilder', () => {
  it('builds a system prompt with WP semantics', () => { /* ... */ });
  it('includes project rules from WORDPRESS.md', () => { /* ... */ });
  it('includes knowledge graph context', () => { /* ... */ });
});

// packages/editor-core/__tests__/panels/chat-panel.test.ts
describe('ChatPanel', () => {
  it('sends a message and displays the response', () => { /* ... */ });
  it('shows tool calls as expandable cards', () => { /* ... */ });
  it('shows diffs in a side-by-side view', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`packages/agent-bridge/src/client.ts`** — Claude API client (messages API, tool use)
- **`packages/agent-bridge/src/tool-schemas.ts`** — Convert tool-bus schemas → Claude `tools` array
- **`packages/agent-bridge/src/context.ts`** — Build system prompt with WP semantics, project rules, and graph context
- **`packages/agent-bridge/src/fallback.ts`** — Error handling, retry with exponential backoff
- **`packages/editor-core/src/panels/chat-panel.ts`** — Chat UI (message list, input, tool call cards)
- **`packages/editor-core/src/panels/diff-panel.ts`** — Side-by-side diff view
- **`packages/editor-core/src/commands/run-playbook.ts`** — Command to trigger a playbook

**Step 3 — Integration test**

```typescript
// e2e/electron/playbook-dynamic-block.test.ts
test('chat panel sends a task and executes a playbook', async () => {
  const app = await electron.launch({ args: ['/path/to/fixtures/sample-theme'] });
  const window = await app.firstWindow();
  await window.locator('.wursor-chat-input').fill('Scaffold a dynamic block named "testimonial"');
  await window.locator('.wursor-chat-send').click();
  await expect(window.locator('.wursor-diff-view')).toBeVisible({ timeout: 60000 });
  await app.close();
});
```

#### Deliverables

- Working chat panel that sends to Claude and executes tool calls
- Diff view showing file changes
- `packages/agent-bridge/__tests__/*` passing
- Chat panel unit tests passing

---

### Sprint 5: WP-CLI tool + permission engine

**Goal:** WP-CLI commands are categorized and gated by permission tiers. Secrets are redacted from agent context.

#### TDD sequence

**Step 1 — Write the unit tests**

```typescript
// packages/permission-engine/__tests__/tiers.test.ts
describe('PermissionTiers', () => {
  it('defines read FS, edit FS, WP-CLI safe, WP-CLI destructive, SQL read, SQL write, network install', () => {
    expect(Tiers.READ_FS).toBeDefined();
    expect(Tiers.WPCLI_DESTRUCTIVE).toBeDefined();
  });
  it('orders tiers from least to most permissive', () => { /* ... */ });
});

// packages/permission-engine/__tests__/evaluator.test.ts
describe('PolicyEvaluator', () => {
  it('allows a tool call within the current tier', () => { /* ... */ });
  it('blocks a tool call above the current tier', () => { /* ... */ });
  it('requires confirmation for destructive tier', () => { /* ... */ });
  it('blocks production writes by default', () => { /* ... */ });
});

// packages/permission-engine/__tests__/redactor.test.ts
describe('SecretRedactor', () => {
  it('redacts values from .env files', () => {
    const redacted = redact('DB_PASSWORD=secret123', ['secret123']);
    expect(redacted).not.toContain('secret123');
  });
  it('redacts wp-config.php constants', () => { /* ... */ });
  it('does not redact environment variable names', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`packages/permission-engine/src/tiers.ts`** — Tier definitions as ordered enum
- **`packages/permission-engine/src/evaluator.ts`** — Policy evaluator (current tier, requested tier, environment, confirmation flag)
- **`packages/permission-engine/src/redactor.ts`** — Scan text for secrets from `.env` and `wp-config.php`, redact before sending to agent
- **`packages/permission-engine/src/config.ts`** — User-defined policy overrides (read from `.wursor/policy.json`)
- Wire permission engine into **`packages/tool-bus/src/tools/wpcli.ts`** — categorize and check before running

#### Deliverables

- Permission engine with all 7 tiers
- Secret redaction for `.env` and `wp-config.php`
- WP-CLI tool categorized and gated
- `packages/permission-engine/__tests__/*` passing

---

### Sprint 6: P0 playbooks + first-run

**Goal:** Four P0 playbooks (dynamic block, child theme, CPT, plugin) are executable from the chat panel. First-run experience guides the user through project open and dependency check.

#### TDD sequence

**Step 1 — Write the unit tests**

```typescript
// packages/playbooks/__tests__/dynamic-block.test.ts
describe('DynamicBlockPlaybook', () => {
  it('detects the build setup', async () => {
    const playbook = new DynamicBlockPlaybook();
    const config = await playbook.detect(workspacePath);
    expect(config.buildTool).toBe('@wordpress/scripts');
  });
  it('scaffolds a block with correct metadata', async () => { /* ... */ });
  it('registers the block in the plugin file', async () => { /* ... */ });
  it('builds the assets', async () => { /* ... */ });
  it('verifies the block appears in the editor', async () => { /* ... */ });
  it('produces a diff of all changes', async () => { /* ... */ });
});

// packages/playbooks/__tests__/child-theme.test.ts
describe('ChildThemePlaybook', () => {
  it('creates a style.css with correct Template header', async () => { /* ... */ });
  it('enqueues parent theme styles', async () => { /* ... */ });
  it('overrides a template with screenshot verification', async () => { /* ... */ });
});

// packages/playbooks/__tests__/cpt.test.ts
describe('CptPlaybook', () => {
  it('registers a CPT with REST support', async () => { /* ... */ });
  it('flushes rewrite rules via WP-CLI', async () => { /* ... */ });
  it('seeds test data via WP-CLI', async () => { /* ... */ });
  it('verifies the REST endpoint returns data', async () => { /* ... */ });
});

// packages/playbooks/__tests__/plugin.test.ts
describe('PluginPlaybook', () => {
  it('creates plugin headers', async () => { /* ... */ });
  it('sets up Composer if requested', async () => { /* ... */ });
  it('sets up PHPUnit if requested', async () => { /* ... */ });
});
```

**Step 2 — Integration tests**

```typescript
// e2e/first-run.test.ts
describe('First-run experience', () => {
  it('shows project open dialog on first launch', async () => { /* ... */ });
  it('detects Docker and wp-env, guides install if missing', async () => { /* ... */ });
  it('opens a project and shows the workspace within 10 minutes', async () => { /* ... */ });
});
```

**Step 3 — Implement**

- **`packages/playbooks/src/registry.ts`** — Playbook registration
- **`packages/playbooks/src/dynamic-block.ts`** — Full playbook: detect build → scaffold → register → build → verify → diff
- **`packages/playbooks/src/child-theme.ts`** — Full playbook: scaffold → enqueue → override → screenshot
- **`packages/playbooks/src/cpt.ts`** — Full playbook: register → flush → seed → REST check → diff
- **`packages/playbooks/src/plugin.ts`** — Full playbook: headers → optional Composer/PHPUnit
- **`packages/editor-core/src/commands/open-project.ts`** — First-run dialog with three paths
- **`packages/editor-core/src/commands/verify-preview.ts`** — Verify step integration

#### Deliverables

- 4 P0 playbooks with unit tests
- First-run dialog (3 paths: WP repo, plain folder, sample project)
- Dependency check (Docker, wp-env) with install guidance
- `e2e/first-run.test.ts` passing

---

### Sprint 7: Integration + exit criteria

**Goal:** All Phase 1 pieces work together. The exit criteria test passes end-to-end.

#### Integration test

```typescript
// e2e/phase1-exit-criteria.test.ts
describe('Phase 1 exit criteria', () => {
  test('clean machine → live preview in ≤10 min', async () => {
    // Simulate a clean machine (no Docker, no wp-env)
    const app = await electron.launch({ args: [] });
    const window = await app.firstWindow();
    const startTime = Date.now();
    // Follow first-run dialog → install Docker → install wp-env → open project → boot
    await window.locator('.wursor-first-run-open-repo').click();
    await window.locator('.wursor-project-picker').fill('/path/to/fixtures/sample-theme');
    await window.locator('.wursor-confirm-open').click();
    // Wait for runtime to boot
    await expect(window.locator('.wursor-status-indicator')).toHaveText('running', { timeout: 600000 });
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(10 * 60 * 1000);
    await app.close();
  });

  test('P0 playbook completes with verified preview + accepted diff', async () => {
    const app = await electron.launch({ args: ['/path/to/fixtures/sample-theme'] });
    const window = await app.firstWindow();
    // Wait for runtime
    await expect(window.locator('.wursor-status-indicator')).toHaveText('running', { timeout: 60000 });
    // Run playbook
    await window.locator('.wursor-chat-input').fill('Create a dynamic block named "testimonial"');
    await window.locator('.wursor-chat-send').click();
    // Wait for diff
    await expect(window.locator('.wursor-diff-view')).toBeVisible({ timeout: 120000 });
    // Wait for verify
    await expect(window.locator('.wursor-verify-result')).toBeVisible({ timeout: 60000 });
    // Accept
    await window.locator('.wursor-accept-diff').click();
    await expect(window.locator('.wursor-accepted-badge')).toBeVisible();
    await app.close();
  });
});
```

#### Deliverables

- Both exit criteria tests passing
- All unit tests passing (`pnpm test`)
- All integration tests passing (`pnpm test:integration`)

---

### Sprint 8: Polish + alpha readiness

**Goal:** Error states from §8.5 are handled, app packaging works, and the build is ready for internal alpha.

#### Tasks

- **Error states** — Wire each error state from §8.5 into the UI
- **App packaging** — `electron-builder` produces signed `.dmg` (macOS) and `.exe` (Windows)
- **Auto-update** — `electron-updater` with GitHub releases
- **Telemetry** — Minimal events (preview load time, playbook run, verify result) with consent dialog
- **Documentation** — `README.md` with install instructions and quickstart
- **Bug bash** — Internal team runs through the first-run + playbook flow

#### Deliverables

- Signed app bundles for macOS + Windows
- Auto-update mechanism
- Error states all wired
- Minimal telemetry with consent
- `README.md` updated for alpha users

---

## 5. Phase 2 — Intelligence (Weeks 9–16)

*High-level outline only — full breakdown will follow Phase 1 exit.*

| Sprint | Focus | Packages |
|--------|-------|----------|
| 9 | Knowledge graph static scanner | `packages/knowledge-index/src/scanner/static-scanner.ts` |
| 10 | Knowledge graph runtime enricher | `packages/knowledge-index/src/scanner/runtime-enricher.ts` |
| 11 | Knowledge graph queries + UI | `packages/knowledge-index/src/queries.ts`, tree view |
| 12 | State Diff lifecycle | `packages/state-diff/src/lifecycle.ts` |
| 13 | State Diff UI + rollback | `packages/state-diff/src/rollback.ts`, diff panel |
| 14 | Quality gates (PHPCS, PHPUnit) | `packages/tool-bus/src/tools/lint.ts`, `test.ts` |
| 15 | Staging pull connector | `packages/tool-bus/src/tools/staging.ts` |
| 16 | Closed alpha ship + baseline collection | Telemetry review, §11 baselines |

---

## 6. TDD Rules

These rules apply to every sprint:

1. **Write the test first.** No implementation code is written without a failing test.
2. **One assertion per test.** Each test verifies exactly one behavior.
3. **Tests are deterministic.** No network calls in unit tests (mock Claude API, mock wp-env).
4. **Integration tests use fixtures.** Sample WP repos live in `packages/*/fixtures/` and `e2e/fixtures/`.
5. **Red → Green → Refactor.** Write the failing test (red), make it pass (green), then clean up (refactor).
6. **Coverage floor.** Each package must maintain ≥ 90% line coverage. CI enforces this.
7. **No skipped tests in main.** `test.skip` and `test.only` are only allowed in feature branches.

### Test naming convention

```
{module}.{behavior}.test.ts
```

Examples:
- `fs.read-workspace-file.test.ts`
- `wpcli.reject-destructive-without-confirm.test.ts`
- `lifecycle.start-and-report-status.test.ts`

---

## 7. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml — runs on every PR
name: CI
on: [pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test          # All unit tests
      - run: pnpm test:coverage # Enforces 90% floor

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:integration  # Fixture-based integration tests

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint

# .github/workflows/e2e.yml — runs on release branch
name: E2E
on:
  push:
    branches: [release/*]
jobs:
  e2e:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
```

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Tool bus** | The registry and executor for all agent-callable tools (fs, wpcli, site, db, etc.) |
| **Runtime adapter** | Interface that abstracts wp-env (v1) behind a common API for future backends |
| **Playbook** | A reusable, multi-step agent workflow (scaffold block, create CPT, etc.) |
| **State Diff** | A reviewable mutation plan for WP content/state (CLI commands, SQL, or migration) |
| **Permission tier** | A capability level (read FS → edit FS → WP-CLI safe → destructive → etc.) |
| **Verify** | Required proof step: screenshot, HTTP check, or editor route confirmation |
| **Knowledge graph** | Indexed map of themes, plugins, blocks, hooks, and REST routes |

---

*End of Implementation Guide v1.0 — Wursor*