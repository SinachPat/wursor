# Product Requirements Document

**Wursor**

The Agentic WordPress Development Environment

*Where WordPress products get built — code, site, and shipping in one loop.*

| Field | Value |
| :--- | :--- |
| **Version** | 1.3 |
| **Date** | August 13, 2026 |
| **Author** | Patrick (Product Lead) |
| **Status** | Draft — Internal (key decisions locked; Phase 0) |
| **Repo** | SinachPat/wursor (renamed from originmain) |
| **Classification** | Confidential |
| **Supersedes** | v1.2 (shell → Tauri/Monaco; model → Grok) |

---

## 1. Executive Summary

Wursor is a development environment built for people who ship on WordPress. It combines an AI agent that can plan and edit real project code with a live WordPress runtime, WP-CLI, database awareness, and preview — so building a theme, plugin, or block is not split across five apps and a hope that the model "knows WordPress."

WordPress work is not generic app development. The product surface is a CMS platform with themes, plugins, hooks, a block editor, content in MySQL, and a long tail of agency and product workflows. Today's stack forces builders to keep that reality in their head while jumping between an editor, a local site tool, wp-admin, a terminal for WP-CLI, and a database client.

Wursor makes that reality the environment:

- A **site you can boot, browse, reset, and inspect** sits beside the code.
- The agent is taught **WordPress semantics** — template hierarchy, hooks, `block.json`, capabilities, text domains — not only PHP syntax.
- Changes show up as **reviewable code diffs** and, when content or options must move, as explicit **State Diffs** (WP-CLI / migration scripts), never silent database edits.
- **Blocks and block themes** are first-class: `theme.json`, patterns, template parts, and editor preview.
- **Environments matter**: local → staging → production, with write access gated by policy.

**The opportunity:** become the default professional workspace for WordPress product and agency teams in an agent-assisted era — without pretending WordPress is "just another repo."

---

## 2. Problem Statement

### 2.1 WordPress is a platform, not a folder of PHP

Competent general coding agents still miss what breaks real WP projects:

- The split between **code** (themes/plugins) and **content/state** (posts, options, post meta, transients).
- **Load order** and hook timing (`plugins_loaded` vs `init` vs `wp_enqueue_scripts`).
- **Child themes**, template hierarchy, and the dual world of classic vs block themes.
- **WP-CLI** as the practical automation layer.
- **Multisite**, capabilities, nonces, and auth patterns.
- **Block development** (`block.json`, `render.php`, editor scripts, `@wordpress/scripts`).

The failure mode is confident patches that enqueue wrong, ignore APIs WordPress already provides, or "fix" a theme without ever loading the site.

### 2.2 The toolchain is fragmented

| Concern | Typical tool today |
| :--- | :--- |
| Edit code | General IDE / editor |
| Run site | Local WP, DDEV, Lando, wp-env, Docker |
| Admin / content | wp-admin in a browser |
| Automate | WP-CLI in a separate terminal |
| Database | phpMyAdmin / TablePlus |
| Assist | Chat tools with no live site context |
| Deploy | FTP, rsync, Git + host pipelines, site managers |

Every hop drops context. Nothing in that chain can scaffold a block, flush rewrites, open the editor, and prove the front end in one continuous run.

### 2.3 Agencies and product teams buy turnaround

WordPress shops compete on speed and reliability. Friction is environment spin-up, safe changes across code and data, regression checks on real themes, and handoff between design, content, and engineering. Host "AI" features aimed at writing posts do not solve that.

### 2.4 Blast radius is real

WordPress sites are high-value targets. An agent that can edit `wp-config.php`, install arbitrary zips, or run unchecked SQL is a liability. **Safe-by-default permissions** are a core product requirement.

---

## 3. Vision & Opportunity

**Vision:** Open a WordPress project in Wursor and you get a workspace that already understands the shape of the project, can start the site, and can take a job like "add a pricing block that matches our patterns and verify it on /pricing" through edit → CLI → preview → review in one place.

Wursor sits at the intersection of:

| Category | What exists | What Wursor adds |
| :--- | :--- | :--- |
| AI-assisted coding | General editors and agents | WP-native tools, playbooks, and site loop |
| Local WP environments | Local, DDEV, wp-env | Runtime embedded and controllable by the agent |
| In-admin AI helpers | Host and plugin copilots | Real engineering workspace (Git, diffs, tests), not post drafting |
| Block / theme tooling | `@wordpress/scripts`, theme.json editors | Unified with agent + live preview |

