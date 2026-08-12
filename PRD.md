# Product Requirements Document

**Wordbench**

The Agentic WordPress Development Environment

*Where WordPress products get built — code, site, and shipping in one loop.*

| Field | Value |
| :--- | :--- |
| **Version** | 1.1 |
| **Date** | August 12, 2026 |
| **Author** | Patrick (Product Lead) |
| **Status** | Draft — Internal |
| **Repo** | SinachPat/originmain (pivoting; rename TBD) |
| **Classification** | Confidential |
| **Supersedes** | v1.0 (removed editor-clone framing) |

---

## 1. Executive Summary

Wordbench is a development environment built for people who ship on WordPress. It combines an AI agent that can plan and edit real project code with a live WordPress runtime, WP-CLI, database awareness, and preview — so building a theme, plugin, or block is not split across five apps and a hope that the model "knows WordPress."

WordPress work is not generic app development. The product surface is a CMS platform with themes, plugins, hooks, a block editor, content in MySQL, and a long tail of agency and product workflows. Today's stack forces builders to keep that reality in their head while jumping between an editor, a local site tool, wp-admin, a terminal for WP-CLI, and a database client.

Wordbench makes that reality the environment:

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

**Vision:** Open a WordPress project in Wordbench and you get a workspace that already understands the shape of the project, can start the site, and can take a job like "add a pricing block that matches our patterns and verify it on /pricing" through edit → CLI → preview → review in one place.

Wordbench sits at the intersection of:

| Category | What exists | What Wordbench adds |
| :--- | :--- | :--- |
| AI-assisted coding | General editors and agents | WP-native tools, playbooks, and site loop |
| Local WP environments | Local, DDEV, wp-env | Runtime embedded and controllable by the agent |
| In-admin AI helpers | Host and plugin copilots | Real engineering workspace (Git, diffs, tests), not post drafting |
| Block / theme tooling | `@wordpress/scripts`, theme.json editors | Unified with agent + live preview |

**Positioning:** Wordbench is the agentic **WordPress workshop** — not a generic coding assistant with a WordPress sticker, and not an AI writing widget inside wp-admin.

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
5. **Preview is proof** — Prefer screenshots, HTTP checks, or editor verification over "trust me."
6. **Git records code; scripts record state** — Migrations and WP-CLI plans are reviewable artifacts.
7. **Opinionated for WordPress** — Defaults follow WPCS, wp-env, and block-era workflows; escape hatches exist but are not the center.

---

## 6. Core Concepts & Mental Model

### 6.1 Workspace = Project + Site

A **Workspace** binds:

- A Git project (theme, plugin, plugin monorepo, `wp-content` checkout, or Composer/Bedrock layout)
- A **site runtime** (wp-env by default; Docker / Local / DDEV import paths)
- Environment config (local / staging / production endpoints and a credentials vault)

### 6.2 WordPress Knowledge Graph

Indexed understanding of:

- Themes / child themes / active theme
- Plugins (active, mu-plugins, drop-ins)
- CPTs, taxonomies, REST routes
- Hook registrations (best-effort from code)
- Block inventory (`block.json`)
- `theme.json` tokens and style variations
- Template hierarchy for key routes

### 6.3 The build loop

Plan → edit files → run WP-CLI / tests → refresh preview → read logs → revise. Every step uses WordPress-aware tools.

### 6.4 State Diffs

When a task needs content or options changes, Wordbench proposes a **State Diff**: WP-CLI commands and/or a migration script to review, apply, and commit — not an invisible database tweak.

### 6.5 Rules & Playbooks

Project guidance lives in `WORDPRESS.md` / `.wordbench/rules` (standards, banned patterns, deploy checklists). **Playbooks** are reusable workflows: scaffold a dynamic block, spin a child theme, register a CPT, harden a plugin release.

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
- Project rules (`WORDPRESS.md`, `.wordbench/rules`)

#### 7.1.2 WordPress project intelligence
- Detect project shape: classic theme, block theme, single plugin, `wp-content` tree, Bedrock/Composer
- When the site is up: map active theme and plugins
- PHP + block JS support with WordPress stubs
- Template hierarchy and `block.json` awareness

#### 7.1.3 Embedded local site runtime
- Start/stop/reset via **wp-env** (default), with documented Docker compose escape hatch
- Embedded preview (front end + wp-admin)
- Log tail (PHP / web server; Query Monitor later)

#### 7.1.4 WP-CLI as an agent tool
- Allowlisted WP-CLI runner
- Recipes: scaffold plugin/theme/block, rewrite flush, cache flush, activate plugins, local DB export/import
- Preview destructive commands before run

#### 7.1.5 Permissions & safety
- Tiers: read FS, edit FS, WP-CLI safe, WP-CLI destructive, SQL read, SQL write, network install
- Production writes off by default
- Redact secrets from `.env` / `wp-config` in agent context; scan on apply

#### 7.1.6 Preview verification
- Optional verify step: load URLs, screenshot, basic error sniff
- For block tasks: open editor routes and confirm the block can be inserted (lightweight P0)

