# Product Requirements Document

**Wursor**

The Agentic WordPress Management Platform

*Just describe what you want. Wursor does the rest.*

| Field | Value |
| :--- | :--- |
| **Version** | 2.0 |
| **Date** | August 13, 2026 |
| **Author** | Patrick (Product Lead) |
| **Status** | Draft — Internal (non-technical-first pivot; Phase 0) |
| **Repo** | SinachPat/wursor |
| **Classification** | Confidential |
| **Supersedes** | v1.3 (engineer-first; desktop shell; Tauri + Monaco) |

---

## 1. Executive Summary

Wursor is a web-based platform that lets anyone manage their WordPress site by simply describing what they want. No code, no wp-admin, no hosting jargon. The user types "make my homepage look more modern" or "add a booking form" or "change the site to a two-column layout" — and Wursor does it.

Under the hood, Wursor spins up a secure cloud sandbox (an isolated copy of the user's site), instructs an AI agent to make the changes, and shows the user a live preview. If the user likes it, Wursor deploys the changes to the real site. If they don't, it resets.

The product is a web app. The user installs one WordPress plugin to connect their site. Everything else happens in the browser. No Docker, no terminal, no filesystem access.

**The opportunity:** become the default way non-technical WordPress site owners make changes to their sites — replacing the agency phone call, the frustrating wp-admin search, and the fear of breaking something.

---

## 2. Problem Statement

### 2.1 WordPress is powerful, but it still requires technical skill

Millions of businesses run on WordPress. The owners are real estate agents, restaurant owners, consultants, dentists, e-commerce operators. They are not developers. They are not designers. They are people who need a website that works.

When they need to change something — update the layout, add a feature, fix a broken page — they have three options today:

1. **Learn wp-admin** — navigate a 20-year-old admin interface designed for content publishers, not business owners
2. **Call an agency** — wait days, pay hundreds, and hope the result matches what they described
3. **Use a hosted builder** — leave WordPress entirely for Wix/Squarespace, losing their SEO, content, and investment

Each option is painful. None of them respects the user's time or expertise.

### 2.2 The toolchain is designed for engineers

The WordPress ecosystem tools — Local WP, wp-env, WP-CLI, Git, staging sites — are all built for developers. A business owner doesn't know what a staging site is. They don't want to know. They want to see their change and click "accept."

### 2.3 The gap is trust, not technology

The technology to have an AI agent edit a WordPress site exists today. The gap is safety: the user needs to trust that the agent won't break their site. That's why the core product is the sandbox + preview + approve loop — not the agent itself. The agent is invisible. The sandbox is the safety guarantee.

### 2.4 Fragmentation is the user's problem, not the tool's

A business owner might use:
- A page builder (Elementor, Beaver Builder)
- Several plugins (WooCommerce, SEO, forms, booking)
- A custom theme
- Third-party services (Mailchimp, Stripe, Google Analytics)

Today, changing any of these requires learning each tool's interface. Wursor abstracts all of them behind a single chat interface. The agent knows how to use them.

---

## 3. Vision & Opportunity

**Vision:** Open Wursor, type what you want your site to do, preview it, approve it. That's it. WordPress becomes as easy as describing it.

Wursor is not a page builder. It's not a hosting platform. It's not a content editor. It's the **agentic layer** that sits on top of any WordPress site and lets you control it with natural language.

**The opportunity:** the entire WordPress ecosystem (43% of the web) has no native agentic interface. The closest alternatives are:
- AI assistants inside page builders (lock you into their builder)
- General AI coding tools (require technical skill)
- Agency retainer relationships (expensive, slow)

Wursor is the first product that gives non-technical site owners a direct, safe, natural-language interface to their WordPress site — without requiring them to learn any tool.

---

## 4. Target Users & Personas

### 4.1 Primary — WordPress Site Owner (non-technical)

Runs a business on WordPress. Has admin access but doesn't know how to use it beyond basic post editing. Hires an agency for anything non-trivial. Wants to make changes without a phone call. Examples: dentist, real estate agent, restaurant owner, e-commerce store operator.

**Out of scope for v1:** content-only users who mainly need AI to draft posts. Wursor is for *doing* — changing the site, not just writing.

### 4.2 Secondary — Agency Client (delegator)

Has an agency but wants to make small changes themselves without waiting for a ticket. Wursor becomes the "self-serve" layer on top of the agency-managed site.

### 4.3 Tertiary — Technical WordPress Developer (future)

The same product, with advanced features unlocked later. For now, the product is designed for non-technical users. Engineers can use it too, but they're not the target.

---

## 5. Product Principles

1. **The user describes what they want; the agent does the rest.** No settings screens, no toggles, no configuration.
2. **The live preview is the only proof.** The user never sees a diff, a terminal, or an error log. They see their site with the change applied.
3. **Safe by default.** The agent never touches the live site until the user explicitly approves. Sandbox isolation is non-negotiable.
4. **Every change is reversible.** If the user doesn't like the result, they reject it. The live site is unchanged. If they approved and regret it, one-click rollback.
5. **Speed is the UX.** Boot the sandbox fast, show the preview fast, deploy fast. The user waits seconds, not minutes.
6. **The agent knows WordPress.** The user doesn't need to know what a theme, plugin, hook, or shortcode is. The agent does.
7. **Non-technical first.** Every feature is designed for the person who doesn't know what a file is. Technical features are added later, not instead.

---

## 6. Core Concepts & Mental Model

### 6.1 The loop

The user's entire interaction with Wursor is a single loop:

```
Describe → Preview → Approve
```

That's it. There is nothing else. No dashboard, no settings, no configuration. The user lands on a chat interface, types what they want, sees a preview of their site with the change, and clicks approve or reject.

### 6.2 The sandbox

Every task gets an ephemeral, isolated copy of the user's WordPress site — a **sandbox**. The sandbox is a full WordPress instance running in Wursor's cloud infrastructure, pre-loaded with the user's active theme, plugins, and content.

The agent works inside the sandbox. It can install plugins, edit files, change settings, modify the database — anything. The live site is never touched.

When the user approves, the sandbox changes are deployed to the live site via the Wursor plugin. When the user rejects, the sandbox is destroyed. Nothing persists.

### 6.3 The plugin

A lightweight WordPress plugin that the user installs once. It does two things:
1. **Connects the site** — provides a secure API for Wursor to read site info (themes, plugins, content) and deploy changes
2. **Receives deploys** — applies the sandbox changes (file updates, database changes, plugin installs) to the live site

The plugin is the only thing the user ever installs. It requires no configuration beyond the initial connection token.

### 6.4 Playbooks

Every user request maps to a **playbook** — a structured, multi-step agent workflow. The user doesn't know about playbooks. They just see "I'll work on that now." But internally, each request is routed to a specific playbook:

- **Content change** — edit text, images, pages
- **Design change** — modify theme, layout, colors, fonts
- **Feature add** — install and configure a plugin (e.g., booking form, SEO, analytics)
- **Plugin install** — find, install, and activate a plugin from the WordPress repo
- **Site build** — create a new site from scratch (theme + pages + content)
- **Fix** — diagnose and repair a broken page, layout issue, or plugin conflict

### 6.5 Environments

- **Sandbox** — ephemeral, agent has full access, isolated from live site
- **Live site** — the user's real WordPress site, only touched by explicit deploy after approval

---

## 7. Feature Requirements

**P0** = launch-blocking · **P1** = ~30–60 days post-launch · **P2** = strategic

### 7.1 P0 — Launch Blocking

#### 7.1.1 Chat interface
- Single text input, no buttons, no tabs
- User types what they want, in any language, any level of detail
- Agent responds conversationally: "I've changed your homepage to a two-column layout. Here's the preview."
- Agent can ask clarifying questions: "I see you have a contact form. Do you want me to keep it or replace it?"
- Follow-up turns refine the result: "Make the header blue instead" → new preview
- Mobile-responsive — the user can approve changes from their phone

#### 7.1.2 Live preview
- Embedded browser preview of the sandbox site
- Real-time — the preview updates as the agent works (streaming changes)
- The user can click around the preview to verify the change works on all pages
- Device toggle: desktop / tablet / mobile views
- The preview is the *only* verification — no diffs, no logs, no technical output

#### 7.1.3 Approve / reject
- Big, clear buttons: "Looks good → Apply" and "Not right → Reject"
- Apply deploys the sandbox changes to the live site via the plugin
- Reject destroys the sandbox, live site unchanged
- Confirmation dialog before apply: "Apply changes to your live site?"
- One-click rollback: a history of deployed changes, with "Undo" for each

#### 7.1.4 WordPress plugin connector
- One-click install from wp-admin plugin directory
- Pairing flow: user copies an 8+ character code from Wursor web app (5-minute TTL, 5-attempt lockout, bound to account + site URL), pastes it into the plugin
- Plugin exposes: site info (theme, plugins, content), file system (read/write), database (read/write), WP-CLI (full access)
- All communication over HTTPS with token-based auth
- Plugin auto-updates; no user maintenance

#### 7.1.5 Cloud sandbox orchestration
- Spin up a sandbox in ≤ 10 seconds (warm pool)
- Mirror the user's site: theme, plugins, content (task-scoped). Media is proxied from origin, not copied.
- Full network access (so the agent can install plugins from the WordPress repo)
- 15-minute idle timeout (auto-hibernate, resume on user interaction)
- 24-hour hard timeout (sandbox destroyed, no exceptions)
- Deploy: apply file changes, database changes, plugin installs/activations to the live site via the plugin

#### 7.1.6 Content playbooks
- **Edit text** — find and replace text on any page, update headings, rewrite paragraphs
- **Edit images** — replace, resize, reposition images
- **Edit pages** — add/remove sections, reorder content, change layouts
- **Import/export** — copy content from another page or site

#### 7.1.7 Design playbooks
- **Theme change** — switch to a new theme, migrate content
- **Layout change** — single column → two columns, sidebar position, full-width sections
- **Color/font change** — update theme colors, typography, spacing
- **Mobile fix** — fix a layout that breaks on mobile

#### 7.1.8 Plugin playbooks
- **Install plugin** — find a plugin in the WordPress repo, install, activate, configure
- **Configure plugin** — change settings for an existing plugin (e.g., "set up WooCommerce shipping")
- **Plugin conflict fix** — diagnose and resolve a plugin conflict

#### 7.1.9 Site build playbook (P0 limited)
- **From scratch** — user describes their business type; Wursor selects a theme, installs it, creates pages, sets up plugins
- **From existing** — take the user's current site and apply a new design direction
- Limited to simple sites in v1 (5 pages, standard plugins). Complex builds are P1.

#### 7.1.10 Safety & trust
- Every change is previewed before apply — no "apply now, preview later"
- Agent has a "no-surprise" rule: it must surface any action that costs money (e.g., a paid plugin) or affects SEO (e.g., URL changes)
- That rule is mechanical at deploy, not just conversational: URL/slug changes, `blog_public`, payment/shipping, and user/role table writes are blocked until the user confirms that specific bullet (R12)
- Agent role: "I changed your homepage layout. It also removed your sidebar widget. Is that OK?"
- Deploy history: a timeline of all changes, with one-click undo per change
- Undo reverts the last deploy (not individual file changes — the user sees "your site has been restored to before that change")
- The last 3 deploy snapshots are stored in Wursor's cloud as well as on the site, so Undo still works if the live site is down (R3)

### 7.2 P1 — Follow-on

#### 7.2.1 Multi-step workflows
- User can queue multiple changes: "Change the homepage layout, add a booking form, and update the footer"
- Agent works through them in order, previews the combined result
- User approves all at once or rejects individual changes

#### 7.2.2 Visual design picker
- Instead of describing a design, the user picks from a gallery of design templates
- "Show me my site with this theme" — the agent changes the theme, previews it
- The user can cycle through options without committing

#### 7.2.3 SEO optimization
- "Make my site rank better" — agent analyzes the site, suggests changes, applies them with approval
- Meta descriptions, title tags, alt text, heading structure, schema markup

#### 7.2.4 Performance optimization
- "Make my site faster" — agent analyzes performance, suggests fixes (image optimization, caching, plugin cleanup)
- Applies changes with approval

#### 7.2.5 Content migration
- "Move my site from Wix to WordPress" — agent imports content, maps pages, sets up redirects
- Complex, but the agent does the heavy lifting

#### 7.2.6 Multi-site management
- User connects multiple WordPress sites to one Wursor account
- Switch between sites, apply changes across sites, bulk operations

#### 7.2.7 Team / agency mode
- Multiple users can access the same site with different permission levels
- Agency team can manage client sites from a single Wursor account
- Client approves changes, agency makes them

### 7.3 P2 — Strategic

- E-commerce operations (WooCommerce: product updates, inventory, pricing, shipping)
- Scheduled changes (e.g., "update the site for the holiday sale on December 1")
- Custom code agent (for users who want to add custom CSS/JS — still via chat, no code editor)
- A/B testing (agent creates two versions, measures performance, picks the winner)
- Monitoring agent (watches the site, suggests fixes proactively)
- Marketplace (playbooks built by third parties, shared with the community)

---

## 8. Architecture & System Design

### 8.1 Layers

```
┌─────────────────────────────────────────────────────┐
│  Web Frontend (Wursor Web App)                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Chat UI (React)                                 │ │
│  │  Preview iframe (sandbox URL)                    │ │
│  │  Approve / Reject buttons                        │ │
│  │  Deploy history timeline                         │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  API Server (Backend)                                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Session Manager                                 │ │
│  │  ├─ Create session (auth, site info, context)   │ │
│  │  └─ Resume session (reconnect to sandbox)       │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Agent Orchestrator                              │ │
│  │  ├─ Route user request to playbook              │ │
│  │  ├─ Build system prompt (site context, rules)   │ │
│  │  ├─ Dispatch tool calls to sandbox              │ │
│  │  └─ Stream results to frontend (SSE)            │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Playbook Runner                                 │ │
│  │  ├─ Content playbook (text, images, pages)      │ │
│  │  ├─ Design playbook (theme, layout, colors)     │ │
│  │  ├─ Plugin playbook (install, configure)        │ │
│  │  └─ Site build playbook (scaffold, populate)    │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Sandbox Manager                                 │ │
│  │  ├─ Spin up/down containers (Docker + k8s)      │ │
│  │  ├─ Warm pool (pre-booted base images)          │ │
│  │  ├─ Mirror user site (plugin, content, media)   │ │
│  │  └─ Garbage collection (idle, hard timeout)     │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Deploy Manager                                  │ │
│  │  ├─ Compute diff from sandbox → live site       │ │
│  │  ├─ Push changes via plugin API (files, DB)     │ │
│  │  └─ Rollback (revert last deploy)               │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  WordPress Plugin (on user's hosting)                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │  REST API (site info, read/write files, DB,    │ │
│  │  WP-CLI execution, deploy receiver)            │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Infrastructure                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Docker + orchestration on raw VPS (v1)        │ │
│  │  → Pre-baked WordPress image                   │ │
│  │  → Warm pool for instant spin-up               │ │
│  │  → Lazy media sync (only what the task needs)  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 8.2 Agent substrate (locked)

- **Model:** Grok (xAI) — strong agentic capabilities, tool-calling, multi-step reasoning
- **Routing:** Wursor-hosted (users do not need their own API key)
- **Tool-calling:** Each playbook step is a tool call against the sandbox. The agent orchestrates the sequence; the API server dispatches.
- **System prompt:** Built per session from:
  - Site info (theme, active plugins, WordPress version, PHP version)
  - User's goal (parsed from the chat message)
  - Safety rules (never touch the live site, never ask for money, never hide changes)
  - Playbook-specific instructions

### 8.3 Sandbox infrastructure

- **Base image:** WordPress + nginx + PHP 8.x + MySQL 8.x + WP-CLI + Redis
- **Warm pool:** 5–10 pre-booted containers per region, ready to accept a mirror
- **Site mirroring:**
  - Plugin list and active theme → installed immediately
  - Content (posts, pages, options) → pulled from the live site via the plugin API
  - Media files → not copied. Sandbox nginx proxies `/wp-content/uploads/*` to the live origin (or a signed Wursor proxy). A file is pulled only when the agent replaces it.
- **Networking:** Sandboxes have full outbound internet access (for plugin installs, API calls). No inbound access except from the Wursor API server.
- **Idle timeout:** 15 minutes. User typing or viewing the preview resets the timer.
- **Hard timeout:** 24 hours. Sandbox is destroyed regardless of state.
- **Cost per sandbox:** ~$0.01–0.02/hour in raw compute (VPS-backed). A typical 1.5-hour task costs ~$0.02–0.03.

### 8.4 Deploy mechanism

When the user approves:

1. **Compute diff** — compare the sandbox's file system and database to the mirror snapshot taken at spin-up
2. **File changes** — send changed files to the plugin's deploy API
3. **Database changes** — send SQL migration to the plugin's deploy API (or WP-CLI commands)
4. **Plugin changes** — plugin installs/activations sent as WP-CLI commands
5. **Verify** — plugin confirms the live site is functional after changes
6. **Snapshot** — deploy snapshot stored for rollback (files + DB state) on the site **and** in Wursor's cloud (last 3). Cloud copy is what Undo uses if the live site is down.
7. **Drift check** — re-hash the live files/options in the changeset at approve time. If the live site changed since the preview, ask before clobbering (R11).
8. **No-surprise gate** — slug / `blog_public` / payment / role changes require an explicit confirm bullet (R12).

Rollback walks the changeset journal backwards, then restores from the snapshot if the journal is incomplete.

### 8.5 Error & offline states

| State | What Wursor does |
| :--- | :--- |
| **Plugin not installed** | Show the pairing code and a link to install the plugin; wait for connection |
| **Plugin unreachable** | Show "Wursor can't reach your site" with troubleshooting steps (check if site is down, plugin is active) |
| **Sandbox spin-up fails** | Retry with a fresh container; if persistent, show "We're having trouble starting a preview" with support link |
| **Agent encounters an error** | Surface in chat: "I ran into an issue. Here's what happened and what I can try next." |
| **Deploy fails** | Show the error with a retry button; sandbox is kept alive so the user can retry or contact support |
| **Deploy results in broken site** | Plugin detects a 500 error or critical failure; automatically rolls back and reports to the user |
| **Network offline (user)** | Show "You're offline" message; session resumes when connection returns |
| **Rate limit / API error** | Retry with exponential backoff; surface persistent failures in chat |

---

## 9. UX Notes

- **Landing page is the chat.** No dashboard, no navigation. The user signs in and sees a chat input. That's it.
- **First-time user:** "Welcome to Wursor. Describe what you'd like to change on your site."
- **Empty state:** "Your site is connected. Try: 'Make my homepage look more modern' or 'Add a contact form.'"
- **Preview opens in a split view.** Chat on the left, preview on the right. The user can resize the split.
- **Preview is interactive.** The user can click around the preview, navigate pages, test forms. It's a real browser.
- **Approve/reject buttons are persistent.** They stay at the bottom of the chat as long as there's an unapproved change.
- **Deploy history is a simple list.** "Homepage redesign — applied 2 hours ago — Undo" with a one-click undo on each entry.
- **The agent has a name and personality.** Warm, competent, transparent. "I've updated your homepage. Here's what I changed: I updated the hero section, added a call-to-action button, and fixed the mobile layout."
- **Mobile:** The preview collapses to a full-screen chat with a "Show preview" button that opens the preview in a new tab.

---

## 10. Competitive Landscape

| Product type | Strength | Gap Wursor fills |
| :--- | :--- | :--- |
| Page builders (Elementor, etc.) | Visual editing | Require learning the builder; agent does it for you |
| AI content assistants (Jetpack AI, etc.) | Writing posts | Can't change layout, install plugins, or modify design |
| General AI coding tools | Code-level changes | Require technical skill; no visual preview |
| Wix / Squarespace | Simple, integrated | Not WordPress; don't own your site |
| Agency / freelancer | Human expertise | Slow, expensive, per-task |
| Host copilot features | In-context help | Limited to what the host built; no agentic autonomy |

**Moat:** Cloud sandbox + agentic orchestration + universal plugin connector. The user gets a safe, ephemeral copy of their site, an agent that can do anything a WordPress developer can do, and a one-click deploy back to the live site. No other product combines all three.

---

## 11. Metrics & Success Criteria

| Metric | Baseline | 6-month target | Owner | How we measure |
| :--- | :--- | :--- | :--- | :--- |
| Time from sign-up to first deployed change | TBD (alpha 1) | ≤ 5 min | PM | In-app timer from sign-up to first approve |
| Task completion rate (user describes → change deployed) | TBD (alpha 1) | ≥ 60% | PM | Per-task: started → approved |
| User claps back (reject → re-describe → approve) | TBD | ≤ 20% of tasks | PM | Reject events per session |
| Sandbox spin-up time (p50) | TBD | ≤ 5s | Eng | Server-side timer |
| Verify step catches issues before approve | TBD (alpha 1) | ≥ 30% of failing tasks | PM | Verify-fail before approve, per task |
| Weekly active users as % of sign-ups | TBD | ≥ 40% | PM | Weekly active per cohort |
| Paid conversion | TBD | ≥ 5% of trial users | GTM | Billing records |

**Measurement plan:** all metrics instrumented from first alpha build. Every metric is a dashboarded event. Baselines from closed alpha (Phase 1) inform Phase 2 targets.

---

## 12. Phased Roadmap

### Phase 0 — Pivot & spec (now)
- Rewrite PRD for non-technical-first
- Risk rewrite: §13 is 14 risks with mitigations that map to tests or UI (this revision)
- Spike: golden-task eval harness (20 prompts × ≥2 canned WP sites, scored)
- Spike: Elementor / builder detection in site-info
- Spike: pairing threat model (8+ char, TTL, lockout, HMAC, scoped tokens)
- Spike: time a task-scoped content mirror + media proxy against a ≥2GB site
- Spike: cloud sandbox orchestration (WordPress in Docker, overlay + pause pool)
- Spike: WordPress plugin (REST API, file read/write, DB access, WP-CLI)
- Spike: basic chat + preview web app
- Lock the P0 plugin catalog (~40 slugs) before any agent can install

### Phase 1 — Foundation (weeks 1–8)
- Web app: sign-up, site connection (plugin auth), chat, preview, approve/reject
- Sandbox infrastructure: overlay + pause-to-disk warm pool, task-scoped mirroring, media proxy, idle timeout, GC
- WordPress plugin: site info API (builder + capability tiers + pre-flight), HMAC-signed pairing, two-phase deploy receiver, journaled rollback, auto-update
- Playbooks: content edit (text, images, pages), design change (layout, colors)
- Deploy history: timeline, one-click undo

**Exit criteria:** a new user signs up, connects their WordPress site, types "change my homepage heading to 'Welcome to My Business'", sees a preview with the change, and approves it — all in under 5 minutes.

### Phase 2 — Intelligence (weeks 9–16)
- Plugin playbooks (install, configure, fix conflicts)
- Site build playbook (from scratch, from design direction)
- Mobile-responsive preview
- Agent clarifying questions (disambiguation)
- Closed alpha (10–20 site owners)

**Exit criteria:** all §11 baselines collected and reviewed; a non-technical user can install a plugin via chat and see it working on their site.

### Phase 3 — Professional (weeks 17–28)
- Multi-step workflows (queue changes)
- Visual design picker (theme gallery)
- Site build playbook (complex, multi-page)
- SEO optimization playbook
- Performance optimization playbook
- Paid beta

### Phase 4 — Platform
- Multi-site management
- Team / agency mode
- E-commerce operations (WooCommerce)
- Scheduled changes
- Marketplace (community playbooks)

---

## 13. Risks & Mitigations

Isolation, a warning dialog, and a fallback model are not mitigations. Each row below maps to a test, a playbook constraint, or a product surface. Residual impact assumes the mitigation ships; **Launch-blocking** means Phase 1 cannot exit without it.

### 13.1 Documented risks

#### R1 — Agent breaks the sandbox site

| | |
| :--- | :--- |
| **Impact (original → residual)** | Medium → Low for the live site; **High for session trust** until checkpoints ship |
| **Launch-blocking** | Circuit breaker and per-step verify. Full self-heal can follow. |
| **Why the old mitigation fails** | “GC and start fresh” keeps the live site safe and kills the session. A white-screen preview after 90 seconds is a churn event. Retrying the same trajectory also burns the warm pool and the model budget. |
| **Mitigation** | Copy-on-write checkpoint after every successful playbook step (overlayfs / Docker commit). Verify after every tool call (target URL 200, no new PHP fatal, `siteurl`/`home` unchanged). Two consecutive verify failures → circuit breaker, stop, and talk — do not thrash. Content playbooks prefer WP-CLI / REST (`wp post update`) over theme file surgery. A tiny internal self-heal path rewinds the last checkpoint before the user sees a dead preview. |
| **Owner / where** | Sprint 1 (overlay + GC), Sprint 3 (circuit breaker), Sprint 4 (REST-first content), Sprint 6 (reuse verifier on the sandbox). |

#### R2 — Agent installs a malicious plugin

| | |
| :--- | :--- |
| **Impact (original → residual)** | Medium → Low **if** the catalog and gates ship. Deploy path makes the unmitigated case High. |
| **Launch-blocking** | Tool-schema allowlist in Sprint 3. Catalog + reputation in Sprint 9, but the agent must not be able to `wp plugin install <url>` before then. |
| **Why the old mitigation fails** | wordpress.org is not a reviewed-safe catalog. Sandbox isolation only holds until the user clicks “Looks good → Apply.” A pretty form that phones home looks fine in preview. |
| **Mitigation** | P0/P1 install from a curated catalog of ~40 slugs only (CF7, WPForms, Yoast, RankMath, Woo, Elementor, WooPayments, …). Reputation gate before install: WPScan / Patchstack CVE, last updated < 18 months, `tested up to` within 2 majors, active-install floor, zip SHA against a Wursor mirror. Fail closed. While a new plugin first activates, sandbox egress is allowlisted (wordpress.org, gravatar, the user’s own domain); unexpected egress is surfaced in chat and the plugin is not applied. Static smell test rejects `eval(base64_decode`, `/e` preg, unexpected remote `file_get_contents`. Deploy re-checks reputation even after approve. No arbitrary ZIP, no premium marketplace URLs, no `wp plugin install <url>` in v1. |
| **Owner / where** | Sprint 3 (`tool-schemas.ts` allowlist), Sprint 9 (catalog + reputation + egress watch). |

#### R3 — Deploy to live site fails

| | |
| :--- | :--- |
| **Impact (original → residual)** | High → Medium (hosts stay messy) |
| **Launch-blocking** | **Yes** |
| **Why the old mitigation fails** | The failure mode is a **partial** deploy, not a clean 500. CSS lands, `wp_options` is half-updated, object cache serves the old theme, then rollback fails because the customer’s disk is full. HTTP 200 does not catch a wrong `home` URL or a dropped menu. |
| **Mitigation** | Two-phase deploy: prepare artifacts under `wp-content/upgrade/wursor-<id>/`, then commit. Prepare failure = live site untouched. Pre-flight before the confirm dialog: disk free, `ABSPATH` writable, `DISALLOW_FILE_MODS` off, PHP memory, `post_max_size`, can flush object/opcode cache, can enter maintenance mode. Failure copy is host-ticket language, not “deploy failed.” Every file / option / WP-CLI call is a numbered journal entry; rollback walks it backwards. Health contract: homepage + one inner page + `/wp-json` + `wp-login.php` + no new fatal + `siteurl`/`home` match intent + screenshot SSIM vs sandbox. Last 3 snapshots live in **Wursor’s cloud**, not only on the customer disk, so Undo still works when the site is down. Maintenance mode for the commit window (seconds). Detect managed hosts at connect; v1 still file-pushes but must purge known caches. Canary rewrite (`/?wursor_canary=`) is stretch; journal + cloud snapshot is the P0 version. |
| **Owner / where** | Sprint 2 (pre-flight on site-info), Sprint 6 (two-phase, journal, cloud snapshot, health contract). The existing `handles partial failures` test is acceptance, not a comment. |

#### R4 — Mirroring a large site is slow

| | |
| :--- | :--- |
| **Impact (original → residual)** | High → Medium once thin-slice + media proxy ship (standby replica is Phase 2) |
| **Launch-blocking** | **Yes** for task-scoped mirror + media proxy. Standby replica is not. |
| **Why the old mitigation fails** | Warm pool absorbs *boot*, not *copy*. “Incremental” was unnamed. The 5-minute Phase 1 exit criterion dies on a Woo store with 8 years of posts. Media is often not the bottleneck — `wp_posts`, plugin folders, and upload thumbs are. |
| **Mitigation** | **Task-scoped mirrors.** Content edit → target posts + `wp_options` + menus + active theme/plugins (skip orders, logs, transients, revisions). Design → theme + `theme.json` + templates + a few representative pages. Plugin install → current site + the new plugin, still skip Woo order tables. Theme swap / rebuild → fuller clone. **Remote media proxy:** sandbox nginx rewrites `/wp-content/uploads/*` to the live origin (or a signed Wursor proxy). Copy a file only when the agent replaces it. Plugin sends a path→sha256 manifest; wordpress.org packages come from a Wursor cache, not the customer host. Chunked resumable zstd batches over plugin REST, not one zip. Default DB exclude: `_transient_*`, action scheduler logs, Woo orders/customers for non-commerce playbooks. Progressive preview: show the target page as soon as *that* page is mirrored. **Phase 2:** a per-site standby replica synced by webhook / 15-min cron so a task is `fork replica`, not `pull production`. |
| **Owner / where** | Sprint 1 (proxy, hash manifest, subset dump), §14 media decision, Phase 2 standby replica. |

#### R5 — User can't describe what they want

| | |
| :--- | :--- |
| **Impact (original → residual)** | Medium → Medium. Unmitigated this is **High for activation** — vague language is the default for the primary persona. |
| **Launch-blocking** | Intent chips, site-aware starters, and structured reject in Sprint 8. Full design-fork picker can wait on alpha reject rate. |
| **Why the old mitigation fails** | Clarifying questions feel like a support form. The §11 “claps back” metric (reject → re-describe ≤ 20%) *is* this risk. |
| **Mitigation** | Empty state is intent chips (“Change wording” / “New look” / “Add a form” / “Something’s broken”), not a blank chat. After connect, scan for default theme H1, missing favicon, no contact page, mobile overflow, and offer three *specific* starter sentences. Reject is chips (“Wrong color” / “Too busy” / “Keep my logo” / “Undo only the last thing”), each mapped to a constrained follow-up. Vague design prompts should *show* 2–3 cheap visual forks (theme.json / CSS / catalog themes) rather than ask “modern or classic?” Point-and-talk: click an element in the preview, then type “make this blue” — Phase 1 spike, not Phase 4 magic. Before/after slider on the preview. Voice input on mobile via browser SpeechRecognition is enough for alpha. |
| **Owner / where** | Sprint 8 (chips, starters, structured reject), Phase 1 spike (point-and-talk), Sprint 12 (disambiguation), pull a fork-and-pick slice forward from Sprint 13 if design-prompt reject rate is high. |

#### R6 — Plugin compatibility (old WordPress, old PHP)

| | |
| :--- | :--- |
| **Impact (original → residual)** | Medium → Medium |
| **Launch-blocking** | Version matrix + capability tiers at connect (Sprint 2). |
| **Why the old mitigation fails** | A warning a dentist cannot act on is a bounce. The real incompatibilities are Elementor vs Gutenberg vs Classic, security plugins that kill REST, and hosts that set `DISALLOW_FILE_MODS` — not PHP 7.4 vs 8.2 alone. |
| **Mitigation** | **Capability tiers, not a binary supported flag.** *Content-safe:* edit posts/pages via REST (always try to offer this). *Design-safe:* writable theme / `theme.json` / page-builder API. *Install-safe:* WP-CLI or filesystem and `DISALLOW_FILE_MODS` off. Chat: “I can change text on your site today. Installing plugins needs a WordPress update — I can preview that first if you want.” **P0 matrix (locked):** WP 6.1+ and PHP 8.0+ for full playbooks; WP 5.8–6.0 / PHP 7.4 are content-only. Publish this in the plugin readme. Detect Elementor / Beaver / Divi / Gutenberg at connect; content and layout playbooks must use the matching adapter or they will edit `post_content` while Elementor JSON is what renders. Sandbox may run newer PHP than production; deploy lints PHP against the live interpreter version. “Update WordPress for me” is a sandbox-then-approve playbook, not a warning. If PHP is old, generate a 4-line host-ticket email the user can forward. Connect-time scan also flags Wordfence / iThemes / disabled REST, `DISALLOW_FILE_EDIT`, `open_basedir`, object cache. |
| **Owner / where** | Phase 0 spike (matrix + builder detect), Sprint 2 (tiered connect + concierge copy), Sprint 4–5 (adapters for builders we actually see). |

#### R7 — Grok model quality for agentic tasks

| | |
| :--- | :--- |
| **Impact (original → residual)** | Medium → Medium. Unmitigated this is High until the eval harness has a score. |
| **Launch-blocking** | Golden-task harness (Phase 0) + tool allowlist (Sprint 3). |
| **Why the old mitigation fails** | “Have a fallback model” is not a design. WordPress is full of hallucinated WP-CLI flags. Grok stays the default *vendor*; it must not be the architecture. |
| **Mitigation** | Playbooks are the intelligence; the model fills slots (`page`, `old`, `new`) and a deterministic runner executes. Almost never emit free-form shell. Allowlisted tools only: a short WP-CLI list, REST routes, file paths under `wp-content/themes/{active}` and `wp-content/uploads`. Forbidden: `wp db query` with DROP/TRUNCATE, `wp eval`, `wp config`, `rm`, writing `wp-config.php`, touching `mu-plugins`. Golden-task harness from day 1: 20–50 fixture sites × ~20 prompts, asserting preview text / options / screenshot — not “the model said it worked.” Router: cheap/fast model classifies + asks one question; stronger model (Grok or fallback) only for design/plugin reasoning. Fallback is **per playbook**. Sprint 3 client is `llm-client.ts` with a Grok adapter; vendor switch is an env var. Self-critique before the user sees the preview (health contract + screenshot: “Did the H1 actually change?”). Store anonymized winning tool traces as few-shots. If the classifier is unsure, offer chips (R5) — do not improvise a theme rewrite. |
| **Owner / where** | Phase 0 (eval harness, before playbooks), Sprint 3 (allowlist + provider-agnostic client), Sprint 4–5 (slot-filling). |

#### R8 — Sandbox cost scales with usage

| | |
| :--- | :--- |
| **Impact (original → residual)** | Low compute → Low. **Token spend is the real risk** (Medium) and was previously named but not mitigated. |
| **Launch-blocking** | Per-task token budget in Sprint 3. Pause-to-disk in Sprint 1. |
| **Why the old mitigation fails** | The old row admitted API spend is higher than VPS hours, then did nothing about it. A warm pool of *running* WP+MySQL+Redis boxes is idle burn. One runaway tool loop can cost more than a month of that user’s subscription. |
| **Mitigation (compute)** | 15-min idle → pause / checkpoint to disk, resume in ~2s. Warm pool = paused images + 1–2 hot spares per region, not 5–10 fully running. Shared read-only WordPress image + overlayfs site layers. Predictive pool on time-of-day / queue depth. Do not copy media (R4). Content-edit without a full container is stretch. |
| **Mitigation (tokens — the actual cost)** | Hard cap per task: e.g. 12 tool rounds and a dollar token budget. Hit the cap → R1 circuit breaker, not another retry. Playbook-specific short prompts; do not dump the entire site-info blob every turn. Cache prompt prefixes and repeated tool results (“what’s the active theme”). Price the unit against p95 token usage, not sandbox hours. Free tier = 1 concurrent sandbox + M token-budgeted tasks (kills sandbox-farming). |
| **Owner / where** | Sprint 1 (pause + overlay + no media copy), Sprint 3 (token budget), Phase 3 pricing (unit = task budget). |

### 13.2 Risks the original table did not name

The spec creates these. They are in scope for Phase 1.

#### R9 — Plugin is a privileged backdoor

Plugin exposes files + DB + WP-CLI. A 6-character pairing code (`[A-Z0-9]{6}`) with no stated rate limit, plus a stolen token, is site ownership.

**Mitigation:** Pairing codes are 8+ characters, 5-minute TTL, 5-attempt lockout, bound to account + site URL. Tokens are hashed at rest, scoped (read vs deploy), rotatable, stored in WP encrypted with a site salt. Requests are HMAC-signed (body + timestamp) so a leaked URL is not enough. **Launch-blocking. Sprint 2.**

#### R10 — Sandbox holds real customer PII

A full mirror copies Woo orders, emails, form submissions, and license keys into a container with outbound internet.

**Mitigation:** Default DB subset excludes orders, customers, and form entries. Redact options matching `*_key`, `*_secret`, `smtp_pass`. Egress allowlist (R2). 24-hour hard delete already helps; pin sandbox region to the user’s site region when we have it, and document retention. **Launch-blocking for subset + redact. Sprint 1.**

#### R11 — Live-site drift during a session

An agency or the user edits wp-admin while the sandbox is open. Deploy silently overwrites their work.

**Mitigation:** On approve, re-hash the live files/options in the changeset. If they drifted, show “your live site changed since this preview — refresh preview or apply anyway.” Never silent clobber. **Sprint 6.**

#### R12 — Visual-only approve misses silent damage

The user never sees a diff (product principle — keep it). That is right for UX and wrong for SEO slugs, `robots`, deleted pages, and payment settings.

**Mitigation:** Keep the UI visual. The agent already owes a plain-language change list (“I also removed your sidebar”). Make the no-surprise rule mechanical: block deploy on URL/slug changes, `blog_public`, payment/shipping, and user/role tables unless the user explicitly confirms that bullet. **Launch-blocking. Sprint 6.**

#### R13 — Page builders, managed hosts, and security plugins

Will cause more alpha failures than Grok quality. Partly covered by R6.

**Mitigation:** Connect-time detection + adapters + capability tiers (R6). Alpha recruitment must include at least one Elementor site and one managed host (WP Engine / Kinsta / SiteGround), not only Twenty Twenty-Four on a VPS. **Alpha plan, Sprint 2 detect, Sprint 4–5 adapters.**

#### R14 — One bad live deploy kills trust

A restaurant homepage going down on a Saturday is a tweet. Trust is the moat.

**Mitigation:** R3 journal + cloud snapshots + auto-rollback. First N deploys of a new account, and any theme/plugin install, take a slower “Wursor is watching this deploy” path with the stricter health contract. Dogfood on a sacrificial WordPress site before any stranger’s. **Launch-blocking process. Sprint 6 + Sprint 8 bug bash.**

### 13.3 Residual ratings (if the mitigations ship)

| ID | Residual impact | Launch-blocking? |
| :--- | :--- | :--- |
| R1 Sandbox self-heal | Low | Circuit breaker yes; full self-heal no |
| R2 Malicious plugin | Low if catalog + gate ship | **Yes** — tool allowlist |
| R3 Deploy / rollback | Medium (hosts are messy) | **Yes** |
| R4 Slow mirror | Medium (standby is Phase 2) | **Yes** — thin-slice + media proxy |
| R5 Intent UX | Medium | Chips + starters in Sprint 8 |
| R6 Compatibility | Medium | Matrix + tiers in Sprint 2 |
| R7 Model quality | Medium | Harness + allowlist in Phase 0 / Sprint 3 |
| R8 Cost | Low compute / Medium tokens | Token budget in Sprint 3 |
| R9 Plugin auth | High if skipped | **Yes** |
| R10 PII in sandbox | High if skipped | **Yes** — subset + redact |
| R11 Drift | Medium | Sprint 6 |
| R12 Silent damage | High if skipped | **Yes** — no-surprise gate |
| R13 Builders / hosts | Medium | Alpha plan, not just code |
| R14 Trust-ending deploy | High | Dogfood + watched first deploys |

---

## 14. Decisions & Open Questions (Phase 0)

### Resolved (locked)

1. **Shell:** Web app. No desktop app. No code editor. The chat interface is the entire product surface.
2. **Architecture:** Web app → API server → cloud sandbox → WordPress plugin on user's hosting.
3. **Sandbox hosting:** Wursor-hosted (cloud VPS with Docker). User installs nothing beyond the plugin.
4. **Model:** Grok (xAI). Wursor-hosted. Users do not need their own API key.
5. **Plugin connector:** Required for all users. Single install, one-time pairing code.
6. **Pricing:** Seat-based (free tier with limited tasks/month, paid tier for unlimited). Free tier supports the "try before you trust" loop.
7. **Non-technical first:** All features are designed for the person who has never seen a terminal. Advanced features are added later.

### Remaining (genuinely open)

1. **Free tier limits:** How many token-budgeted tasks per month before asking for payment? Unit is a task budget (R8), not sandbox hours. The number itself is set during Phase 3 beta.
2. **Pricing:** Final $X and free tier limits set during Phase 3 paid beta.

### Locked this revision (were open in v2.0)

3. **Media library handling:** Remote media proxy is the default. Sandbox nginx rewrites `/wp-content/uploads/*` to the live origin (or a signed Wursor proxy). A file is copied into the sandbox only when the agent replaces it. Full-library copy is not a v1 path, including for 20GB+ libraries. Task-scoped DB/file mirrors (R4) plus this proxy are how the 5-minute exit criterion stays honest.
4. **Plugin compatibility:** P0 guarantee is WP 6.1+ and PHP 8.0+ for full playbooks. WP 5.8–6.0 and PHP 7.4 are **content-only** (REST edits, no theme file writes, no plugin installs). Older than that is unsupported with concierge copy to the host. Capability is tiered at connect (content-safe / design-safe / install-safe), not a binary block (R6). Page-builder detection (Elementor, Beaver, Divi, Gutenberg) is part of connect, not a later surprise.

---

## 15. Appendices

### A. Glossary
- **Sandbox** — An ephemeral, isolated copy of the user's WordPress site running in Wursor's cloud
- **Playbook** — A structured, multi-step agent workflow for a specific task type
- **Plugin connector** — The WordPress plugin that connects the user's site to Wursor
- **Mirror** — The process of copying a site's theme, plugins, content, and settings into a sandbox
- **Deploy** — The process of applying sandbox changes to the live site
- **Warm pool** — Paused WordPress images plus a small number of hot spares, ready to accept a task-scoped mirror
- **Media proxy** — Sandbox nginx rewrite of `/wp-content/uploads/*` to the live origin so previews work without copying the library
- **Capability tier** — What Wursor can do on this site today: content-safe, design-safe, and/or install-safe
- **Changeset journal** — Numbered list of file, option, and WP-CLI operations that deploy walks forward and rollback walks backward
- **No-surprise gate** — Deploy blocker for slug, visibility, payment, and role changes until the user confirms that bullet

### B. P0 playbook sketches
1. **Edit text** — parse user request → find content in DB → update → verify page loads → show preview
2. **Change layout** — parse user request → identify theme → modify template or page builder content → verify → preview
3. **Install plugin** — parse user request → search WP repo → install via WP-CLI → activate → configure defaults → verify → preview

### C. Non-goals (v1)
- A code editor or terminal
- Git integration or file diffs
- Local development workflows (Docker, wp-env, Local WP)
- AI content writing (blog posts, copywriting — Wursor is for *doing*, not writing)
- Replacing wp-admin entirely for users who want it (the plugin coexists)
- Hosting or infrastructure management (Wursor is not a hosting platform)
- Extension API or marketplace (Phase 4)
- Multi-user or team features (Phase 4)
- **Accessibility certification (WCAG) or i18n / localization** — v1 is English-only with no formal accessibility conformance target. The web app targets standard web accessibility practices but will not be audited until Phase 3.

### D. Wursor's own test strategy
- **Unit tests** for the agent orchestrator, playbook runner, sandbox manager, and deploy manager
- **Integration tests** with real WordPress sandbox instances in CI (Docker on GitHub Actions, pre-baked image)
- **E2E tests** with Playwright against the web app, connected to a real sandbox + plugin
- **Release gates:** CI runs unit + integration on every PR; e2e before each release

### E. One-liner
**Wursor is the agentic layer for WordPress — describe what you want, see it live, approve it.**

---

*End of PRD v2.0 — Wursor*