**Positioning:** Wursor is the agentic **WordPress workshop** — not a generic coding assistant with a WordPress sticker, and not an AI writing widget inside wp-admin.

---

## 4. Target Users & Personas

### 4.1 Primary — Agency WordPress Engineer

Ships custom themes/plugins for clients on deadline. Wants faster scaffolding, safer refactors, fewer context switches. Uses Git; distrusts mystery FTP deploys.

### 4.2 Primary — Plugin / Block Product Developer

Ships commercial or open-source plugins and block libraries. Needs scaffolding, wp-env, WPCS, tests, and release hygiene. Cares about headers, text domains, and build pipelines.

### 4.3 Secondary — Technical Founder / Solo Builder

Runs a business on WordPress (WooCommerce, membership, LMS). Wants senior-WP leverage without a full bench.

### 4.4 Secondary — Design Engineer on Block Themes

Lives in `theme.json`, patterns, and template parts. Needs structured edits plus visual proof.

### 4.5 Tertiary — Technical PM / Solutions Architect

Scopes builds, reviews proposed changes, cares about migration plans and staging checks.

**Out of scope for v1:** content-only users who mainly need AI inside wp-admin to draft posts.

---

## 5. Product Principles

1. **Site is a runtime, not a folder** — If it cannot boot, browse, and assert against WordPress, it is guessing.
2. **Code and state are both first-class** — File diffs and explicit State Diffs; no silent DB mutation.
3. **WordPress semantics over generic PHP** — Prefer platform APIs, hooks, and patterns a senior WP engineer would choose.
4. **Safe by default** — Capability-scoped tools; production gated; secrets redacted; destructive ops require confirmation.
5. **Preview is proof** — The agent cannot mark a task "done" without a verify step (screenshot, HTTP check, or editor verification). Users may dismiss the proof; the agent may not skip producing it.
6. **Git records code; scripts record state** — Migrations and WP-CLI plans are reviewable artifacts.
7. **Opinionated for WordPress** — Defaults follow WPCS, wp-env, and block-era workflows; escape hatches exist but are not the center.

---

## 6. Core Concepts & Mental Model

### 6.1 Workspace = Project + Site

A **Workspace** binds:

- A Git project (theme, plugin, plugin monorepo, `wp-content` checkout, or Composer/Bedrock layout)
- A **site runtime** (wp-env by default; Docker / Local / DDEV import paths)
- Environment config (local / staging / production endpoints and a credentials vault)

> **v1 scope (locked):** wp-env is the *only* supported runtime in v1. Local / DDEV / Bedrock import is P1 (§7.2.6). The runtime manager is still abstraction-bound (§8.1) so adding those backends later does not require a redesign.

### 6.2 WordPress Knowledge Graph

Indexed understanding of:

- Themes / child themes / active theme
- Plugins (active, mu-plugins, drop-ins)
- CPTs, taxonomies, REST routes
- Hook registrations (best-effort from code)
- Block inventory (`block.json`)
- `theme.json` tokens and style variations
- Template hierarchy for key routes

**Build source (locked):** two passes. (1) *Static* — scan of `*.php`, `block.json`, `theme.json`, and plugin/theme headers at project open, refreshed on file-save and on git checkout. (2) *Runtime* — when the site is up, enrich via WP-CLI (`wp plugin list`, `wp theme list`, `wp post-type list`, `wp rewrite list`) with the *actual* active theme, active plugins, registered CPTs/taxonomies, and REST routes.

**Freshness model:** every graph node carries a source stamp (static vs runtime) and timestamp. Both the agent context and the UI surface staleness explicitly (e.g., "active theme — static scan, site not loaded"). Full re-index runs on project open and on every `site.browse` boot; incremental updates follow file-save events. Runtime nodes are re-verified each time the site boots.

### 6.3 The build loop

Plan → edit files → run WP-CLI / tests → refresh preview → read logs → revise. Every step uses WordPress-aware tools.

### 6.4 State Diffs

When a task needs content or options changes, Wursor proposes a **State Diff**: WP-CLI commands and/or a migration script — never an invisible database tweak. The lifecycle is explicit:

