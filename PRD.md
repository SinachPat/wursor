# Product Requirements Document

**Wordbench**

The Agentic WordPress Development Environment

*Cursor for how software gets built. WordPress for how the web gets published. Wordbench is both.*

| Field | Value |
| :--- | :--- |
| **Version** | 1.0 |
| **Date** | August 12, 2026 |
| **Author** | Patrick (Product Lead) |
| **Status** | Draft — Internal |
| **Repo** | SinachPat/originmain (pivoting; rename TBD) |
| **Classification** | Confidential |

---

## 1. Executive Summary

Wordbench is an agentic development environment purpose-built for WordPress. It takes everything that makes Cursor transformative for general software engineering — repo-aware chat, multi-file agents, inline edit, terminal control, diffs you can trust, project rules, and tool use — and rebuilds it around how WordPress actually works: themes, plugins, blocks, hooks, the template hierarchy, WP-CLI, MySQL state, staging/production, and the plugin/theme ecosystem.

Today, WordPress builders bounce between Local/DDEV, VS Code/PhpStorm, a browser admin, WP-CLI in a separate terminal, phpMyAdmin, and ChatGPT tabs that do not know their `functions.php` from a mu-plugin. Agents that are great at TypeScript are naïve about `add_action`, `block.json`, or why a change in `theme.json` did not appear on the front end.

Wordbench collapses that into one environment where:

- The **site is a first-class runtime** (local WordPress you can boot, browse, and reset), not just a folder of files.
- The agent understands **WordPress semantics** (hooks, template hierarchy, CPT/taxonomies, block editor, WooCommerce patterns), not only PHP/JS syntax.
- Changes are proposed as reviewable diffs against theme/plugin code **and** as intentional WP-CLI / database operations when state must change.
- Design-to-build for blocks and FSE themes is native: edit `theme.json`, register blocks, sync patterns, preview in an embedded site frame.
- Shipping means **environments** (local → staging → production), not only `git push`.

**The opportunity:** be the default professional environment for anyone who builds with WordPress in an agent-native world — agencies, product teams on WP headless/hybrid, plugin vendors, and ambitious solo builders.

---

## 2. Problem Statement

### 2.1 Cursor is general; WordPress is a platform

General coding agents treat a WordPress project like any PHP app. They miss:

- The split between **code** (themes/plugins) and **content/state** (posts, options, post meta, transients).
- **Load order** and hook timing (`plugins_loaded` vs `init` vs `wp_enqueue_scripts`).
- **Child themes**, template hierarchy, and block theme / classic theme dual world.
- **WP-CLI** as the real automation API.
- **Multisite**, capability checks, and nonce/auth patterns.
- **Gutenberg** block development (`block.json`, `render.php`, editor APIs).

Result: plausible patches that break production, enqueue assets wrong, or bypass APIs the platform already provides.

### 2.2 The WordPress toolchain is fragmented

A typical build involves:

| Concern | Today's tool |
| :--- | :--- |
| Edit code | VS Code / PhpStorm |
| Run site | Local WP, DDEV, Lando, wp-env, Docker |
| Admin / content | wp-admin in browser |
| Automate | WP-CLI in another terminal |
| DB | phpMyAdmin / TablePlus |
| AI | Cursor/ChatGPT without site context |
| Deploy | FTP, rsync, Git push + host pipelines, ManageWP |

Context dies at every boundary. The agent cannot open wp-admin, inspect the REST schema of *this* site, or verify a block in the editor.

### 2.3 Agencies sell velocity; the stack sells friction

WordPress agencies and product studios compete on turnaround. Their bottleneck is not "writing PHP" — it is environment spin-up, safe changes across code+DB, regression checks on real themes, and handoff between design, content, and engineering. Existing AI features in hosts (e.g. copy helpers) do not replace an engineering environment.

### 2.4 Security and blast radius

WordPress sites are high-value attack surfaces. Unconstrained agents that edit `wp-config.php`, install plugins from arbitrary zips, or run SQL are dangerous. Wordbench must make **safe-by-default agent permissions** a product feature, not an afterthought.

