# Implementation Guide — Wursor v1

**Version:** 1.1  
**Source:** [PRD.md](./PRD.md) v1.3  
**Method:** Test-driven development (TDD) — every module is written against its tests before its implementation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Build Phases](#3-build-phases)
4. [Phase 1 — Foundation (Weeks 1–8)](#4-phase-1--foundation-weeks-18)
   - [Sprint 1: Tauri shell + Monaco Editor + project scaffold](#sprint-1)
   - [Sprint 2: Rust tool bus](#sprint-2)
   - [Sprint 3: wp-env runtime manager](#sprint-3)
   - [Sprint 4: Agent chat + diff review](#sprint-4)
   - [Sprint 5: Permission engine + WP-CLI](#sprint-5)
   - [Sprint 6: P0 playbooks + first-run](#sprint-6)
   - [Sprint 7: Integration + exit criteria](#sprint-7)
   - [Sprint 8: Polish + alpha readiness](#sprint-8)
5. [Phase 2 — Intelligence (Weeks 9–16)](#5-phase-2--intelligence-weeks-916)
6. [TDD Rules](#6-tdd-rules)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Glossary](#8-glossary)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Tauri Shell (Rust native process)                        │
│  ┌──────────────────────┐  ┌───────────────────────────┐ │
│  │  System Webview (TS)  │  │  Rust Backend             │ │
│  │  ┌────────────────┐  │  │  ┌─────────────────────┐ │ │
│  │  │ Monaco Editor  │  │  │  │ Tool bus (spawn,    │ │ │
│  │  │ (editor core)  │  │  │  │ exec, stream)       │ │ │
│  │  ├────────────────┤  │  │  ├─────────────────────┤ │ │
│  │  │ Wursor panels  │  │  │  │ Knowledge graph     │ │ │
│  │  │ - preview      │  │  │  │ parser (PHP/JSON    │ │ │
│  │  │ - diff         │  │  │  │ scan, 10k files     │ │ │
│  │  │ - state diff   │  │  │  │ in ~200ms)          │ │ │
│  │  │ - chat         │  │  │  ├─────────────────────┤ │ │
│  │  │ - status bar   │  │  │  │ Permission engine   │ │ │
│  │  └────────────────┘  │  │  │ + secret redaction  │ │ │
│  │  Web frontend        │  │  ├─────────────────────┤ │ │
│  │  (TypeScript/HTML)   │  │  │ Runtime manager     │ │ │
│  └──────────────────────┘  │  │ (Docker socket,     │ │ │
│                             │  │  wp-env lifecycle)  │ │ │
│                             │  ├─────────────────────┤ │ │
│                             │  │ State Diff engine   │ │ │
│                             │  │ (create, evaluate,  │ │ │
│                             │  │  rollback, persist) │ │ │
│                             │  └─────────────────────┘ │ │
│                             └───────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│  Site Runtime (wp-env / Docker)                            │
│  WordPress + MySQL + WP-CLI                                │
└──────────────────────────────────────────────────────────┘
```

**Key structural decisions:**
- **Monorepo** with a `crates/` directory for Rust packages and a `webview/` directory for the TypeScript frontend
- Rust crates communicate via `tauri::command` IPC to the webview
- Each Rust crate has its own `tests/` directory (integration) and inline `#[cfg(test)]` unit tests
- Integration tests use fixture-based WordPress repos in CI
- E2E tests use Playwright against the Tauri webview

---

## 2. Project Structure

```
wursor/
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri app entry
│   │   ├── lib.rs                # Plugin registration
│   │   ├── commands/             # #[tauri::command] IPC handlers
│   │   │   ├── fs.rs             # File read/write
│   │   │   ├── project.rs        # Project open/detect
│   │   │   ├── runtime.rs        # wp-env start/stop/status
│   │   │   ├── tools.rs          # Tool bus dispatch
│   │   │   ├── permissions.rs    # Policy query
│   │   │   └── verify.rs         # Screenshot/HTTP check
│   │   ├── tool-bus/
│   │   │   ├── mod.rs            # Tool registry
│   │   │   ├── registry.rs       # Name → {schema, handler, category}
│   │   │   ├── tools/
│   │   │   │   ├── fs.rs         # fs.read, fs.write, fs.apply_patch
│   │   │   │   ├── wpcli.rs      # wpcli.run (categorized)
│   │   │   │   ├── site.rs       # site.browse, site.screenshot, site.request
│   │   │   │   ├── db.rs         # db.query (read-only)
│   │   │   │   ├── lint.rs       # lint.phpcs
│   │   │   │   ├── test_runner.rs# test.phpunit
│   │   │   │   └── index.rs      # index.search, index.graph_lookup (stub)
│   │   │   └── executor.rs       # Shell spawn, timeout, stream
│   │   ├── knowledge-index/
│   │   │   ├── mod.rs
│   │   │   ├── scanner.rs        # Static PHP/JSON scan (Rust-native parser)
│   │   │   ├── enricher.rs       # WP-CLI runtime enrichment
│   │   │   ├── graph.rs          # Node, edge, store
│   │   │   ├── freshness.rs      # Staleness tracking
│   │   │   └── queries.rs        # Graph query API
│   │   ├── state-diff/
│   │   │   ├── mod.rs
│   │   │   ├── lifecycle.rs      # create → review → stage → apply → verify → commit
│   │   │   ├── evaluator.rs      # Blast radius, intent
│   │   │   ├── rollback.rs       # Inverse generation
│   │   │   └── serializer.rs     # .state-diff.json format
│   │   ├── runtime-manager/
│   │   │   ├── mod.rs
│   │   │   ├── interface.rs      # RuntimeAdapter trait
│   │   │   ├── adapters/
│   │   │   │   └── wp_env.rs     # wp-env adapter (v1 only)
│   │   │   ├── lifecycle.rs      # State machine
│   │   │   └── logs.rs           # Log tailing
│   │   ├── permission-engine/
│   │   │   ├── mod.rs
│   │   │   ├── tiers.rs          # Permission tiers enum
│   │   │   ├── evaluator.rs      # Tool call → policy check
│   │   │   ├── redactor.rs       # Secret redaction (.env, wp-config)
│   │   │   └── config.rs         # User policy (.wursor/policy.json)
│   │   ├── verify/
│   │   │   ├── mod.rs
│   │   │   ├── screenshot.rs     # Screenshot capture
│   │   │   ├── http_check.rs     # URL load + status + error sniff
│   │   │   ├── editor_check.rs   # Block editor route check
│   │   │   └── reporter.rs       # Result formatting
│   │   ├── agent-bridge/
│   │   │   ├── mod.rs
│   │   │   ├── client.rs         # Grok API client (BYO key)
│   │   │   ├── tool_schemas.rs   # Tool schemas → Grok format
│   │   │   ├── context.rs        # System prompt + WP context
│   │   │   └── fallback.rs       # Error handling + retry
│   │   └── playbooks/
│   │       ├── mod.rs
│   │       ├── registry.rs       # Playbook registry
│   │       ├── dynamic_block.rs
│   │       ├── child_theme.rs
│   │       ├── cpt.rs
│   │       └── plugin.rs
│   ├── tests/                    # Integration tests
│   │   ├── tool_bus_test.rs
│   │   ├── runtime_manager_test.rs
│   │   ├── knowledge_index_test.rs
│   │   ├── state_diff_test.rs
│   │   ├── permission_engine_test.rs
│   │   └── playbooks_test.rs
│   ├── fixtures/                 # Test WP repos
│   │   ├── classic-theme/
│   │   ├── block-theme/
│   │   └── single-plugin/
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── webview/                      # Tauri webview frontend (TypeScript)
│   ├── src/
│   │   ├── main.tsx              # App entry
│   │   ├── App.tsx               # Root component
│   │   ├── components/
│   │   │   ├── Editor.tsx         # Monaco Editor wrapper
│   │   │   ├── Preview.tsx        # Site preview iframe
│   │   │   ├── ChatPanel.tsx      # Agent chat
│   │   │   ├── DiffPanel.tsx      # Side-by-side file diff
│   │   │   ├── StateDiffPanel.tsx # State Diff lifecycle UI
│   │   │   ├── StatusBar.tsx      # Site status, permissions
│   │   │   ├── Terminal.tsx       # Integrated terminal
│   │   │   └── FirstRun.tsx       # Onboarding wizard
│   │   ├── hooks/
│   │   │   ├── useToolBus.ts      # Invoke Rust commands
│   │   │   ├── useRuntime.ts      # Runtime state
│   │   │   └── useAgent.ts        # Agent chat state
│   │   ├── utils/
│   │   │   ├── monaco-setup.ts    # Monaco theme, WP stubs
│   │   │   └── tauri-api.ts       # @tauri-apps/api wrappers
│   │   └── styles/
│   │       └── global.css
│   ├── __tests__/
│   │   ├── App.test.tsx
│   │   ├── ChatPanel.test.tsx
│   │   ├── DiffPanel.test.tsx
│   │   └── FirstRun.test.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── e2e/                          # End-to-end tests
│   ├── tauri/
│   │   ├── open-project.test.ts
│   │   ├── detect-wp.test.ts
│   │   ├── boot-preview.test.ts
│   │   ├── playbook-dynamic-block.test.ts
│   │   └── verify-preview.test.ts
│   ├── fixtures/
│   │   ├── sample-theme/
│   │   └── sample-plugin/
│   └── playwright.config.ts
│
├── Cargo.toml                    # Workspace root
├── package.json                  # Scripts, dev tooling
├── pnpm-workspace.yaml
├── rust-toolchain.toml
└── .github/workflows/
    ├── ci.yml                    # Rust tests + webview tests on PR
    └── e2e.yml                   # E2E on release branch
```

---

## 3. Build Phases

| Phase | Weeks | Output | Exit criteria |
|-------|-------|--------|---------------|
| **Phase 1** | 1–8 | Tauri shell, Monaco Editor, Rust tool bus, wp-env, chat, playbooks, first-run | Clean machine → live preview ≤10 min; P0 playbook completes |
| **Phase 2** | 9–16 | Knowledge graph, State Diffs, quality gates, staging pull, closed alpha | All §11 baselines collected; State Diff lifecycle demoed |
| **Phase 3** | 17–28 | Block/FSE workshop, deploy connectors, team playbooks, paid beta | — |
| **Phase 4** | 29+ | WooCommerce, multisite, maintenance agents, ecosystem | — |

---

## 4. Phase 1 — Foundation (Weeks 1–8)

8 sprints, one per week. Every sprint produces a passing integration test.

---

### Sprint 1: Tauri shell + Monaco Editor + project scaffold

**Goal:** A working Tauri window with Monaco Editor that opens a folder and shows a Wursor sidebar.

#### TDD sequence

**Step 1 — Write the test that defines "done"**

```typescript
// e2e/tauri/open-project.test.ts
import { test, expect } from '@playwright/test';
import { _electron as tauri } from 'tauri-playwright';

test('opens a folder and shows Wursor sidebar', async () => {
  const app = await tauri.launch({
    args: ['--project', '/path/to/fixtures/sample-theme'],
  });
  const window = await app.webview();
  await expect(window.locator('.wursor-sidebar')).toBeVisible();
  await expect(window.locator('.monaco-editor')).toBeVisible();
  await app.close();
});
```

**Step 2 — Write the Rust unit tests**

```rust
// src-tauri/src/commands/project.rs (tests module)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_valid_project() {
        let result = open_project("/path/to/fixtures/sample-theme");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_type, "classic-theme");
    }

    #[test]
    fn test_open_invalid_path() {
        let result = open_project("/nonexistent");
        assert!(result.is_err());
    }
}
```

**Step 3 — Write the webview unit tests**

```typescript
// webview/__tests__/App.test.tsx
describe('App', () => {
  it('renders Monaco Editor after project open', () => { /* ... */ });
  it('shows Wursor sidebar', () => { /* ... */ });
  it('displays project name in the title bar', () => { /* ... */ });
});
```

**Step 4 — Implement**

- **`src-tauri/src/main.rs`** — Tauri builder, register commands
- **`src-tauri/src/commands/project.rs`** — `open_project` command
- **`webview/src/App.tsx`** — Root layout: editor + sidebar
- **`webview/src/components/Editor.tsx`** — Monaco Editor wrapper (`@monaco-editor/react`)
- **`webview/src/components/ChatPanel.tsx`** — Sidebar (placeholder)
- **`webview/src/utils/monaco-setup.ts`** — Dark theme, PHP stubs, `block.json` schemas
- **`src-tauri/tauri.conf.json`** — Window config, permissions
- **`src-tauri/Cargo.toml`** — Dependencies: tauri, serde, tokio, etc.

#### Deliverables

- Tauri app that opens a folder and shows Monaco Editor + sidebar
- `e2e/tauri/open-project.test.ts` passing
- Rust unit tests for `open_project` command
- Webview unit tests for `App` component

---

### Sprint 2: Rust tool bus

**Goal:** All tools from §8.3 are registered Rust commands with schemas, handlers, and shell execution.

#### TDD sequence

**Step 1 — Write the Rust unit tests**

```rust
// src-tauri/src/tool-bus/registry.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_tool() {
        let mut registry = ToolRegistry::new();
        registry.register("fs.read", fs_schema(), fs_handler());
        assert!(registry.get("fs.read").is_some());
    }

    #[test]
    fn test_duplicate_tool_name_errors() {
        let mut registry = ToolRegistry::new();
        registry.register("fs.read", fs_schema(), fs_handler());
        assert!(registry.register("fs.read", fs_schema(), fs_handler()).is_err());
    }
}

// src-tauri/src/tool-bus/tools/fs.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fs_read_workspace_file() {
        let result = fs_read(FsReadArgs { path: "fixtures/sample.txt".into() }).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().content, "hello");
    }

    #[tokio::test]
    async fn test_fs_read_rejects_path_traversal() {
        let result = fs_read(FsReadArgs { path: "../../etc/passwd".into() }).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_fs_read_missing_file() {
        let result = fs_read(FsReadArgs { path: "nonexistent.txt".into() }).await;
        assert!(result.is_err());
    }
}

// src-tauri/src/tool-bus/tools/wpcli.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_wpcli_run_safe_command() {
        let result = wpcli_run(WpCliArgs {
            command: "wp option get blogname".into(),
            category: "safe".into(),
        }).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().exit_code, 0);
    }

    #[tokio::test]
    async fn test_wpcli_rejects_destructive_without_confirm() {
        let result = wpcli_run(WpCliArgs {
            command: "wp db drop".into(),
            category: "destructive".into(),
        }).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("confirmation required"));
    }
}

// src-tauri/src/tool-bus/executor.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_execute_shell_command() {
        let output = execute("echo hello", None).await.unwrap();
        assert_eq!(output.stdout.trim(), "hello");
    }

    #[tokio::test]
    async fn test_execute_timeout() {
        let result = execute("sleep 60", Some(Duration::from_millis(100))).await;
        assert!(result.is_err());
    }
}
```

**Step 2 — Implement**

- **`src-tauri/src/tool-bus/registry.rs`** — `HashMap<String, Tool>` with schema + handler
- **`src-tauri/src/tool-bus/tools/fs.rs`** — Path-scoped file operations
- **`src-tauri/src/tool-bus/tools/wpcli.rs`** — WP-CLI spawn with categorized allowlist
- **`src-tauri/src/tool-bus/tools/site.rs`** — HTTP fetch (reqwest) + screenshot via headless webview
- **`src-tauri/src/tool-bus/tools/db.rs`** — MySQL read-only query via mysql crate
- **`src-tauri/src/tool-bus/tools/lint.rs`** — PHPCS spawn
- **`src-tauri/src/tool-bus/tools/test_runner.rs`** — PHPUnit spawn
- **`src-tauri/src/tool-bus/tools/index.rs`** — Stub (throws "not implemented" until Phase 2)
- **`src-tauri/src/tool-bus/executor.rs`** — `tokio::process::Command` wrapper with timeout + streaming

#### Deliverables

- Rust tool registry with all 9 tools
- Each tool has unit tests for happy path, error path, and security boundary
- `cargo test --package tool-bus` passes

---

### Sprint 3: wp-env runtime manager

**Goal:** Start/stop/reset a WordPress site via wp-env from Rust, show status in the webview.

#### TDD sequence

**Step 1 — Write the tests**

```rust
// src-tauri/src/runtime-manager/lifecycle.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_start_wp_env() {
        let manager = RuntimeManager::new(WpEnvAdapter::new());
        let status = manager.start().await.unwrap();
        assert_eq!(status, RuntimeStatus::Running);
    }

    #[tokio::test]
    async fn test_stop_wp_env() {
        let manager = RuntimeManager::new(WpEnvAdapter::new());
        manager.start().await.unwrap();
        let status = manager.stop().await.unwrap();
        assert_eq!(status, RuntimeStatus::Stopped);
    }

    #[tokio::test]
    async fn test_status_when_stopped() {
        let manager = RuntimeManager::new(WpEnvAdapter::new());
        assert_eq!(manager.status().await, RuntimeStatus::Stopped);
    }

    #[tokio::test]
    async fn test_log_streaming() {
        let manager = RuntimeManager::new(WpEnvAdapter::new());
        let mut logs = manager.stream_logs().await.unwrap();
        let entry = logs.next().await;
        assert!(entry.is_some());
    }
}

// src-tauri/src/runtime-manager/adapters/wp_env.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_spawn_wp_env_start() {
        let adapter = WpEnvAdapter::new();
        let result = adapter.start().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_parse_wp_env_output() {
        let output = "WordPress development site.\n\nℹ http://localhost:8888\n\n✔ Okay!";
        let parsed = WpEnvAdapter::parse_output(output);
        assert_eq!(parsed.url, "http://localhost:8888");
    }

    #[tokio::test]
    async fn test_handle_wp_env_not_found() {
        let adapter = WpEnvAdapter::new();
        // Simulate missing wp-env by clearing PATH
        let result = adapter.start().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("wp-env not found"));
    }
}
```

```typescript
// webview/__tests__/Preview.test.tsx
describe('Preview', () => {
  it('shows a loading state while runtime starts', () => { /* ... */ });
  it('renders the site iframe when running', () => { /* ... */ });
  it('shows error state when runtime fails', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`src-tauri/src/runtime-manager/interface.rs`** — `RuntimeAdapter` trait
- **`src-tauri/src/runtime-manager/adapters/wp_env.rs`** — Spawns `npx wp-env start`, parses URL/creds
- **`src-tauri/src/runtime-manager/lifecycle.rs`** — State machine: Stopped → Starting → Running → Stopping → Stopped
- **`src-tauri/src/runtime-manager/logs.rs`** — Tail `wp-env logs` via tokio process
- **`src-tauri/src/commands/runtime.rs`** — `start_runtime`, `stop_runtime`, `runtime_status` IPC commands
- **`webview/src/components/Preview.tsx`** — iframe pointing to site URL
- **`webview/src/components/StatusBar.tsx`** — Runtime status indicator
- **`webview/src/hooks/useRuntime.ts`** — React hook subscribing to runtime state

#### Deliverables

- Rust runtime manager with wp-env adapter
- Preview panel showing the live site
- Status bar showing runtime state
- `cargo test --package runtime-manager` passing

---

### Sprint 4: Agent chat + diff review

**Goal:** Chat panel that sends tasks to Grok, receives tool calls, dispatches through the Rust tool bus, and shows diffs.

#### TDD sequence

**Step 1 — Write the tests**

```rust
// src-tauri/src/agent-bridge/client.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_send_message_to_grok() {
        let client = GrokClient::new("test-key");
        let response = client.send("Add a paragraph to index.php").await.unwrap();
        assert_eq!(response.message_type, "tool_call");
    }

    #[tokio::test]
    async fn test_handle_api_error() {
        let client = GrokClient::new("invalid-key");
        let result = client.send("hello").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("API error"));
    }
}

// src-tauri/src/agent-bridge/tool_schemas.rs
#[cfg(test)]
mod tests {
    #[test]
    fn test_converts_tool_registry_to_grok_format() {
        let schemas = to_grok_format(&registry);
        assert_eq!(schemas[0].name, "fs.read");
        assert!(schemas[0].input_schema.is_object());
    }
}

// src-tauri/src/agent-bridge/context.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_builds_system_prompt_with_wp_semantics() {
        let ctx = ContextBuilder::new()
            .with_project_rules("fixtures/WORDPRESS.md")
            .build();
        assert!(ctx.contains("WordPress"));
        assert!(ctx.contains("template hierarchy"));
    }
}
```

```typescript
// webview/__tests__/ChatPanel.test.tsx
describe('ChatPanel', () => {
  it('sends a message and displays the response', () => { /* ... */ });
  it('shows tool calls as expandable cards', () => { /* ... */ });
  it('shows diffs in a side-by-side view', () => { /* ... */ });
  it('shows error state when Grok is unreachable', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`src-tauri/src/agent-bridge/client.rs`** — Grok API client (messages API, tool use, streaming)
- **`src-tauri/src/agent-bridge/tool_schemas.rs`** — Convert tool registry → Grok `tools` array
- **`src-tauri/src/agent-bridge/context.rs`** — Build system prompt with WP semantics, project rules, graph state
- **`src-tauri/src/agent-bridge/fallback.rs`** — Error handling, retry with exponential backoff
- **`webview/src/components/ChatPanel.tsx`** — Chat UI (message list, input, tool call cards, streaming)
- **`webview/src/components/DiffPanel.tsx`** — Side-by-side diff view (Monaco diff editor)
- **`webview/src/hooks/useAgent.ts`** — React hook for agent state

#### Deliverables

- Working chat panel that sends to Grok and executes tool calls
- Diff view showing file changes
- `cargo test --package agent-bridge` passing
- Chat panel unit tests passing

---

### Sprint 5: Permission engine + WP-CLI

**Goal:** WP-CLI commands categorized and gated by permission tiers. Secrets redacted from agent context.

#### TDD sequence

**Step 1 — Write the tests**

```rust
// src-tauri/src/permission-engine/tiers.rs
#[cfg(test)]
mod tests {
    #[test]
    fn test_tiers_ordered() {
        assert!(Tier::ReadFs < Tier::EditFs);
        assert!(Tier::EditFs < Tier::WpCliSafe);
        assert!(Tier::WpCliSafe < Tier::WpCliDestructive);
    }

    #[test]
    fn test_all_tiers_defined() {
        assert_eq!(Tier::variants().len(), 7);
    }
}

// src-tauri/src/permission-engine/evaluator.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_allows_call_within_tier() {
        let policy = Policy::default();
        assert!(policy.evaluate("fs.read", Tier::ReadFs).await.is_ok());
    }

    #[tokio::test]
    async fn test_blocks_call_above_tier() {
        let policy = Policy::default().with_tier(Tier::ReadFs);
        assert!(policy.evaluate("wpcli.run", Tier::WpCliSafe).await.is_err());
    }

    #[tokio::test]
    async fn test_requires_confirm_for_destructive() {
        let policy = Policy::default().with_tier(Tier::WpCliDestructive);
        let result = policy.evaluate("wpcli.run", Tier::WpCliDestructive).await.unwrap();
        assert!(result.confirmation_required);
    }

    #[tokio::test]
    async fn test_blocks_production_writes() {
        let policy = Policy::default().with_environment(Environment::Production);
        assert!(policy.evaluate("fs.write", Tier::EditFs).await.is_err());
    }
}

// src-tauri/src/permission-engine/redactor.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_redacts_env_values() {
        let text = "DB_PASSWORD=secret123";
        let secrets = vec!["secret123".to_string()];
        assert!(!redact(text, &secrets).contains("secret123"));
    }

    #[tokio::test]
    async fn test_redacts_wp_config_constants() {
        let text = "define('DB_PASSWORD', 'secret123');";
        let result = redact(text, &[]).await;
        assert!(result.contains("[REDACTED]"));
    }

    #[tokio::test]
    async fn test_preserves_variable_names() {
        let text = "DB_PASSWORD=secret123";
        let result = redact(text, &["secret123".to_string()]);
        assert!(result.contains("DB_PASSWORD"));
    }
}
```

**Step 2 — Implement**

- **`src-tauri/src/permission-engine/tiers.rs`** — Ordered enum, 7 tiers
- **`src-tauri/src/permission-engine/evaluator.rs`** — Policy evaluator: current tier, environment, confirmation flag
- **`src-tauri/src/permission-engine/redactor.rs`** — Scan text for secrets, redact before sending to agent
- **`src-tauri/src/permission-engine/config.rs`** — User-defined policy from `.wursor/policy.json`
- Wire into **`src-tauri/src/tool-bus/tools/wpcli.rs`** — check permission before executing

#### Deliverables

- Rust permission engine with all 7 tiers
- Secret redaction for `.env` and `wp-config.php`
- WP-CLI tool categorized and gated
- `cargo test --package permission-engine` passing

---

### Sprint 6: P0 playbooks + first-run

**Goal:** Four P0 playbooks executable from the chat panel. First-run experience guides project open.

#### TDD sequence

**Step 1 — Write the tests**

```rust
// src-tauri/src/playbooks/dynamic_block.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_detects_build_setup() {
        let playbook = DynamicBlockPlaybook::new();
        let config = playbook.detect("fixtures/sample-theme").await.unwrap();
        assert_eq!(config.build_tool, "@wordpress/scripts");
    }

    #[tokio::test]
    async fn test_scaffolds_block_with_metadata() {
        let playbook = DynamicBlockPlaybook::new();
        let result = playbook.scaffold("testimonial").await.unwrap();
        assert!(result.files.contains("block.json"));
        assert!(result.files.contains("render.php"));
    }

    #[tokio::test]
    async fn test_verifies_block_in_editor() {
        let playbook = DynamicBlockPlaybook::new();
        assert!(playbook.verify("testimonial").await.unwrap());
    }
}

// src-tauri/src/playbooks/child_theme.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_creates_style_css_with_template_header() {
        let playbook = ChildThemePlaybook::new();
        let result = playbook.scaffold("twentytwentyfour", "my-child").await.unwrap();
        assert!(result.style_css.contains("Template: twentytwentyfour"));
    }
}

// src-tauri/src/playbooks/cpt.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_registers_cpt_with_rest_support() {
        let playbook = CptPlaybook::new();
        let result = playbook.register("book", "books").await.unwrap();
        assert!(result.php.contains("show_in_rest"));
    }

    #[tokio::test]
    async fn test_flushes_rewrite_rules() {
        let playbook = CptPlaybook::new();
        assert!(playbook.flush_rewrites().await.is_ok());
    }

    #[tokio::test]
    async fn test_verifies_rest_endpoint() {
        let playbook = CptPlaybook::new();
        let result = playbook.verify_rest("book").await.unwrap();
        assert!(result.status_ok);
    }
}

// src-tauri/src/playbooks/plugin.rs
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_creates_plugin_headers() {
        let playbook = PluginPlaybook::new();
        let result = playbook.scaffold("my-plugin", "My Plugin").await.unwrap();
        assert!(result.main_php.contains("Plugin Name: My Plugin"));
    }
}
```

```typescript
// webview/__tests__/FirstRun.test.tsx
describe('FirstRun', () => {
  it('shows three project paths on first launch', () => { /* ... */ });
  it('detects Docker and wp-env, guides install if missing', () => { /* ... */ });
  it('opens a project and shows the workspace within 10 minutes', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`src-tauri/src/playbooks/registry.rs`** — Playbook registration
- **`src-tauri/src/playbooks/dynamic_block.rs`** — detect → scaffold → register → build → verify → diff
- **`src-tauri/src/playbooks/child_theme.rs`** — scaffold → enqueue → override → screenshot
- **`src-tauri/src/playbooks/cpt.rs`** — register → flush → seed → REST check → diff
- **`src-tauri/src/playbooks/plugin.rs`** — headers → optional Composer/PHPUnit
- **`webview/src/components/FirstRun.tsx`** — Onboarding wizard (3 paths: WP repo, folder, sample)
- **`src-tauri/src/commands/project.rs`** — Dependency check command

#### Deliverables

- 4 P0 playbooks with Rust unit tests
- First-run dialog (3 paths)
- `cargo test --package playbooks` passing

---

### Sprint 7: Integration + exit criteria

**Goal:** All Phase 1 pieces work together. Exit criteria tests pass end-to-end.

#### Integration tests

```typescript
// e2e/tauri/phase1-exit-criteria.test.ts
import { test, expect } from '@playwright/test';

test('clean machine → live preview in ≤10 min', async () => {
  const app = await tauri.launch({ args: [] });
  const window = await app.webview();
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
  const app = await tauri.launch({ args: ['/path/to/fixtures/sample-theme'] });
  const window = await app.webview();

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
```

```rust
// src-tauri/tests/tool_bus_test.rs
#[cfg(test)]
mod integration_tests {
    #[tokio::test]
    async fn test_tool_bus_integration() {
        let registry = build_registry();
        let tool = registry.get("fs.read").unwrap();
        let result = (tool.handler)(serde_json::json!({"path": "fixtures/sample.txt"})).await;
        assert!(result.is_ok());
    }
}
```

#### Deliverables

- Both exit criteria tests passing
- `cargo test` passing (all Rust unit + integration tests)
- `pnpm test:webview` passing (all webview tests)

---

### Sprint 8: Polish + alpha readiness

**Goal:** Error states from §8.5 handled, app packaging works, build ready for internal alpha.

#### Tasks

- **Error states** — Wire each state from PRD §8.5 into the webview UI
- **App packaging** — `tauri build` produces signed `.dmg` (macOS) and `.msi` (Windows)
- **Auto-update** — Tauri updater with GitHub releases
- **Telemetry** — Minimal events (preview load time, playbook run, verify result) with consent dialog
- **Documentation** — `README.md` with install instructions and quickstart
- **Bug bash** — Internal team runs through first-run + playbook flow

#### Deliverables

- Signed app bundles for macOS + Windows
- Auto-update mechanism
- Error states all wired in the webview
- Minimal telemetry with consent
- `README.md` updated for alpha users

---

## 5. Phase 2 — Intelligence (Weeks 9–16)

*High-level outline — full breakdown follows Phase 1 exit.*

| Sprint | Focus | Crates |
|--------|-------|--------|
| 9 | Knowledge graph static scanner | `src-tauri/src/knowledge-index/scanner.rs` |
| 10 | Knowledge graph runtime enricher | `src-tauri/src/knowledge-index/enricher.rs` |
| 11 | Knowledge graph queries + UI | `src-tauri/src/knowledge-index/queries.rs`, tree view in webview |
| 12 | State Diff lifecycle | `src-tauri/src/state-diff/lifecycle.rs` |
| 13 | State Diff UI + rollback | `src-tauri/src/state-diff/rollback.rs`, StateDiffPanel |
| 14 | Quality gates (PHPCS, PHPUnit) | `src-tauri/src/tool-bus/tools/lint.rs`, `test_runner.rs` |
| 15 | Staging pull connector | `src-tauri/src/tool-bus/tools/staging.rs` |
| 16 | Closed alpha ship + baseline collection | Telemetry review, §11 baselines |

---

## 6. TDD Rules

These rules apply to every sprint:

1. **Write the test first.** No implementation code is written without a failing test.
2. **One assertion per test.** Each test verifies exactly one behavior.
3. **Tests are deterministic.** No network calls in unit tests (mock Grok API, mock wp-env).
4. **Integration tests use fixtures.** Sample WP repos live in `src-tauri/fixtures/` and `e2e/fixtures/`.
5. **Red → Green → Refactor.** Write the failing test (red), make it pass (green), then clean up (refactor).
6. **Coverage floor.** Rust: `cargo-tarpaulin` enforces ≥ 90% line coverage. Webview: vitest enforces ≥ 90%.
7. **No skipped tests in main.** `#[ignore]` and `test.only` only in feature branches.

### Test naming convention

Rust: `{module}_{behavior}` (e.g. `fs_read_rejects_path_traversal`)
TypeScript: `{module}.{behavior}.test.ts` (e.g. `fs.read-workspace-file.test.ts`)

---

## 7. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml — runs on every PR
name: CI
on: [pull_request]
jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --all-features
      - run: cargo tarpaulin --out Xml --skip-clean
        # Enforces 90% coverage floor

  webview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test -- --coverage  # Enforces 90% coverage

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo clippy --all-targets -- -D warnings
      - uses: pnpm/action-setup@v2
      - run: pnpm install && pnpm lint

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
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: cargo build --release
      - run: pnpm test:e2e
```

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Tool bus** | Rust registry and executor for all agent-callable tools (fs, wpcli, site, db, etc.) |
| **Runtime adapter** | Rust trait that abstracts wp-env (v1) behind a common interface for future backends |
| **Playbook** | A reusable, multi-step agent workflow (scaffold block, create CPT, etc.) |
| **State Diff** | A reviewable mutation plan for WP content/state (CLI commands, SQL, or migration) |
| **Permission tier** | A capability level (read FS → edit FS → WP-CLI safe → destructive → etc.) |
| **Verify** | Required proof step: screenshot, HTTP check, or editor route confirmation |
| **Knowledge graph** | Rust-indexed map of themes, plugins, blocks, hooks, and REST routes |

---

*End of Implementation Guide v1.1 — Wursor*