1. **Create** — the agent generates a candidate diff (WP-CLI commands, SQL statements, or a PHP migration), each step annotated with intent and blast radius.
2. **Review** — shown in the State tab; every step expands to full text and effect; nothing runs without review.
3. **Stage** — approved steps form a numbered plan; steps can be reordered or dropped.
4. **Apply** — executes against the local environment by default; each step streams output and marks pass/fail.
5. **Verify** — the agent re-checks the site (option read-back, URL load, screenshot) before the diff counts as applied.
6. **Commit** — migration-style state scripts commit to the repo as `db/` migrations; pure WP-CLI plans persist as reviewable `.state-diff.json` artifacts under `.wursor/state-diffs/`.

**Rollback (locked):** destructive steps must declare an inverse at create time (e.g., `wp option delete` paired with the prior value) or an explicit "manual backup required" acknowledgment; Wursor refuses to stage a destructive step without one.

### 6.5 Rules & Playbooks

Project guidance lives in `WORDPRESS.md` / `.wursor/rules` (standards, banned patterns, deploy checklists). **Playbooks** are reusable workflows: scaffold a dynamic block, spin a child theme, register a CPT, harden a plugin release.

### 6.6 Environments

- **Local** — full control for the agent under user policy  
- **Staging** — sync down and careful promote  
- **Production** — read/observe by default; write only with explicit break-glass  

---

## 7. Feature Requirements

**P0** = launch-blocking · **P1** = ~30–60 days post-launch · **P2** = strategic

### 7.1 P0 — Launch Blocking

#### 7.1.1 Agentic editing workspace
- Project-aware chat with file/symbol/doc context
- Inline rewrite of selections
- Multi-file agent runs with reviewable patches
- Integrated terminal
- Git status, diff review, commit assist
- Project rules (`WORDPRESS.md`, `.wursor/rules`)

#### 7.1.2 WordPress project intelligence
- Detect project shape: classic theme, block theme, single plugin, `wp-content` tree, Bedrock/Composer
- When the site is up: map active theme and plugins
- PHP + block JS support with WordPress stubs
- Template hierarchy and `block.json` awareness

#### 7.1.3 Embedded local site runtime
- Start/stop/reset via **wp-env** — the only supported runtime in v1 (the emitted Docker compose file is for debugging, not an alternative surface)
- Embedded preview (front end + wp-admin)
- Log tail (PHP / web server; Query Monitor later)
- Runtime manager is abstraction-bound (§8.1); Local / DDEV import (P1) plugs in behind the same interface

#### 7.1.4 WP-CLI as an agent tool
- Allowlisted WP-CLI runner
- Recipes: scaffold plugin/theme/block, rewrite flush, cache flush, activate plugins, local DB export/import
- Preview destructive commands before run

#### 7.1.5 Permissions & safety
- Tiers: read FS, edit FS, WP-CLI safe, WP-CLI destructive, SQL read, SQL write, network install
- Production writes off by default
- Redact secrets from `.env` / `wp-config` in agent context; scan on apply

#### 7.1.6 Preview verification
- Verify runs by default on every agent task and is required before the agent marks a task "done" (Principle 5); users may dismiss the proof, the agent cannot skip producing it
- Verify step: load URLs, screenshot, HTTP status + basic error sniff (PHP error log, 500s)
- For block tasks: open editor routes and confirm the block can be inserted (lightweight P0)
- Failures surface explicitly — "verify failed: /pricing returned 500" with the log excerpt — never a silent retry

#### 7.1.7 Scaffolding playbooks
- Plugin (headers, text domain, optional Composer/PHPUnit)
- Static / dynamic block (`@wordpress/scripts`)
- Child theme
- CPT + REST + minimal admin UI

#### 7.1.8 First-run experience
- Install: single signed app bundle (macOS + Windows; Linux best-effort); no Docker prompt before first project open
- First open: guided "open a project" with three paths — a WordPress repo (auto-detects wp-env config), a plain theme/plugin folder, or a built-in sample project
- Dependency check: Docker / wp-env detection with one-click install guidance and a diagnostic panel — a dead end is not an option
- First preview target: ≤ 10 minutes p50 from install to a live preview (§11)

### 7.2 P1 — Follow-on

#### 7.2.1 Database & options introspection
- Read-only schema explorer and options search
- Explain an options row with link-back to plugin code when possible
- State Diff generation for options / post meta

#### 7.2.2 Block & FSE workshop
- Structured `theme.json` editing + agent tools
- Pattern export/import as files
- Best-effort jump from preview selection → template part / block source

#### 7.2.3 Quality gates
- PHPCS + WordPress Coding Standards
- PHPUnit / e2e hooks (Playwright or wp-env-based)
- Agent runs configured gates before marking work done