---

## 3. Vision & Opportunity

**Vision:** Open a WordPress project in Wordbench the way you open a repo in Cursor — and the site boots, the agent already knows your theme/plugin map, and "add a pricing block that matches our patterns and ship it to staging" is one agent run with diffs + CLI + preview.

Wordbench occupies the intersection of:

| Category | Examples | Wordbench stance |
| :--- | :--- | :--- |
| AI code editors | Cursor, Windsurf, Copilot Workspace | Same agent UX ceiling; WP-native tools & runtime |
| Local WP environments | Local, DDEV, wp-env | Environment is embedded and agent-controllable |
| WP-specific IDEs / studios | Limited / aging | Modern agent-first, block-era native |
| Host AI / site copilots | Host dashboards | Dev environment, not marketing copy widgets |

**Differentiation:** Wordbench is not "ChatGPT in wp-admin." It is not "Cursor with a WordPress system prompt." It is an **environment** where code, runtime, CLI, database introspection, and preview share one agent loop.

---

## 4. Target Users & Personas

### 4.1 Primary — Agency WordPress Engineer

Builds custom themes/plugins for clients weekly. Lives in deadlines. Wants faster scaffolding, safer refactors, and less context switching. Comfortable with Git; allergic to FTP surprises.

### 4.2 Primary — Plugin / Block Product Developer

Ships commercial or open-source plugins and block libraries. Needs scaffolding, test runs, wp-env, WPCS, and release hygiene. Wants agents that respect plugin headers, text domains, and `@wordpress/scripts` build pipelines.

### 4.3 Secondary — Technical Founder / Solo Builder

Uses WordPress as the product surface (LMS, membership, WooCommerce). Wants Cursor-like leverage without hiring a full WP team.

### 4.4 Secondary — Design Engineer on Block Themes

Works in `theme.json`, patterns, and template parts. Needs visual preview + structured edits, not only raw PHP.

### 4.5 Tertiary — Technical PM / Solutions Architect

Scopes client builds, reviews agent diffs, cares about migration plans and staging verification.

**Non-goals for v1 users:** pure content editors who only need AI to write posts inside wp-admin (different product).

---

## 5. Product Principles

1. **Site is a runtime, not a folder** — If the agent cannot boot, browse, and assert against a real WordPress, it is guessing.
2. **Code and state are both first-class** — File diffs *and* explicit data/CLI operations; never silent DB mutation.
3. **WordPress semantics over generic PHP** — Prefer platform APIs, hooks, and block patterns the way a senior WP engineer would.
4. **Safe by default** — Capability-scoped tools; production gated; secrets redacted; destructive ops require confirmation.
5. **Preview is proof** — Agent claims are backed by screenshots, HTTP assertions, or editor canvas checks when possible.
6. **Git is the system of record for code** — Content/state migrations are exported as replayable WP-CLI scripts or migration packages, not tribal knowledge.
7. **Feels like Cursor** — Chat, inline edit, multi-file agent, rules, terminal, diffs — familiar UX, deeper WP tools underneath.

---

## 6. Core Concepts & Mental Model

### 6.1 Workspace = Project + Site

A Wordbench **Workspace** binds:

- A Git repo (theme, plugin, monorepo of plugins, or Bedrock/WordPress Composer layout)
- A **Site runtime** (wp-env, Docker, or imported Local/DDEV)
- Environment config (local/staging/production endpoints & credentials vault)

### 6.2 The WordPress Knowledge Graph

Indexed understanding of:

- Themes / child themes / active theme
- Plugins (active, mu-plugins, drop-ins)
- Registered CPTs, taxonomies, REST routes
- Hook map (approximate: from code analysis)
- Block library (`block.json` inventory)
- `theme.json` tokens and style variations
- Template hierarchy resolution for key routes

### 6.3 The Agent Loop (WP-native)

Plan → edit files → run WP-CLI / tests → refresh preview → read logs → revise. Tools are WordPress-aware (see §7).