#### 7.1.7 Scaffolding playbooks
- Plugin (headers, text domain, optional Composer/PHPUnit)
- Static / dynamic block (`@wordpress/scripts`)
- Child theme
- CPT + REST + minimal admin UI

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

| Layer | Responsibility |
| :--- | :--- |
| **Workspace shell** | Files, agent chat, terminal, git, preview layout |
| **WP language services** | PHP/JS, stubs, `block.json`, `theme.json` schemas |
| **Site runtime manager** | wp-env/Docker lifecycle, ports, credentials |
| **Agent tool bus** | Files, WP-CLI, HTTP preview, DB read, linters |
| **Knowledge index** | Code index + WP graph |
| **Policy engine** | Permissions, environment gates, secret redaction |
| **Preview / verify** | Embedded browser, screenshots, checks |
| **Connectors** | GitHub, staging hosts, optional design tools |

### 8.2 Default local stack
- **wp-env** for local + CI parity  
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

---

## 9. UX Notes

- Dark-first, dense workshop UI; calm over theatrical  
- **Site status bar:** environment, WP version, active theme, permission mode  
- **Diff view:** Files tab + State tab  
- **Preview:** dockable; device widths; view-as role (Admin / Editor / Customer)  
- Keyboard-complete for agent flows; escape hatch from preview focus  

---

## 10. Competitive Landscape

| Product type | Strength | Gap Wordbench fills |
| :--- | :--- | :--- |
| General AI code editors | Strong general coding agents | No WordPress runtime loop or WP semantics |
| Classic PHP IDEs | Deep PHP tooling | Weak agent-native site loop |
| Local WP apps | Easy site spin-up | Not an engineering agent workspace |
| wp-env / DDEV | Solid runtimes | CLI-centric; no integrated agent UX |
| Host / plugin AI | Handy in wp-admin | Content-oriented; not Git/theme/plugin shipping |
| Page builders | Fast visual pages | Different paradigm; not Wordbench's v1 center |

**Moat:** WP knowledge graph + controllable runtime + policy-aware tools + verify-via-preview, packaged as playbooks agencies and plugin teams repeat weekly.

---

## 11. Metrics & Success Criteria

| Metric | 6-month target | Notes |
| :--- | :--- | :--- |
| Time to first local preview from new workspace | ≤ 10 min p50 | Including deps |
| Accepted agent runs on P0 playbooks (little rework) | ≥ 60% | Block, child theme, CPT |
| Verify step catches issues before accept | ≥ 30% of failing tasks | Loop quality signal |
| Trial → weekly habit by week 4 | ≥ 40% | Retention |
| Paying seats | TBD with pricing | Agency teams primary |

Qualitative bar: experienced WordPress engineers say it behaves like someone who has shipped WP for years.

---

## 12. Phased Roadmap

### Phase 0 — Pivot & spec (now)
- Clear prior product codebase  
- PRD + naming  
- Spike: wp-env control plane + agent tool bus  

### Phase 1 — Foundation (weeks 1–8)
- Workspace shell (implementation vehicle TBD: desktop vs web; prefer proven editor foundations over greenfield chrome)  
- Project open + WP detection  
- wp-env lifecycle + preview  
- Agent chat + diffs + rules  
- WP-CLI tool + permission engine  
- P0 playbooks  

### Phase 2 — Intelligence (weeks 9–16)
- Knowledge graph v1  
- WPCS / tests in the loop  
- State Diffs + read-only DB introspection  
- Careful staging pull  
- Closed alpha (10–20 agencies / plugin teams)  

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
| Building a full workspace is large | High | Reuse a mature editor foundation; invest in WP runtime + tools |
| Local Docker/wp-env pain (esp. Windows) | High | Diagnostics first; early Local/DDEV import |
| Agent harms a site | High | Permission tiers; local-default; production lock; State Diffs |
| "Prompts in my current editor are enough" | Medium | Demo the site loop and playbooks general setups fail |
| Legacy PHP / chaotic themes | Medium | Stubs, WPCS, honest limits; playbooks for clean paths first |
| Repo still named originmain | Low | Rename after name lock |
| Trademark / "WordPress" in marketing | Medium | Follow WordPress Foundation trademark rules |

---

## 14. Open Questions (Phase 0)

1. **Shell:** desktop vs browser-first; which editor foundation to adopt?  
2. **Name:** keep **Wordbench** or replace before public use?  
3. **Repo rename** away from `originmain`?  
4. **Pricing:** seat vs workspace vs hosted-runtime usage?  
5. **Roots/Bedrock/Trellis** support depth for v1?  
6. **Models:** BYO keys vs hosted; default routing?  

---

## 15. Appendices

### A. Glossary
- **State Diff** — Reviewable WP-CLI / SQL / content mutation plan  
- **Playbook** — Reusable agent workflow with tools and checks  
- **WP Knowledge Graph** — Map of themes, plugins, blocks, hooks, REST  
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

### D. One-liner
**Wordbench is the agentic workshop for WordPress — code, WP-CLI, data, and a live site in one loop.**

---

*End of PRD v1.1 — Wordbench*