#### 7.2.4 Staging connectors
- Explicit, logged pull of DB/media from staging
- Deploy via GitHub Actions / host APIs
- Production DB pull requires double confirm + scrubbing warnings

#### 7.2.5 Hook & REST introspection
- Live REST route list from the site
- Assist for `add_action` / `add_filter` discovery

#### 7.2.6 Import paths
- Open Local WP / DDEV projects
- Zero-config open for existing wp-env repos

### 7.3 P2 — Strategic

- WooCommerce-oriented skills  
- Multisite tools  
- Host integrations (WP Cloud, SpinupWP, Rocket.net, etc.)  
- Team workspaces and shared playbooks for agencies  
- Sandboxed maintenance agent (updates, conflict triage)  
- Optional design intake (e.g. Figma → patterns)  
- Headless / hybrid (Faust, Next) workspaces  

---

## 8. Architecture & System Design

### 8.1 Layers

> **Shell decision (locked):** Native desktop app built on **Tauri + Monaco Editor**. Tauri (Rust shell, system webview) gives fast startup (~0.3–0.8s), low memory (100–200MB), and native filesystem/Docker/process access. Monaco Editor is the same editor component that powers VS Code — editing, language services, and diff views without Electron's Chromium overhead. Rust owns the tool bus, knowledge graph parser, permission engine, and runtime manager; the webview renders the editor and Wursor panels (TypeScript/HTML).
>
> **Why not Electron + Code-OSS:** Electron ships an entire Chromium per app (500MB–1GB memory, 2–6s startup) — a constant quality-of-life cost for a daily-driver dev tool. Tauri uses the OS webview, which is already resident.
>
> **Why not Zed:** immature ecosystem, no Monaco/VS Code editor quality, and its agent story is not Claude/Grok-style tool-calling. The product is the WP+agent loop, not the editor.

| Layer | Responsibility |
| :--- | :--- |
| **Workspace shell** | Tauri window, Monaco Editor, Wursor panels (preview, diff, state, chat), terminal |
| **WP language services** | PHP/JS, stubs, `block.json`, `theme.json` schemas (Monaco language services + WP stubs) |
| **Site runtime manager** | wp-env/Docker lifecycle, ports, credentials (Rust; abstraction-bound for future backends) |
| **Agent tool bus** | Files, WP-CLI, HTTP preview, DB read, linters (Rust; one tool schema per tool) |
| **Knowledge index** | Code index + WP graph (Rust parser; static scan + runtime enrichment) |
| **Policy engine** | Permissions, environment gates, secret redaction (Rust) |
| **Preview / verify** | Embedded webview, screenshots, HTTP checks, error sniff |
| **Connectors** | GitHub, staging hosts, optional design tools |

### 8.1.1 Agent substrate (locked)

- **Model:** Grok (xAI) — agentic coding model; BYO API key at launch
- **Routing:** All agent traffic goes through the user's own API key — no Wursor-hosted model tier in v1
- **Tool-calling protocol:** Every agent tool (§8.3) is a single tool schema, not a prompt chain. The agent calls tools; the tool bus executes against the local environment
- **Fallback:** If the model is unreachable or returns an error, the agent panel shows a clear "Model unavailable" state with the raw error, logs, and a retry button. The workspace shell (editing, terminal, preview) remains fully functional
- **P1 upsell:** Optional Wursor-hosted routing tier for users who prefer a managed key or bundled tokens

### 8.2 Default local stack
- **wp-env** for local + CI parity (sole runtime in v1; runtime manager abstraction-bound for future backends)
- MySQL as default; optional ultralight SQLite path for demos only
- Node LTS for block builds

### 8.3 Initial agent tools
- `fs.read` / `fs.write` / `fs.apply_patch`
- `wpcli.run` (categorized)
- `site.browse` / `site.screenshot`
- `site.request` (front / REST)
- `db.query` (read-only default)
- `lint.phpcs` / `test.phpunit`
- `index.search` / `wp.graph.lookup`

### 8.4 Example flow
1. "Add an FAQ accordion block and show it on /pricing."
2. Detect theme type, build setup, existing patterns.
3. Scaffold and register the block; wire pattern or template.
4. Build assets; flush as needed via WP-CLI.
5. Load /pricing and editor insert path; capture proof.
6. Present file diffs (+ State Diff if any); user accepts.

### 8.5 Error & offline states