### 6.4 Intent Diffs for State

When a task requires DB/content changes (create CPT seed data, flip an option, import a pattern), Wordbench proposes a **State Diff**: WP-CLI commands and/or a migration script the user can apply, review, and commit — not a hidden phpMyAdmin edit.

### 6.5 Rules & Playbooks

Cursor Rules equivalent: `WORDPRESS.md` / `.wordbench/rules` covering coding standards, agency patterns, banned functions (`extract`, direct SQL without `$wpdb->prepare`), and deploy checklists. **Playbooks** are reusable agent workflows ("scaffold a dynamic block", "migrate classic → block theme section").

### 6.6 Environments

Local (full control) → Staging (restricted agent: sync down, careful push) → Production (read + observe by default; write only with explicit break-glass).

---

## 7. Feature Requirements

Priority: **P0** launch-blocking, **P1** within ~30–60 days of launch, **P2** strategic.

### 7.1 P0 — Launch Blocking

#### 7.1.1 Cursor-class Editor UX
- Repo-aware chat with @-context (files, symbols, docs)
- Inline edit / Cmd-K style rewrite
- Multi-file agent mode with applyable diffs
- Terminal panel
- Git status, diff review, commit message assist
- Project rules (`.wordbench/rules`, `WORDPRESS.md`)

#### 7.1.2 WordPress Project Intelligence
- Auto-detect project shape: classic theme, block theme, single plugin, `wp-content` checkout, Bedrock/Composer
- Map active theme/plugins when site is connected
- PHP + JS (block) language support with WP stubs / wordpress-stubs integration
- Awareness of template hierarchy and `block.json` packages

#### 7.1.3 Embedded Local Site Runtime
- One-click (or one-command) local site via **wp-env** (default) and documented Docker compose escape hatch
- Start/stop/reset site from the IDE
- Embedded browser preview (front end + wp-admin)
- Log tail (PHP error log, web server; Query Monitor integration later)

#### 7.1.4 WP-CLI Tooling for Agents
- First-class WP-CLI runner tool with allowlist
- Common recipes: scaffold plugin/theme/block, rewrite flush, cache flush, plugin activate, db export/import (local only by default)
- Command preview before execute for destructive commands

#### 7.1.5 Safe Apply & Permissions
- Tool permission tiers: Read FS, Edit FS, Run WP-CLI (safe), Run WP-CLI (destructive), SQL read, SQL write, Network install
- Production write disabled by default
- Secret scanning on apply; redact `.env` / `wp-config` secrets in agent context by default

#### 7.1.6 Preview Verification
- After agent edits, optional "Verify" step: load URL(s), capture screenshot, basic console/network error sniff
- Block editor open-and-insert check for block tasks (P0 lightweight: open site editor / post editor URL)

#### 7.1.7 Scaffolding Playbooks
- New plugin (headers, text domain, composer/phpunit optional)
- New dynamic / static block (`@wordpress/scripts`)
- Child theme
- CPT + REST + basic admin UI (generate + wire)

### 7.2 P1 — Launch Critical Follow-on

#### 7.2.1 Database & Options Introspection
- Read-only schema explorer and options search
- "Explain this options row" with link back to plugin code when possible
- State Diff generator for option/post meta changes

#### 7.2.2 Block & FSE Workshop
- `theme.json` structured editor + agent tools
- Pattern library sync (export/import patterns as files)
- Visual select-an-element → jump to template part / block source (best-effort)

#### 7.2.3 Quality Gates
- PHPCS with WordPress Coding Standards
- PHPUnit / Playwright (or wp-env e2e) hooks
- Agent must run configured gates before "done" on PRs

#### 7.2.4 Staging Connectors
- Pull DB/media from staging (explicit, logged)
- Deploy code via GitHub Actions / host APIs (extendable)
- Never pull production DB without double confirm + scrubbing warnings

#### 7.2.5 Hook & REST Introspection
- List REST routes from living site
- Static analysis assist for `add_action` / `add_filter` registrations

