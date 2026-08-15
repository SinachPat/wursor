# Wursor — Agent Guide

This repository is **Wursor**, the agentic WordPress management platform. Before starting any non-trivial task, read this file and follow the skill routing below.

## The product, in one line

Non-technical WordPress site owners describe what they want; Wursor makes it happen in a cloud sandbox, shows a live preview, and deploys on approval. The interface is chat → preview → approve. Nothing else.

## Repo layout

```
api/               Node.js + TypeScript API server (empty until Phase 0 gate)
web/               React + TypeScript frontend (empty until Phase 0 gate)
plugin/            WordPress plugin (PHP) — empty until Phase 0 gate
infrastructure/    Docker images, warm pool, GC, deploy scripts
e2e/               Playwright + e2e/golden/ harness
spikes/            Phase 0 written results — gate before product code
docs/decisions/    Architecture Decision Records (0001–…)
PRD.md             Product requirements (v2.0 — non-technical-first)
IMPLEMENTATION.md  TDD build guide with 8-sprint Phase 1 plan
CHANGELOG.md       Keep-a-Changelog log of changes
```

## Skill routing — use the precheck first

The `.agents/skills/` directory is a family of rigor skills modeled on Cursor's pstack. **The entry point for any non-trivial task is `wursor-precheck`** — it routes to the right playbook and sets the verification bar.

| Task shape | Skill |
|---|---|
| Any non-trivial task — start here | `wursor-precheck` |
| How does X work / why was Y built this way | `wursor-investigation` |
| A defect — reproduce, root-cause, fix | `wursor-bug-fix` |
| New behavior, TDD-first from a data shape | `wursor-feature` |
| Review a diff / PR across lenses | `wursor-review` |
| Any code change with a test path | `wursor-tdd` |
| Capture a reviewable decision trail | `wursor-decision-log` |
| Structure, tradeoffs, verification standards | `wursor-principles` |

## Hard rules

1. **Tests first.** No implementation without a failing test (see `wursor-tdd`). Coverage floors: api/ + web/ ≥ 90%, plugin/ ≥ 80%.
2. **Prove it works.** A task is not done on self-report — run the test, start the sandbox, hit the endpoint.
3. **Non-technical-first.** The user never sees a diff, a terminal, a settings screen, or an error log. If a change would leak engineer-only UI into the product, it's wrong.
4. **Safety.** Never touch a live WordPress site, production credentials, or real user data from this repo. Sandboxes are the only environment code runs against.
5. **Decisions are logged.** Non-trivial choices get a decision-log entry (see `wursor-decision-log`).

## Stack notes

- Backend: Node.js + TypeScript, Express/Fastify, PostgreSQL (Wursor data), Redis (SSE/queue)
- Frontend: React + TypeScript, Vite
- Sandboxes: Docker on VPS, pre-baked WordPress image, overlayfs layers, media proxied (not copied)
- Plugin: standard WordPress PHP plugin, REST API + token auth
- Tests: vitest (api, web), phpunit (plugin), Playwright (e2e)