| State | What Wursor does |
| :--- | :--- |
| **Docker not installed** | Detect at project open; show diagnostic panel with one-click install guide; app remains usable for file editing and git |
| **wp-env not found** | Offer to install via npm; fall back to npx |
| **Site won't boot** | Stream logs live; highlight the first error; offer "reset" and "last known good config" |
| **Model unreachable** | Show raw error + retry; workspace shell stays fully functional |
| **API key invalid / expired** | Prompt for key update inline; no data loss |
| **Network offline** | Cache last-known graph state; agent panel shows "offline" warning; local site and editing unaffected |
| **File permission denied** | Surface the OS-level error; no silent fallback to a different path |

---

## 9. UX Notes

- Dark-first, dense workshop UI; calm over theatrical  
- **Site status bar:** environment, WP version, active theme, permission mode  
- **Diff view:** Files tab + State tab  
- **Preview:** dockable; device widths; view-as role (Admin / Editor / Customer)  
- Keyboard-complete for agent flows; escape hatch from preview focus  

---

## 10. Competitive Landscape

| Product type | Strength | Gap Wursor fills |
| :--- | :--- | :--- |
| General AI code editors | Strong general coding agents | No WordPress runtime loop or WP semantics |
| Classic PHP IDEs | Deep PHP tooling | Weak agent-native site loop |
| Local WP apps | Easy site spin-up | Not an engineering agent workspace |
| wp-env / DDEV | Solid runtimes | CLI-centric; no integrated agent UX |
| Host / plugin AI | Handy in wp-admin | Content-oriented; not Git/theme/plugin shipping |
| Page builders | Fast visual pages | Different paradigm; not Wursor's v1 center |

**Moat:** WP knowledge graph + controllable runtime + policy-aware tools + verify-via-preview, packaged as playbooks agencies and plugin teams repeat weekly.

---

## 11. Metrics & Success Criteria

| Metric | Baseline | 6-month target | Owner | How we measure |
| :--- | :--- | :--- | :--- | :--- |
| Time to first local preview from new workspace | TBD (Phase 0 spike) | ≤ 10 min p50 | Eng lead | In-app timer from project open to first rendered preview |
| Accepted agent runs on P0 playbooks (little rework) | TBD (alpha 1) | ≥ 60% | PM | Per-playbook accept/reject event, tagged by playbook |
| Verify step catches issues before accept | TBD (alpha 1) | ≥ 30% of failing tasks | PM | Verify-fail event before accept, per task |
| Trial → weekly habit by week 4 | TBD | ≥ 40% | PM | Weekly active usage per trial cohort |
| Paying seats | n/a | TBD with pricing | GTM | Billing records |

**Measurement plan:** all metrics instrumented from first alpha build (Phase 2). Every metric is a dashboarded event, not a manual tally. Baselines are collected during closed alpha (10–20 agencies / plugin teams) and reviewed as Phase 2 exit criteria.

Qualitative bar: experienced WordPress engineers say it behaves like someone who has shipped WP for years.

---

## 12. Phased Roadmap

### Phase 0 — Pivot & spec (now)
- Clear prior product codebase  
- PRD + naming  
- Spike: wp-env control plane + agent tool bus  

### Phase 1 — Foundation (weeks 1–8)
- Ship Tauri shell on Monaco Editor (reused editor component; no greenfield chrome)
- Project open + WP detection
- wp-env lifecycle + preview
- Agent chat + diffs + rules
- WP-CLI tool + permission engine
- P0 playbooks

**Exit criteria:** a new user on a clean machine (no Docker, no wp-env) reaches a live preview of a WordPress repo in ≤ 10 minutes, and a P0 playbook (dynamic block) completes with a verified preview + accepted diff.

### Phase 2 — Intelligence (weeks 9–16)
- Knowledge graph v1 (static + runtime passes)
- WPCS / tests in the loop
- State Diffs + read-only DB introspection
- Careful staging pull
- Closed alpha (10–20 agencies / plugin teams)

**Exit criteria:** all §11 baselines collected and reviewed; knowledge graph staleness surfaced in UI; State Diff create→rollback loop demoed on a destructive option change.

### Phase 3 — Professional (weeks 17–28)
- Block / FSE workshop  
- Role-based preview  
- Host deploy connectors  
- Shared team playbooks  
- Paid beta  