#### 7.2.6 Migration from Existing Tools
- Import Local WP / DDEV project paths
- Open existing wp-env repos with zero config

### 7.3 P2 — Strategic

#### 7.3.1 WooCommerce-aware agent skills
#### 7.3.2 Multisite management tools
#### 7.3.3 Host marketplace integrations (WP Cloud, SpinupWP, Rocket.net, etc.)
#### 7.3.4 Collaborative multiplayer workspaces for agencies
#### 7.3.5 Autonomous "site maintenance agent" (updates, conflict triage) with strict sandboxes
#### 7.3.6 Design intake (Figma → block theme patterns) as an optional bridge
#### 7.3.7 Headless WP (Faust/Next) hybrid workspaces

---

## 8. Architecture & System Design

### 8.1 High-level

| Layer | Responsibility |
| :--- | :--- |
| **Editor shell** | Cursor-like IDE UX (files, chat, agent, terminal, git) |
| **WP language services** | PHP/JS + WP stubs, `block.json`, `theme.json` schemas |
| **Site runtime manager** | wp-env/Docker lifecycle, ports, credentials |
| **Agent tool bus** | File tools, WP-CLI, HTTP preview, DB read, linters |
| **Knowledge index** | Codebase index + WP graph (plugins, blocks, routes) |
| **Policy engine** | Permissions, environment gates, secret redaction |
| **Preview** | Embedded browser + screenshot/verify services |
| **Connectors** | GitHub, staging hosts, optional design tools |

### 8.2 Default local stack
- **wp-env** for reproducibility and CI parity
- SQLite integration option for ultralight demos (secondary); MySQL remains default for fidelity
- Node LTS for `@wordpress/scripts` block builds

### 8.3 Agent tools (initial set)
- `fs.read` / `fs.write` / `fs.apply_patch`
- `wpcli.run` (categorized)
- `site.browse` / `site.screenshot`
- `site.request` (front/REST)
- `db.query` (read-only default)
- `lint.phpcs` / `test.phpunit`
- `index.search` / `wp.graph.lookup`

### 8.4 Data flow (happy path)
1. User: "Add an FAQ accordion block to the theme and show it on /pricing."
2. Agent reads theme type, block build setup, existing patterns.
3. Scaffolds block, registers it, adds pattern or template reference.
4. Runs build + WP-CLI flush as needed.
5. Opens /pricing + editor insert path; screenshots.
6. Presents file diffs + optional State Diff; user approves.

---

## 9. Design System & UX Notes

- Dark-first IDE aesthetic (Cursor-familiar), dense but calm
- **Site status bar**: environment, WP version, active theme, agent permission mode
- **Diff view**: Files tab + State tab
- **Preview pane**: dockable; device widths; logged-in as role selector (Admin/Editor/Customer)
- Accessibility: full keyboard for chat/agent; don't trap focus in preview iframe without escape

---

## 10. Competitive Landscape

| Product | Strength | Gap vs Wordbench |
| :--- | :--- | :--- |
| Cursor | Best-in-class agentic coding | Not WP-runtime aware |
| VS Code + Copilot | Ubiquitous | Same fragmentation; weak WP semantics |
| PhpStorm | Deep PHP | Not agent-native; no WP site loop |
| Local WP | Easy site spin-up | Not a coding agent environment |
| wp-env / DDEV | Solid runtimes | CLI-centric, no agent UX |
| Host AI features | Convenient for content | Not engineering environments |
| Specialized WP AI plugins | In-admin helpers | No real IDE / Git / agent loop |

**Moat:** the closed loop of **WP knowledge graph + controllable runtime + policy-aware tools + verify-via-preview**, trained into playbooks agencies repeat daily.

---

## 11. Metrics & Success Criteria

