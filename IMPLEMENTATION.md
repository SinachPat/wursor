# Implementation Guide — Wursor v2

**Version:** 2.0  
**Source:** [PRD.md](./PRD.md) v2.0  
**Method:** Test-driven development (TDD) — every module is written against its tests before its implementation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Build Phases](#3-build-phases)
4. [Phase 0 — Risk spikes (before Sprint 1)](#4-phase-0--risk-spikes-before-sprint-1)
5. [Phase 1 — Foundation (Weeks 1–8)](#5-phase-1--foundation-weeks-18)
   - [Sprint 1: Web app scaffold + sandbox orchestration](#sprint-1)
   - [Sprint 2: WordPress plugin connector](#sprint-2)
   - [Sprint 3: Agent orchestrator + playbook runner](#sprint-3)
   - [Sprint 4: Content playbooks](#sprint-4)
   - [Sprint 5: Design playbooks](#sprint-5)
   - [Sprint 6: Deploy + rollback](#sprint-6)
   - [Sprint 7: Integration + exit criteria](#sprint-7)
   - [Sprint 8: Polish + alpha readiness](#sprint-8)
6. [Phase 2 — Intelligence (Weeks 9–16)](#6-phase-2--intelligence-weeks-916)
7. [TDD Rules](#7-tdd-rules)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Glossary](#9-glossary)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  User's Browser (Wursor Web App)                          │
│  ┌────────────────────┐  ┌─────────────────────────────┐ │
│  │  Chat Panel         │  │  Preview iframe              │ │
│  │  (React)            │  │  (sandbox URL, interactive)  │ │
│  │  ┌────────────────┐ │  │  ┌─────────────────────────┐ │ │
│  │  │ Message list    │ │  │  │ Live preview of the    │ │ │
│  │  │ Input field     │ │  │  │ sandbox site. User     │ │ │
│  │  │ Approve/Reject  │ │  │  │ can click around,     │ │ │
│  │  │ buttons         │ │  │  │ navigate pages.       │ │ │
│  │  └────────────────┘ │  │  └─────────────────────────┘ │ │
│  └────────────────────┘  └─────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Deploy History (timeline, one-click undo)            │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS / SSE
┌──────────────────────▼───────────────────────────────────┐
│  API Server (Node.js + TypeScript)                          │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Session Manager     │  │  Agent Orchestrator          │ │
│  │  ├─ Auth             │  │  ├─ Route request → playbook │ │
│  │  ├─ Site connection  │  │  ├─ Build system prompt     │ │
│  │  └─ Session state    │  │  ├─ Dispatch tool calls     │ │
│  │                     │  │  └─ Stream results (SSE)    │ │
│  ├─────────────────────┤  ├──────────────────────────────┤ │
│  │  Sandbox Manager     │  │  Playbook Runner             │ │
│  │  ├─ Spin up/down    │  │  ├─ Content playbook         │ │
│  │  ├─ Warm pool       │  │  ├─ Design playbook          │ │
│  │  ├─ Site mirroring  │  │  ├─ Plugin playbook          │ │
│  │  └─ GC              │  │  └─ Site build playbook      │ │
│  ├─────────────────────┤  ├──────────────────────────────┤ │
│  │  Deploy Manager      │  │  Plugin API Client           │ │
│  │  ├─ Compute diff    │  │  ├─ Site info (read)         │ │
│  │  ├─ Push changes    │  │  ├─ File write               │ │
│  │  ├─ Verify deploy   │  │  ├─ DB write                 │ │
│  │  └─ Rollback        │  │  └─ WP-CLI execute           │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Infrastructure (Docker VPS)                               │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Warm Pool           │  │  Active Sandboxes            │ │
│  │  (pre-booted WP imgs)│  │  (ephemeral containers)      │ │
│  │  ┌─────────────────┐ │  │  ┌──────────────────────────┐ │ │
│  │  │ nginx + PHP 8.x │ │  │  │ WordPress + MySQL       │ │ │
│  │  │ + MySQL 8.x     │ │  │  │ + user's theme/plugins  │ │ │
│  │  │ + WP-CLI        │ │  │  │ + user's content/media  │ │ │
│  │  └─────────────────┘ │  │  └──────────────────────────┘ │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Internet                                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  User's WordPress Site (their hosting)                  │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Wursor Plugin (REST API, WP-CLI, deploy rx)     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Key stack decisions:**
- **Backend:** Node.js + TypeScript (fastest path to a working API server; the orchestration is I/O-bound, not CPU-bound)
- **Frontend:** React + TypeScript (chat interface, preview iframe, deploy history)
- **Sandbox:** Docker containers on VPS with a read-only pre-baked WordPress image and overlayfs site layers; media is proxied, not copied
- **Plugin:** PHP WordPress plugin (standard WordPress plugin architecture)
- **Database:** PostgreSQL for Wursor's own data (users, sites, sessions, deploy history); MySQL inside sandboxes for WordPress
- **Queue:** Redis for SSE streaming, task queues, and cache

---

## 2. Project Structure

```
wursor/
├── api/                           # API server (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts               # Express/Fastify server entry
│   │   ├── routes/
│   │   │   ├── auth.ts            # Sign-up, sign-in, session
│   │   │   ├── sites.ts           # Site connection, plugin pairing
│   │   │   ├── sessions.ts        # Chat session create/resume
│   │   │   ├── chat.ts            # Chat message, SSE stream
│   │   │   ├── preview.ts         # Preview URL, sandbox status
│   │   │   ├── deploy.ts          # Approve, deploy, rollback
│   │   │   └── webhooks.ts        # Plugin webhook receiver
│   │   ├── services/
│   │   │   ├── session-manager.ts
│   │   │   ├── agent-orchestrator.ts
│   │   │   ├── playbook-runner.ts
│   │   │   ├── sandbox-manager.ts
│   │   │   ├── deploy-manager.ts
│   │   │   ├── plugin-client.ts
│   │   │   └── warm-pool.ts
│   │   ├── agents/
│   │   │   ├── llm-client.ts      # Provider-agnostic LLM client (Grok adapter default)
│   │   │   ├── grok-adapter.ts    # Grok messages + tool-calling
│   │   │   ├── prompt-builder.ts  # System prompt per session (playbook-sliced)
│   │   │   ├── tool-schemas.ts    # Allowlisted tool schemas only
│   │   │   ├── circuit-breaker.ts # Two verify failures → stop
│   │   │   └── fallback.ts       # Per-playbook fallback + retry
│   │   ├── playbooks/
│   │   │   ├── registry.ts        # Playbook registry
│   │   │   ├── content.ts         # Content edit playbook
│   │   │   ├── design.ts          # Design change playbook
│   │   │   ├── plugin.ts          # Plugin install playbook
│   │   │   └── site-build.ts      # Site build playbook (P0 limited)
│   │   ├── sandbox/
│   │   │   ├── docker-client.ts   # Docker API client (overlayfs + pause)
│   │   │   ├── image-manager.ts   # Pre-baked image management
│   │   │   ├── mirror.ts          # Task-scoped site mirroring
│   │   │   ├── media-proxy.ts     # Origin proxy for /wp-content/uploads
│   │   │   ├── subset.ts          # DB subset + secret redaction
│   │   │   ├── manifest.ts        # path → sha256 delta + package cache
│   │   │   └── gc.ts              # Pause-to-disk, idle + hard timeout
│   │   ├── deploy/
│   │   │   ├── diff-engine.ts     # Compare sandbox → live site
│   │   │   ├── pusher.ts          # Two-phase prepare/commit + journal
│   │   │   ├── verifier.ts        # Health contract (sandbox + live)
│   │   │   ├── drift.ts           # Re-hash live site at approve time
│   │   │   ├── no-surprise.ts     # Block slug/payment/role without confirm
│   │   │   └── rollback.ts        # Journal walk + cloud snapshot restore
│   │   ├── models/
│   │   │   ├── user.ts
│   │   │   ├── site.ts
│   │   │   ├── session.ts
│   │   │   ├── deploy-log.ts
│   │   │   └── sandbox.ts
│   │   └── lib/
│   │       ├── crypto.ts          # Token generation, encryption
│   │       ├── sse.ts             # Server-sent events
│   │       └── queue.ts           # Redis queue
│   ├── __tests__/
│   │   ├── services/
│   │   │   ├── agent-orchestrator.test.ts
│   │   │   ├── sandbox-manager.test.ts
│   │   │   ├── deploy-manager.test.ts
│   │   │   └── playbook-runner.test.ts
│   │   ├── agents/
│   │   │   ├── llm-client.test.ts
│   │   │   ├── prompt-builder.test.ts
│   │   │   ├── tool-schemas.test.ts
│   │   │   └── circuit-breaker.test.ts
│   │   ├── playbooks/
│   │   │   ├── content.test.ts
│   │   │   ├── design.test.ts
│   │   │   └── plugin.test.ts
│   │   ├── sandbox/
│   │   │   ├── mirror.test.ts
│   │   │   ├── media-proxy.test.ts
│   │   │   ├── subset.test.ts
│   │   │   └── gc.test.ts
│   │   └── deploy/
│   │       ├── diff-engine.test.ts
│   │       ├── pusher.test.ts
│   │       ├── drift.test.ts
│   │       ├── no-surprise.test.ts
│   │       └── rollback.test.ts
│   ├── package.json
│   └── tsconfig.json
│
├── web/                           # Web frontend (React + TypeScript)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Chat.tsx           # Main chat + preview view
│   │   │   ├── SignIn.tsx
│   │   │   ├── SignUp.tsx
│   │   │   ├── ConnectSite.tsx    # Plugin pairing flow
│   │   │   └── History.tsx        # Deploy history timeline
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── Preview.tsx
│   │   │   ├── ApproveBar.tsx
│   │   │   ├── DeployTimeline.tsx
│   │   │   ├── SiteConnector.tsx
│   │   │   └── WelcomeScreen.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   ├── usePreview.ts
│   │   │   ├── useSession.ts
│   │   │   └── useDeploy.ts
│   │   └── styles/
│   │       └── global.css
│   ├── __tests__/
│   │   ├── ChatPanel.test.tsx
│   │   ├── Preview.test.tsx
│   │   ├── ApproveBar.test.tsx
│   │   └── SiteConnector.test.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── plugin/                        # WordPress plugin (PHP)
│   ├── wursor.php                 # Plugin header, bootstrap
│   ├── src/
│   │   ├── class-api.php          # REST API handlers
│   │   ├── class-auth.php         # Token auth, pairing
│   │   ├── class-deploy.php       # Deploy receiver (files, DB, WP-CLI)
│   │   ├── class-rollback.php     # Snapshot-based rollback
│   │   ├── class-site-info.php    # Site info provider
│   │   └── class-admin.php        # Admin settings page
│   ├── __tests__/
│   │   ├── test-api.php
│   │   ├── test-auth.php
│   │   ├── test-deploy.php
│   │   └── test-rollback.php
│   └── readme.txt
│
├── infrastructure/                # Infrastructure scripts
│   ├── docker/
│   │   ├── Dockerfile.wordpress   # Pre-baked WordPress image
│   │   └── docker-compose.yml     # For local dev
│   ├── scripts/
│   │   ├── warm-pool.ts           # Warm pool manager
│   │   ├── gc.ts                  # Garbage collection cron
│   │   └── deploy.ts              # Deploy hook
│   └── terraform/
│       └── main.tf                # VPS provisioning (v1: manual, v2: Terraform)
│
├── e2e/                           # End-to-end tests
│   ├── chat-flow.test.ts
│   ├── plugin-connection.test.ts
│   ├── deploy-flow.test.ts
│   └── rollback.test.ts
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .github/workflows/
    ├── ci.yml
    └── e2e.yml
```

---

## 3. Build Phases

| Phase | Weeks | Output | Exit criteria |
|-------|-------|--------|---------------|
| **Phase 1** | 1–8 | Web app, chat, preview, sandbox, plugin, deploy, content+design playbooks | New user connects site, makes a content change, previews, approves ≤5 min |
| **Phase 2** | 9–16 | Plugin playbooks, site build, agent disambiguation, closed alpha | Non-technical user installs a plugin via chat |
| **Phase 3** | 17–28 | Multi-step workflows, design picker, SEO, performance, paid beta | — |
| **Phase 4** | 29+ | Multi-site, team, e-commerce, scheduled changes, marketplace | — |

---

## 4. Phase 0 — Risk spikes (before Sprint 1)

These are not optional research notes. They lock decisions that Sprints 1–3 will encode as tests. Do not start the web-app scaffold until the four boxes below have a written result in this repo (a `spikes/` note is enough).

| Spike | Question | Done when |
| :--- | :--- | :--- |
| **Golden-task harness (R7)** | Can we score a model on WordPress tasks without vibes? | 20 fixture prompts against at least 2 canned WP sites. Each prompt has an assertion (preview text, option value, or screenshot). One Grok run is scored. Harness lives under `e2e/golden/` even if the runner is still a script. |
| **Elementor detect (R6 / R13)** | How do we know what actually renders a page? | A site-info payload that reports `builder: elementor \| beaver \| divi \| gutenberg \| classic` from plugin slugs + post meta. Documented in the plugin API sketch. |
| **Pairing threat model (R9)** | What stops a leaked URL from owning the site? | Written threat model: 8+ char code, 5-min TTL, 5-attempt lockout, HMAC request signing, hashed+scoped tokens. This becomes the Sprint 2 auth tests. |
| **Large-site mirror timing (R4)** | Does the 5-minute exit criterion survive a real site? | Time a task-scoped content mirror + media proxy against one ≥2GB WP export (or a synthetic one). Record p50/p95. If content-edit slice is not on the page in ≤60s, the Sprint 1 slice is wrong. |

Also decide, in writing, the P0 plugin catalog (~40 slugs). The agent will not be allowed to install anything else.

---

## 5. Phase 1 — Foundation (Weeks 1–8)

8 sprints, one per week. Every sprint produces a passing integration test. Risk IDs refer to [PRD.md §13](./PRD.md).

---

### Sprint 1: Web app scaffold + sandbox orchestration

**Goal:** A user can sign up, see a chat interface, and Wursor spins up a sandbox WordPress instance.

#### TDD sequence

**Step 1 — Write the integration test**

```typescript
// e2e/chat-flow.test.ts
import { test, expect } from '@playwright/test';

test('user signs up, starts a session, sandbox spins up', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.locator('.wursor-signup-button').click();
  await page.locator('input[name=email]').fill('test@example.com');
  await page.locator('input[name=password]').fill('password123');
  await page.locator('.wursor-submit').click();

  // Should see the chat interface
  await expect(page.locator('.wursor-chat-input')).toBeVisible();
  await expect(page.locator('.wursor-welcome')).toContainText('Describe what you');

  // Type a request
  await page.locator('.wursor-chat-input').fill('Change the homepage heading to "Hello World"');
  await page.locator('.wursor-chat-send').click();

  // Agent should acknowledge and start working
  await expect(page.locator('.wursor-message-agent')).toContainText('working on it', { timeout: 30000 });
});
```

**Step 2 — Write the unit tests**

```typescript
// api/__tests__/sandbox/mirror.test.ts
describe('Mirror', () => {
  it('connects to the live site and fetches site info', async () => {
    const mirror = new Mirror({ siteUrl: 'https://example.com', token: 'test-token' });
    const info = await mirror.fetchSiteInfo();
    expect(info.theme).toBeDefined();
    expect(info.plugins.length).toBeGreaterThan(0);
  });

  it('copies theme and active plugins to the sandbox', async () => {
    const mirror = new Mirror({ sandboxId: 'sb-123' });
    await mirror.copyTheme('twentytwentyfour');
    await mirror.copyPlugins(['woocommerce', 'contact-form-7']);
    // Verify files exist in the sandbox
    expect(await mirror.sandboxFileExists('/wp-content/themes/twentytwentyfour')).toBe(true);
  });

  it('does not copy the media library; preview is served via origin proxy', async () => {
    const mirror = new Mirror({ sandboxId: 'sb-123' });
    await mirror.copyTheme('twentytwentyfour');
    expect(await mirror.sandboxFileExists('/wp-content/uploads/2024/hero.jpg')).toBe(false);
    expect(await mirror.mediaProxyTarget('/wp-content/uploads/2024/hero.jpg')).toMatch(/^https:\/\/example.com\//);
  });

  it('copies a media file only when the agent replaces it', async () => {
    const mirror = new Mirror({ sandboxId: 'sb-123' });
    await mirror.stageReplacement('/wp-content/uploads/2024/hero.jpg', Buffer.from('new'));
    expect(await mirror.sandboxFileExists('/wp-content/uploads/2024/hero.jpg')).toBe(true);
  });

  it('mirrors a content-edit slice, not orders or transients', async () => {
    const dump = await new Mirror({ sandboxId: 'sb-123' }).exportDbSubset({ playbook: 'content', postIds: [1] });
    expect(dump.tables).toEqual(expect.arrayContaining(['wp_posts', 'wp_postmeta', 'wp_options']));
    expect(dump.tables).not.toEqual(expect.arrayContaining(['wp_wc_orders', 'wp_comments']));
    expect(dump.options).not.toEqual(expect.arrayContaining([expect.stringMatching(/(_key|_secret|smtp_pass)$/)]));
  });
});

// api/__tests__/sandbox/docker-client.test.ts
describe('DockerClient', () => {
  it('spins up a sandbox container from the pre-baked image', async () => {
    const client = new DockerClient();
    const container = await client.createSandbox('wursor-base:latest');
    expect(container.id).toBeDefined();
    expect(container.status).toBe('running');
  });

  it('destroys a sandbox container', async () => {
    const client = new DockerClient();
    await client.destroySandbox('sb-123');
    const status = await client.getStatus('sb-123');
    expect(status).toBe('destroyed');
  });
});

// api/__tests__/sandbox/gc.test.ts
describe('GarbageCollection', () => {
  it('pauses sandboxes to disk after 15 minutes of idle', async () => { /* ... */ });
  it('resumes a paused sandbox in ≤ 2s', async () => { /* ... */ });
  it('destroys sandboxes after 24 hours regardless', async () => { /* ... */ });
  it('does not pause or destroy active sandboxes', async () => { /* ... */ });
});
```

**Step 3 — Implement**

- **`web/`** — React app with sign-up, sign-in, chat interface (placeholder)
- **`api/src/index.ts`** — Express server with auth routes
- **`api/src/routes/auth.ts`** — Sign-up, sign-in, session management
- **`api/src/routes/sessions.ts`** — Create session, stream SSE
- **`api/src/services/sandbox-manager.ts`** — Orchestrate sandbox lifecycle
- **`api/src/sandbox/docker-client.ts`** — Docker API client (dockerode)
- **`api/src/sandbox/image-manager.ts`** — Pre-baked image → Dockerfile
- **`api/src/sandbox/mirror.ts`** — Task-scoped site mirroring (stub plugin client)
- **`api/src/sandbox/media-proxy.ts`** — Origin rewrite for `/wp-content/uploads` (no library copy)
- **`api/src/sandbox/subset.ts`** — DB subset + `*_key` / `*_secret` / `smtp_pass` redaction (R10)
- **`api/src/sandbox/manifest.ts`** — path→sha256 delta; wordpress.org packages from Wursor cache
- **`api/src/sandbox/gc.ts`** — Pause-to-disk on idle; destroy on 24h hard timeout
- **`infrastructure/docker/Dockerfile.wordpress`** — Pre-baked image (read-only base + overlayfs)
- **`infrastructure/scripts/warm-pool.ts`** — Paused images + 1–2 hot spares, not 5–10 running

#### Deliverables

- Web app with sign-up and chat interface
- Sandbox spin-up from pre-baked image (overlay + pause)
- Media proxy: preview works with zero upload copy
- Content-edit DB subset excludes orders / secrets
- `e2e/chat-flow.test.ts` passing (sign-up → sees chat)
- All unit tests passing

---

### Sprint 2: WordPress plugin connector

**Goal:** User installs the Wursor plugin on their site, pairs it with Wursor, and Wursor can read site info.

#### TDD sequence

**Step 1 — Write the tests**

```php
// plugin/__tests__/test-auth.php
class WursorAuthTest extends WP_UnitTestCase {
    public function test_generates_pairing_code() {
        $auth = new Wursor_Auth();
        $code = $auth->generate_pairing_code();
        $this->assertGreaterThanOrEqual(8, strlen($code));
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{8,}$/', $code);
    }

    public function test_pairing_code_expires_after_five_minutes() {
        $auth = new Wursor_Auth();
        $code = $auth->generate_pairing_code();
        $auth->advance_clock(301);
        $this->assertFalse($auth->redeem_pairing_code($code));
    }

    public function test_locks_out_after_five_failed_attempts() {
        $auth = new Wursor_Auth();
        $auth->generate_pairing_code();
        for ($i = 0; $i < 5; $i++) {
            $auth->redeem_pairing_code('NOPE0000');
        }
        $this->assertTrue($auth->is_locked_out());
    }

    public function test_verifies_valid_token() {
        $auth = new Wursor_Auth();
        $token = $auth->generate_token();
        $this->assertTrue($auth->verify_token($token));
    }

    public function test_rejects_invalid_token() {
        $auth = new Wursor_Auth();
        $this->assertFalse($auth->verify_token('invalid'));
    }
}

// plugin/__tests__/test-api.php
class WursorApiTest extends WP_UnitTestCase {
    public function test_returns_site_info() {
        $api = new Wursor_API();
        $response = $api->get_site_info();
        $this->assertArrayHasKey('theme', $response);
        $this->assertArrayHasKey('plugins', $response);
        $this->assertArrayHasKey('wordpress_version', $response);
        $this->assertArrayHasKey('php_version', $response);
        $this->assertArrayHasKey('builder', $response);
        $this->assertArrayHasKey('capabilities', $response);
        $this->assertArrayHasKey('preflight', $response);
    }

    public function test_requires_auth() {
        $api = new Wursor_API();
        $response = $api->handle_request('GET', '/site-info', []);
        $this->assertEquals(401, $response['status']);
    }
}

// plugin/__tests__/test-deploy.php (placeholder)
class WursorDeployTest extends WP_UnitTestCase {
    public function test_receives_file_change() {
        // Stub for Sprint 6
        $this->markTestSkipped('Deploy test in Sprint 6');
    }
}
```

```typescript
// api/__tests__/services/plugin-client.test.ts
describe('PluginClient', () => {
  it('connects to the plugin and fetches site info', async () => {
    const client = new PluginClient({ siteUrl: 'https://example.com', token: 'valid-token' });
    const info = await client.getSiteInfo();
    expect(info.theme).toBeDefined();
    expect(info.plugins).toBeInstanceOf(Array);
  });

  it('throws on invalid token', async () => {
    const client = new PluginClient({ siteUrl: 'https://example.com', token: 'invalid' });
    await expect(client.getSiteInfo()).rejects.toThrow('Authentication failed');
  });

  it('handles unreachable site', async () => {
    const client = new PluginClient({ siteUrl: 'https://nonexistent.example.com', token: 'token' });
    await expect(client.getSiteInfo()).rejects.toThrow('Site unreachable');
  });
});
```

```typescript
// web/__tests__/SiteConnector.test.tsx
describe('SiteConnector', () => {
  it('shows the pairing code', () => { /* ... */ });
  it('polls for connection status', () => { /* ... */ });
  it('shows success state when connected', () => { /* ... */ });
  it('shows error state when connection fails', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`plugin/wursor.php`** — Plugin header, activation hook, bootstrap
- **`plugin/src/class-auth.php`** — 8+ char pairing (5-min TTL, 5-attempt lockout), hashed scoped tokens (read vs deploy), HMAC request signing (R9)
- **`plugin/src/class-api.php`** — REST API endpoints (site-info, files, DB, WP-CLI); HMAC verified
- **`plugin/src/class-site-info.php`** — Theme, plugins, WP/PHP version, `builder`, capability tiers, pre-flight probe (disk, `DISALLOW_FILE_MODS`, cache flush, REST alive)
- **`plugin/src/class-admin.php`** — Admin settings page (pairing code display)
- **`api/src/services/plugin-client.ts`** — HTTP client for the plugin API (signs requests)
- **`api/src/routes/sites.ts`** — Site connection flow, pairing, capability-tier response
- **`web/src/components/SiteConnector.tsx`** — Pairing UI (show code, wait for connection)
- **`web/src/pages/ConnectSite.tsx`** — Connection page; tiered copy (“I can change text today…”) + concierge host-ticket email when PHP/WP is below the full-playbook matrix

#### Deliverables

- WordPress plugin with pairing and site-info API
- Pairing is 8+ chars, TTL + lockout tested; tokens scoped and HMAC-signed
- `builder` + `capabilities` + `preflight` on site-info
- Content-only tier for WP 5.8–6.0 / PHP 7.4; full playbooks for WP 6.1+ / PHP 8.0+
- Connection flow: user installs plugin → gets code → enters in Wursor → connected
- `plugin/__tests__/test-auth.php` and `test-api.php` passing
- `api/__tests__/services/plugin-client.test.ts` passing
- `web/__tests__/SiteConnector.test.tsx` passing

---

### Sprint 3: Agent orchestrator + playbook runner

**Goal:** User types a request, the agent orchestrator routes it to a playbook, and the playbook executes in the sandbox.

#### TDD sequence

**Step 1 — Write the tests**

```typescript
// api/__tests__/agents/llm-client.test.ts
describe('LlmClient', () => {
  it('sends a message and returns a response via the Grok adapter', async () => {
    const client = new LlmClient({ provider: 'grok', apiKey: 'test-key' });
    const response = await client.send('Change the homepage heading to "Hello"');
    expect(response.type).toBe('tool_call');
  });

  it('switches provider with an env/config change, not a rewrite', async () => {
    const client = new LlmClient({ provider: 'fallback', apiKey: 'test-key' });
    expect(client.provider).toBe('fallback');
  });

  it('handles API errors with a clear message', async () => {
    const client = new LlmClient({ provider: 'grok', apiKey: 'invalid-key' });
    await expect(client.send('hello')).rejects.toThrow('API error');
  });

  it('handles rate limiting with retry', async () => { /* ... */ });
});

// api/__tests__/agents/prompt-builder.test.ts
describe('PromptBuilder', () => {
  it('builds a system prompt with site context', async () => {
    const builder = new PromptBuilder();
    const prompt = await builder.build({
      siteInfo: { theme: 'twentytwentyfour', plugins: ['woocommerce'] },
      userGoal: 'Change the homepage',
    });
    expect(prompt).toContain('twentytwentyfour');
    expect(prompt).toContain('woocommerce');
    expect(prompt).toContain('never touch the live site');
  });

  it('includes safety rules', async () => {
    const builder = new PromptBuilder();
    const prompt = await builder.build({ siteInfo: {}, userGoal: '' });
    expect(prompt).toContain('sandbox');
    expect(prompt).toContain('approval');
  });
});

// api/__tests__/agents/tool-schemas.test.ts
describe('ToolSchemas', () => {
  it('generates tool schemas for the LLM provider', () => {
    const schemas = generateToolSchemas();
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas[0].name).toBe('wp_cli');
    expect(schemas[0].parameters).toBeDefined();
  });

  it('does not expose eval, config, db DROP, rm, or arbitrary plugin URLs', () => {
    const names = generateToolSchemas().flatMap((s) => [s.name, ...(s.parameters?.enum ?? [])]);
    expect(names.join(' ')).not.toMatch(/wp eval|wp config|DROP TABLE|wp plugin install http/);
  });
});

// api/__tests__/agents/circuit-breaker.test.ts
describe('CircuitBreaker', () => {
  it('stops the agent after two consecutive verify failures', async () => {
    const breaker = new CircuitBreaker({ maxConsecutiveFailures: 2 });
    await breaker.recordFailure();
    await breaker.recordFailure();
    expect(breaker.shouldHalt()).toBe(true);
  });

  it('halts when the per-task token budget is exhausted', async () => {
    const breaker = new CircuitBreaker({ maxToolRounds: 12, maxUsd: 0.5 });
    breaker.recordUsage({ rounds: 12, usd: 0.1 });
    expect(breaker.shouldHalt()).toBe(true);
  });
});

// api/__tests__/services/agent-orchestrator.test.ts
describe('AgentOrchestrator', () => {
  it('routes a content request to the content playbook', async () => {
    const orchestrator = new AgentOrchestrator();
    const playbook = await orchestrator.route('Change the homepage heading to "Hello"');
    expect(playbook.name).toBe('content');
  });

  it('routes a plugin request to the plugin playbook', async () => {
    const orchestrator = new AgentOrchestrator();
    const playbook = await orchestrator.route('Install a contact form plugin');
    expect(playbook.name).toBe('plugin');
  });

  it('streams updates to the frontend via SSE', async () => {
    // Mock SSE connection, verify events are sent
  });
});

// api/__tests__/services/playbook-runner.test.ts
describe('PlaybookRunner', () => {
  it('executes a content playbook and returns the result', async () => {
    const runner = new PlaybookRunner({ sandboxId: 'sb-123' });
    const result = await runner.run('content', {
      type: 'edit_text',
      target: 'homepage',
      changes: { heading: 'Hello World' },
    });
    expect(result.success).toBe(true);
    expect(result.previewUrl).toBe('http://sb-123.wursor.dev');
  });
});
```

```typescript
// web/__tests__/ChatPanel.test.tsx
describe('ChatPanel', () => {
  it('sends a message and displays the agent response', () => { /* ... */ });
  it('shows typing indicator while agent works', () => { /* ... */ });
  it('shows the preview when ready', () => { /* ... */ });
  it('shows error state when agent fails', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`api/src/agents/llm-client.ts`** — Provider-agnostic client; Grok is the default adapter
- **`api/src/agents/grok-adapter.ts`** — Grok messages API, tool use, streaming
- **`api/src/agents/prompt-builder.ts`** — Playbook-sliced system prompt (do not dump the whole site-info blob)
- **`api/src/agents/tool-schemas.ts`** — Allowlisted tools only (R2, R7)
- **`api/src/agents/circuit-breaker.ts`** — Two verify failures or budget cap → halt (R1, R8)
- **`api/src/agents/fallback.ts`** — Per-playbook fallback provider + retry
- **`api/src/services/agent-orchestrator.ts`** — Route requests, dispatch tools, stream results, enforce budget
- **`api/src/services/playbook-runner.ts`** — Execute playbook steps in sandbox; checkpoint after each success
- **`api/src/playbooks/registry.ts`** — Playbook registry
- **`api/src/routes/chat.ts`** — Chat message endpoint, SSE stream
- **`web/src/components/ChatPanel.tsx`** — Chat UI with message list, input, typing indicator
- **`web/src/hooks/useChat.ts`** — SSE connection, message state

#### Deliverables

- Agent orchestrator routing requests to playbooks
- Provider-agnostic LLM client with Grok adapter and per-playbook fallback
- Tool allowlist: no `wp eval`, `wp config`, DROP, `rm`, or `wp plugin install <url>`
- Circuit breaker + per-task token/round budget
- Chat panel streaming agent responses
- All unit tests passing

---

### Sprint 4: Content playbooks

**Goal:** User can change text, images, and page content on their site via chat.

#### TDD sequence

**Step 1 — Write the tests**

```typescript
// api/__tests__/playbooks/content.test.ts
describe('ContentPlaybook', () => {
  it('finds and replaces text on a specific page', async () => {
    const playbook = new ContentPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.editText({
      page: 'homepage',
      target: 'Welcome to our site',
      replacement: 'Welcome to My Business',
    });
    expect(result.success).toBe(true);
    // Verify the text was changed in the sandbox DB
    const pageContent = await playbook.getPageContent('homepage');
    expect(pageContent).toContain('Welcome to My Business');
    expect(pageContent).not.toContain('Welcome to our site');
  });

  it('updates a heading tag', async () => {
    const playbook = new ContentPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.editHeading({
      page: 'homepage',
      headingIndex: 0,
      newText: 'New Heading',
    });
    expect(result.success).toBe(true);
  });

  it('replaces an image', async () => {
    const playbook = new ContentPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.replaceImage({
      page: 'about',
      imageSelector: '.hero-image',
      imageUrl: 'https://example.com/new-image.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('adds a new section to a page', async () => {
    const playbook = new ContentPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.addSection({
      page: 'homepage',
      sectionType: 'cta',
      content: 'Call us today!',
      position: 'after-hero',
    });
    expect(result.success).toBe(true);
  });

  it('rewinds the last checkpoint when a change fails verify, instead of nuking the sandbox', async () => {
    const playbook = new ContentPlaybook({ sandboxId: 'sb-123' });
    await playbook.editText({ page: 'homepage', target: 'Hello', replacement: 'World' });
    const checkpoint = await playbook.lastCheckpoint();
    await playbook.editText({ page: 'homepage', target: 'World', replacement: '<broken' });
    expect(await playbook.verify()).toMatchObject({ ok: false });
    await playbook.rewind();
    expect(await playbook.currentCheckpoint()).toBe(checkpoint);
    expect(await playbook.getPageContent('homepage')).toContain('World');
  });
});
```

**Step 2 — Implement**

- **`api/src/playbooks/content.ts`** — Content playbook with tool calls
  - `editText`: search DB for content → `wp post update` or REST. **No theme PHP edits for copy changes (R1).**
  - `editHeading`: find heading via builder adapter (Gutenberg / Elementor / Classic) → update via REST or that builder's store
  - `replaceImage`: upload new image → replace in content → verify (this is the one case that copies a media file into the sandbox)
  - `addSection`: create new content block via the detected builder adapter → add to page → verify
- Each successful step writes a copy-on-write checkpoint
- Verify (health contract) runs after every step; failure rewinds one checkpoint
- After each change, the playbook triggers a preview refresh

#### Deliverables

- Content playbook: edit text, edit headings, replace images, add sections
- All content playbook tests passing

---

### Sprint 5: Design playbooks

**Goal:** User can change the theme, layout, colors, and fonts of their site via chat.

#### TDD sequence

**Step 1 — Write the tests**

```typescript
// api/__tests__/playbooks/design.test.ts
describe('DesignPlaybook', () => {
  it('changes the active theme', async () => {
    const playbook = new DesignPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.changeTheme('twentytwentyfour');
    expect(result.success).toBe(true);
    // Verify the theme was activated
    const activeTheme = await playbook.getActiveTheme();
    expect(activeTheme).toBe('twentytwentyfour');
  });

  it('changes the site layout (single column → two columns)', async () => {
    const playbook = new DesignPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.changeLayout('two-column');
    expect(result.success).toBe(true);
  });

  it('updates theme colors', async () => {
    const playbook = new DesignPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.updateColors({
      primary: '#ff0000',
      secondary: '#00ff00',
    });
    expect(result.success).toBe(true);
  });

  it('updates typography', async () => {
    const playbook = new DesignPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.updateTypography({
      headingFont: 'Inter',
      bodyFont: 'Open Sans',
    });
    expect(result.success).toBe(true);
  });

  it('fixes a mobile layout issue', async () => {
    const playbook = new DesignPlaybook({ sandboxId: 'sb-123' });
    const result = await playbook.fixMobileLayout({ page: 'homepage' });
    expect(result.success).toBe(true);
  });
});
```

**Step 2 — Implement**

- **`api/src/playbooks/design.ts`** — Design playbook
  - `changeTheme`: install theme via WP-CLI → activate → verify
  - `changeLayout`: modify theme templates **or the detected builder adapter** (Elementor JSON / Gutenberg blocks / Classic HTML) → verify. Editing the wrong store is a failed test (R6, R13).
  - `updateColors`: update theme.json → regenerate CSS → verify
  - `updateTypography`: update theme.json → verify
  - `fixMobileLayout`: identify responsive CSS issues → fix → verify
  - Deploy lints any written PHP against the live site's declared PHP version

#### Deliverables

- Design playbook: change theme, layout, colors, fonts, mobile fix
- All design playbook tests passing

---

### Sprint 6: Deploy + rollback

**Goal:** User approves the change, Wursor deploys to the live site, and can roll back.

#### TDD sequence

**Step 1 — Write the tests**

```typescript
// api/__tests__/deploy/diff-engine.test.ts
describe('DiffEngine', () => {
  it('computes file changes between sandbox and mirror', async () => {
    const engine = new DiffEngine({ sandboxId: 'sb-123', mirrorId: 'mirror-123' });
    const diff = await engine.computeFileDiff();
    expect(diff.changedFiles).toContain('/wp-content/themes/twentytwentyfour/style.css');
    expect(diff.newFiles).toHaveLength(0);
  });

  it('computes database changes', async () => {
    const engine = new DiffEngine({ sandboxId: 'sb-123', mirrorId: 'mirror-123' });
    const diff = await engine.computeDbDiff();
    expect(diff.changedTables).toContain('wp_options');
    expect(diff.changedRows).toBeGreaterThan(0);
  });

  it('computes plugin changes', async () => {
    const engine = new DiffEngine({ sandboxId: 'sb-123', mirrorId: 'mirror-123' });
    const diff = await engine.computePluginDiff();
    expect(diff.installed).toContain('contact-form-7');
  });
});

// api/__tests__/deploy/pusher.test.ts
describe('Pusher', () => {
  it('pushes file changes to the live site', async () => {
    const pusher = new Pusher({ siteUrl: 'https://example.com', token: 'valid-token' });
    const result = await pusher.pushFiles([
      { path: '/wp-content/themes/twentytwentyfour/style.css', content: '...' },
    ]);
    expect(result.success).toBe(true);
  });

  it('pushes database changes', async () => {
    const pusher = new Pusher({ siteUrl: 'https://example.com', token: 'valid-token' });
    const result = await pusher.pushDb([
      { table: 'wp_options', operation: 'UPDATE', where: { option_name: 'blogname' }, data: { option_value: 'My Site' } },
    ]);
    expect(result.success).toBe(true);
  });

  it('pushes plugin installs', async () => {
    const pusher = new Pusher({ siteUrl: 'https://example.com', token: 'valid-token' });
    const result = await pusher.pushPluginInstall('contact-form-7');
    expect(result.success).toBe(true);
  });

  it('prepare-fails without touching the live site', async () => {
    const pusher = new Pusher({ siteUrl: 'https://example.com', token: 'valid-token' });
    pusher.failNextPrepare();
    const result = await pusher.push({ files: [{ path: '/wp-content/themes/twentytwentyfour/style.css', content: '...' }] });
    expect(result.success).toBe(false);
    expect(result.liveTouched).toBe(false);
  });

  it('rolls back the journal when commit is partial', async () => {
    const pusher = new Pusher({ siteUrl: 'https://example.com', token: 'valid-token' });
    pusher.failOnJournalEntry(2);
    const result = await pusher.push({
      files: [
        { path: '/wp-content/themes/twentytwentyfour/style.css', content: 'a' },
        { path: '/wp-content/themes/twentytwentyfour/theme.json', content: 'b' },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(await pusher.liveFile('/wp-content/themes/twentytwentyfour/style.css')).not.toBe('a');
  });
});

// api/__tests__/deploy/verifier.test.ts
describe('Verifier', () => {
  it('checks the home page returns 200', async () => {
    const verifier = new Verifier({ siteUrl: 'https://example.com' });
    const result = await verifier.checkHomePage();
    expect(result.status).toBe(200);
  });

  it('checks for PHP errors', async () => {
    const verifier = new Verifier({ siteUrl: 'https://example.com' });
    const result = await verifier.checkPhpErrors();
    expect(result.hasErrors).toBe(false);
  });

  it('checks the admin dashboard loads', async () => {
    const verifier = new Verifier({ siteUrl: 'https://example.com' });
    const result = await verifier.checkAdmin();
    expect(result.status).toBe(200);
  });

  it('fails when siteurl/home drifted from intent', async () => {
    const verifier = new Verifier({ siteUrl: 'https://example.com', intent: { home: 'https://example.com' } });
    await verifier.injectOption('home', 'https://evil.example');
    const result = await verifier.checkIntent();
    expect(result.ok).toBe(false);
  });

  it('fails a 200 homepage whose screenshot diverges from the sandbox', async () => {
    const verifier = new Verifier({ siteUrl: 'https://example.com', sandboxUrl: 'http://sb-123.wursor.dev' });
    const result = await verifier.checkScreenshotSsim();
    expect(result.ssim).toBeGreaterThan(0.9);
  });
});

// api/__tests__/deploy/drift.test.ts
describe('Drift', () => {
  it('asks before deploy when the live site changed since the preview', async () => {
    const drift = new DriftChecker({ siteUrl: 'https://example.com', token: 'valid-token' });
    const verdict = await drift.compare(changesetTakenAtPreview);
    expect(verdict.drifted).toBe(true);
    expect(verdict.action).toBe('confirm');
  });
});

// api/__tests__/deploy/no-surprise.test.ts
describe('NoSurprise', () => {
  it('blocks slug, blog_public, payment, and role changes without an explicit confirm bullet', async () => {
    const gate = new NoSurpriseGate();
    const blocked = gate.review({ changedOptions: ['permalink_structure'], confirmed: [] });
    expect(blocked.ok).toBe(false);
    expect(blocked.bullets).toContain('permalink_structure');
  });
});

// api/__tests__/deploy/rollback.test.ts
describe('Rollback', () => {
  it('restores files from the snapshot', async () => {
    const rollback = new Rollback({ siteUrl: 'https://example.com', token: 'valid-token' });
    const result = await rollback.restoreFiles('deploy-123');
    expect(result.success).toBe(true);
  });

  it('restores the database from the snapshot', async () => {
    const rollback = new Rollback({ siteUrl: 'https://example.com', token: 'valid-token' });
    const result = await rollback.restoreDb('deploy-123');
    expect(result.success).toBe(true);
  });
});

// plugin/__tests__/test-deploy.php
class WursorDeployTest extends WP_UnitTestCase {
    public function test_receives_file_change() {
        $deploy = new Wursor_Deploy();
        $result = $deploy->apply_file_change('/wp-content/themes/twentytwentyfour/style.css', 'body { color: red; }');
        $this->assertTrue($result);
        $this->assertEquals('body { color: red; }', file_get_contents(WP_CONTENT_DIR . '/themes/twentytwentyfour/style.css'));
    }

    public function test_receives_db_change() {
        $deploy = new Wursor_Deploy();
        $result = $deploy->apply_db_change('UPDATE wp_options SET option_value = "New Title" WHERE option_name = "blogname"');
        $this->assertTrue($result);
        $this->assertEquals('New Title', get_option('blogname'));
    }

    public function test_creates_snapshot_for_rollback() {
        $deploy = new Wursor_Deploy();
        $snapshot = $deploy->create_snapshot();
        $this->assertArrayHasKey('files', $snapshot);
        $this->assertArrayHasKey('db', $snapshot);
    }

    public function test_restores_from_snapshot() {
        $deploy = new Wursor_Deploy();
        $snapshot = $deploy->create_snapshot();
        // Make a change
        update_option('blogname', 'Changed Title');
        // Restore
        $deploy->restore_snapshot($snapshot);
        $this->assertEquals('Original Title', get_option('blogname'));
    }
}
```

```typescript
// web/__tests__/ApproveBar.test.tsx
describe('ApproveBar', () => {
  it('shows "Looks good → Apply" and "Not right → Reject" buttons', () => { /* ... */ });
  it('shows a confirmation dialog before apply', () => { /* ... */ });
  it('shows success state after deploy', () => { /* ... */ });
  it('shows the deploy history timeline', () => { /* ... */ });
  it('allows one-click undo on a deploy', () => { /* ... */ });
});
```

**Step 2 — Implement**

- **`plugin/src/class-deploy.php`** — Two-phase prepare/commit, journaled file/DB/WP-CLI, maintenance mode for the commit window
- **`plugin/src/class-rollback.php`** — Journal walk-back + snapshot restore
- **`api/src/deploy/diff-engine.ts`** — Compare sandbox → live site
- **`api/src/deploy/pusher.ts`** — Prepare then commit; never leave a partial live site
- **`api/src/deploy/verifier.ts`** — Health contract on sandbox *and* live (R1, R3)
- **`api/src/deploy/drift.ts`** — Re-hash live site at approve time (R11)
- **`api/src/deploy/no-surprise.ts`** — Block slug / `blog_public` / payment / role without confirm (R12)
- **`api/src/deploy/rollback.ts`** — Journal + last-3 cloud snapshots (Undo works if the site is down)
- **`api/src/routes/deploy.ts`** — Approve, deploy, rollback; first-N-deploys “watched” path (R14)
- **`web/src/components/ApproveBar.tsx`** — Approve/reject, confirmation, no-surprise bullets, drift prompt
- **`web/src/components/DeployTimeline.tsx`** — Deploy history with one-click undo
- **`web/src/hooks/useDeploy.ts`** — Deploy state, polling

#### Deliverables

- Two-phase deploy + journaled rollback for files, DB, and plugins
- Cloud copies of the last 3 snapshots
- Drift check and no-surprise gate on approve
- Health contract richer than HTTP 200
- Approve/reject UI with confirmation dialog
- Deploy history timeline with one-click undo
- `handles partial failures` is a real test, not a comment
- All unit tests passing

---

### Sprint 7: Integration + exit criteria

**Goal:** All Phase 1 pieces work together. Exit criteria test passes end-to-end.

#### Integration test

```typescript
// e2e/phase1-exit-criteria.test.ts
import { test, expect } from '@playwright/test';

test('new user connects site, makes a content change, previews, approves in ≤5 min', async ({ page }) => {
  const startTime = Date.now();

  // 1. Sign up
  await page.goto('http://localhost:3000');
  await page.locator('.wursor-signup-button').click();
  await page.locator('input[name=email]').fill('test@example.com');
  await page.locator('input[name=password]').fill('password123');
  await page.locator('.wursor-submit').click();

  // 2. Connect site (simulated plugin)
  await expect(page.locator('.wursor-connect-site')).toBeVisible();
  await page.locator('.wursor-pairing-code-input').fill('ABCD1234');
  await page.locator('.wursor-connect-button').click();
  await expect(page.locator('.wursor-connected')).toBeVisible({ timeout: 10000 });

  // 3. Make a change
  await page.locator('.wursor-chat-input').fill('Change the homepage heading to "Welcome to My Business"');
  await page.locator('.wursor-chat-send').click();

  // 4. See preview
  await expect(page.locator('.wursor-preview-frame')).toBeVisible({ timeout: 60000 });

  // 5. Approve
  await page.locator('.wursor-approve-button').click();
  await page.locator('.wursor-confirm-apply').click();
  await expect(page.locator('.wursor-deploy-success')).toBeVisible({ timeout: 30000 });

  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeLessThan(5 * 60 * 1000);
});
```

#### Deliverables

- Exit criteria test passing
- All unit tests passing (`pnpm test`)
- All integration tests passing (`pnpm test:integration`)

---

### Sprint 8: Polish + alpha readiness

**Goal:** Error states handled, app ready for internal alpha.

#### Tasks

- **Error states** — Wire each state from §8.5 into the UI
- **Intent chips (R5)** — Empty state: “Change wording” / “New look” / “Add a form” / “Something’s broken”
- **Site-aware starters (R5)** — After connect, offer three specific sentences from the site scan (default H1, missing favicon, no contact page)
- **Structured reject (R5)** — Chips: “Wrong color” / “Too busy” / “Keep my logo” / “Undo only the last thing”
- **Point-and-talk spike** — Click in the preview → selector attached to the next chat turn
- **Mobile responsive** — Chat collapses to full-screen on mobile, preview opens in new tab
- **Email auth** — Magic link or password reset flow
- **Plugin auto-update** — Plugin checks for updates from Wursor
- **Telemetry** — Minimal events (sign-up, connect, task start, task approve, task reject, deploy) with consent dialog
- **Watched first deploys (R14)** — First N deploys of a new account use the stricter health contract
- **Documentation** — `README.md` with install instructions and quickstart
- **Bug bash** — Internal team runs through the full flow on a sacrificial WordPress site before any stranger’s

#### Deliverables

- Web app deployed to staging
- Plugin packaged for WordPress plugin repo
- Error states all wired
- Intent chips, starters, and structured reject live
- Minimal telemetry with consent
- `README.md` updated for alpha users

---

## 6. Phase 2 — Intelligence (Weeks 9–16)

| Sprint | Focus | Files |
|--------|-------|-------|
| 9 | Plugin playbook (catalog only, reputation gate, egress watch, configure, fix conflicts) | `api/src/playbooks/plugin.ts`, `api/src/playbooks/catalog.ts` |
| 10 | Site build playbook (from scratch, limited) | `api/src/playbooks/site-build.ts` |
| 11 | Mobile-responsive preview | `web/src/components/Preview.tsx` |
| 12 | Agent clarifying questions | `api/src/services/agent-orchestrator.ts` |
| 13 | Visual design picker (theme gallery); pull fork-and-pick forward if Sprint 8 reject rate is high | `api/src/playbooks/design.ts`, `web/src/components/DesignPicker.tsx` |
| 14 | Multi-step workflows (queue changes) | `api/src/services/playbook-runner.ts` |
| 15 | Closed alpha with 10–20 users — must include ≥1 Elementor site and ≥1 managed host (R13). Standby replica spike if mirror p95 missed the 5-min exit. | Telemetry review, baselines |
| 16 | Alpha feedback → Phase 2 exit review | All §11 baselines collected |

Sprint 9 acceptance (R2): agent can install only from the ~40-slug catalog; reputation gate fails closed; unexpected sandbox egress aborts the install; deploy re-checks reputation even after approve. `wp plugin install <url>` remains absent from the tool schema.

---

## 7. TDD Rules

1. **Write the test first.** No implementation code is written without a failing test.
2. **One assertion per test.** Each test verifies exactly one behavior.
3. **Tests are deterministic.** No network calls in unit tests (mock Grok API, mock plugin, mock Docker).
4. **Integration tests use real sandboxes in CI.** Pre-baked WordPress image in Docker on GitHub Actions.
5. **Red → Green → Refactor.** Write the failing test (red), make it pass (green), then clean up (refactor).
6. **Coverage floor.** TypeScript: vitest enforces ≥ 90%. PHP: phpunit with coverage ≥ 80%.
7. **No skipped tests in main.** `test.skip` and `test.only` only in feature branches.

---

## 8. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml — runs on every PR
name: CI
on: [pull_request]
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:api
      - run: pnpm test:api:coverage

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:web
      - run: pnpm test:web:coverage

  plugin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: composer install
      - run: ./vendor/bin/phpunit plugin/__tests__/
      - run: ./vendor/bin/phpunit --coverage-text

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install && pnpm lint

# .github/workflows/e2e.yml — runs on release branch
name: E2E
on:
  push:
    branches: [release/*]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:20.10
        options: --privileged
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
```

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **Sandbox** | An ephemeral, isolated copy of the user's WordPress site running in Wursor's cloud |
| **Playbook** | A structured, multi-step agent workflow for a specific task type |
| **Plugin connector** | The WordPress plugin that connects the user's site to Wursor |
| **Mirror** | The process of copying a site's theme, plugins, content, and settings into a sandbox |
| **Deploy** | The process of applying sandbox changes to the live site |
| **Warm pool** | Paused WordPress images plus a small number of hot spares, ready to accept a task-scoped mirror |
| **Media proxy** | Sandbox nginx rewrite of `/wp-content/uploads/*` to the live origin |
| **Capability tier** | content-safe / design-safe / install-safe, computed at connect |
| **Changeset journal** | Numbered deploy operations; rollback walks them backwards |
| **No-surprise gate** | Blocks slug / visibility / payment / role deploys without an explicit confirm |
| **SSE** | Server-Sent Events — the protocol used to stream agent responses to the frontend |

---

*End of Implementation Guide v2.0 — Wursor*