### Phase 4 — Platform
- WooCommerce, multisite, maintenance agents, ecosystem connectors  

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Building a full workspace is large | High | Tauri + Monaco (reused editor component, no greenfield editor); WP runtime + tools get the focus |
| Local Docker/wp-env pain (esp. Windows) | High | Diagnostics-first first-run; installer guides; early Local/DDEV import (P1) |
| Agent harms a site | High | Permission tiers; local-default; production lock; State Diffs with rollback |
| "Prompts in my current editor are enough" | Medium | Demo the site loop and playbooks general setups fail |
| Legacy PHP / chaotic themes | Medium | Stubs, WPCS, honest limits; playbooks for clean paths first |
| Repo still named originmain | Resolved | Repo renamed to SinachPat/wursor |
| Trademark / "WordPress" in marketing | Medium | Follow WordPress Foundation trademark rules |
| LLM provider outage / model churn | Medium | BYO-key model; workspace shell stays usable offline; P1 hosted routing tier |
| Docker Desktop licensing for commercial use | Low | Document; wp-env alternatives; Rancher Desktop path |

---

## 14. Decisions & Open Questions (Phase 0)

### Resolved (locked)

1. **Shell:** Native desktop app on Tauri (Rust shell, system webview) + Monaco Editor (the editor core that powers VS Code). Fast startup (~0.3–0.8s), low memory (100–200MB), native filesystem/Docker/process access, offline-capable. Rust backend; webview UI in TypeScript.
2. **Name:** Wursor (locked in v1.2; no further rename planned).
3. **Repo:** renamed to `SinachPat/wursor`.
4. **Pricing:** seat-based ($X/dev/month, free tier with per-seat limits); agency teams primary. Final $X set during Phase 3 paid beta.
5. **Roots/Bedrock/Trellis support:** P1 (not v1). wp-env covers the launch segment; runtime manager is abstraction-bound for later import.
6. **Models:** Grok (xAI) via BYO API key (v1); optional Wursor-hosted routing tier (P1 upsell). No local model support in v1.
7. **Runtime backends:** wp-env only in v1; Local / DDEV import is P1.

### Remaining (genuinely open)

All Phase 0 questions are resolved above. New questions will be documented per phase and resolved before the next phase begins.

---

## 15. Appendices

### A. Glossary
- **Workspace** — Project + site runtime + environment config bound together
- **State Diff** — Reviewable WP-CLI / SQL / content mutation plan with a create→review→apply→rollback lifecycle
- **Playbook** — Reusable agent workflow with tools and checks
- **WP Knowledge Graph** — Map of themes, plugins, blocks, hooks, REST (static scan + runtime enrichment)
- **Runtime** — The site execution environment (wp-env in v1)
- **Environment** — A target (local / staging / production) with endpoints and policy
- **Verify** — The proof step (screenshot / HTTP check / editor confirmation) required before a task is "done"
- **FSE** — Full Site Editing (block themes)
- **wp-env** — `@wordpress/env` local environment

### B. P0 playbook sketches
1. **Dynamic block** — detect build → scaffold → register → build → verify in editor → diff  
2. **Child theme** — scaffold → enqueue parent → override template → screenshot home  
3. **CPT** — register → flush rewrites → seed via WP-CLI → REST check → diff  

### C. Non-goals (v1)
- Replacing wp-admin for authors
- Unattended production hotfixes
- Competing with Elementor-class page builders as the core offer
- Equal-class support for every legacy builder shortcode ecosystem on day one
- A public extension/plugin API — connectors are internal; third-party integration ships after platform phase
- Local / DDEV / Bedrock imports — P1 (§7.2.6)
- Managed/hosted model tier — P1 upsell
- **Accessibility certification (WCAG) or i18n / localization** — v1 is English-only with no formal accessibility conformance target. Basic keyboard navigation and screen reader support come from Monaco and the webview's standard web accessibility practices; custom Wursor panels will not be audited until Phase 3.

### C.1 Wursor's own test strategy
- **Unit + integration tests** for the agent tool bus (each tool schema), the permission engine, and the State Diff lifecycle
- **Fixture-based WP repos** in CI (wp-env in GitHub Actions) to test detection, indexing, and playbooks without a live install
- **E2E smoke** on the Tauri shell: open → detect → boot → preview → verify
- **Release gates:** CI runs Rust + webview tests on every PR; e2e before each release

### D. One-liner
**Wursor is the agentic workshop for WordPress — code, WP-CLI, data, and a live site in one loop.**

---

*End of PRD v1.3 — Wursor*