| Metric | 6-month target | Notes |
| :--- | :--- | :--- |
| Time to first local site preview from new workspace | ≤ 10 minutes p50 | Including deps |
| Agent task success (user accepts without major rework) | ≥ 60% on P0 playbooks | Scaffold block, child theme, CPT |
| Verify step catches regressions before accept | ≥ 30% of failed tasks | Leading indicator of loop value |
| Weekly active paying seats | TBD after pricing | Agency team seats primary |
| Retention (trial → weekly habit by week 4) | ≥ 40% | Habit formation |

Qualitative bar: senior WP engineers say "it doesn't do dumb WordPress things."

---

## 12. Phased Roadmap

### Phase 0 — Pivot & Spec (now)
- Clear old Originmain codebase
- PRD + positioning + name finalization (**Wordbench** working title)
- Technical spike: wp-env control plane + agent tool bus

### Phase 1 — Foundation (Weeks 1–8)
- Editor shell (reuse strategy TBD: VS Code OSS vs cloud remote)
- Project open + WP detection
- wp-env lifecycle + preview iframe
- Chat + diffs + rules
- WP-CLI tool + permission engine
- P0 playbooks (plugin, block, child theme)

### Phase 2 — Intelligence (Weeks 9–16)
- WP knowledge graph v1
- PHPCS/WPCS + tests in agent loop
- State Diffs + DB introspection (read)
- Staging pull (careful)
- Closed alpha with 10–20 agencies/plugin teams

### Phase 3 — Professional (Weeks 17–28)
- Block/FSE workshop
- Role-based preview
- Host deploy connectors
- Team rules / shared playbooks
- Paid beta

### Phase 4 — Platform
- WooCommerce skills, multisite, maintenance agents, marketplace

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Building a full IDE is enormous | High | Start from VS Code OSS or equivalent shell; buy don't rebuild editor chrome |
| wp-env/Docker reliability on Win/macOS | High | First-class diagnostics; support DDEV import early |
| Agent damages sites | High | Permission tiers; local-default; production lock; State Diffs |
| "Just use Cursor + prompts" objection | Medium | Runtime+verify loop demos; playbooks that general agents fail |
| WordPress PHP legacy complexity | Medium | Stubs, WPCS, curated playbooks; don't claim magic on 10-year themes day one |
| Naming/repo still "originmain" | Low | Rename product + repo after PRD buy-in |
| WordPress trademark in marketing | Medium | Follow WordPress Foundation trademark policy |

---

## 14. Open Questions (resolve in Phase 0)

1. **Shell strategy:** VS Code OSS fork vs cloud-only web IDE vs thin client over remote VMs?
2. **Distribution:** Desktop-first (agency reality) vs browser-first?
3. **Final name** (Wordbench is working title) and whether to rename the GitHub repo.
4. **Pricing:** per seat vs per agency workspace vs usage on hosted runtimes.
5. **How much of Bedrock/Trellis/Roots stack to support on day one?**
6. **Model routing:** bring-your-own key vs hosted; default model mix.

---

## 15. Appendices

### A. Glossary
- **State Diff** — Reviewable proposal of WP-CLI/SQL/content mutations
- **Playbook** — Reusable agent workflow with tools + checks
- **WP Knowledge Graph** — Indexed map of theme/plugin/block/hook/REST reality
- **FSE** — Full Site Editing (block themes)
- **wp-env** — Official local environment tooling from WordPress / `@wordpress/env`

### B. P0 Playbook sketches
1. **Scaffold dynamic block** — detect build system → create-block or equivalent → register → build → verify insert in editor → diff
2. **Child theme** — scaffold → enqueue parent → template override → screenshot home
3. **CPT** — register → flush rewrites → seed via WP-CLI → REST check → diff

### C. Explicit non-goals (v1)
- Replacing wp-admin for content authors
- Automatic production hotfixes without human approval
- Full visual page builder competing with Elementor (enhance code-era WP first)
- Supporting every classic page builder's proprietary shortcodes equally on day one

### D. Positioning one-liner
**Wordbench is Cursor for WordPress — an agentic environment where your code, WP-CLI, database, and live site share one brain.**

---

*End of PRD v1.0 — Wordbench*
