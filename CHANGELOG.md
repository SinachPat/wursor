# Changelog

All notable changes to this project are documented here. This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The project is pre-1.0. Versions below `1.0.0` are internal milestones, not public releases.

## [Unreleased]

### Added

- **Monorepo workspace** — `pnpm` workspace (`api`, `web`, `e2e`), root `package.json` / `pnpm-workspace.yaml` / `tsconfig.base.json`, and a PHP `plugin` package (`composer.json`). Empty packages by design (see [ADR 8](docs/decisions/0008-empty-packages-not-stubs.md)).
- **Phase 0 spike records** under `spikes/`:
  - `pairing-threat-model.md` — pairing protocol: 8+ char code, 5-min TTL, 5-attempt lockout, HMAC, scoped `read`/`deploy` tokens, threat table T1–T10.
  - `plugin-catalog.md` — 40-slug install allowlist + detect-only list; no `wp plugin install <url>`.
  - `builder-detect.md` — builder detection rules + plugin `site-info` API sketch.
  - `mirror-timing.md` — synthetic 2GB mirror/proxy timing result.
  - `golden-task.md` — golden harness status (live Grok pending key).
  - `phase-0-harness.md` — batch writeup with open questions.
- **Golden-task harness** under `e2e/golden/` — 20 prompts × 2 site fixtures (`gutenberg-business`, `elementor-restaurant`), apply-then-assert scorer, offline runner, live Grok client, and 21 passing Vitest tests.
- **Builder detection** — `detectBuilder()` (elementor / beaver / divi / gutenberg / classic) from theme + plugin slugs + post meta + content.
- **Subset + media proxy** — `exportDbSubset()` (content tables only, secret redaction) and `mediaProxyTarget()` / `stageReplacement()` (origin proxy, copy-on-replace).
- **Mirror timing runner** — `run-mirror-timing.ts` with a real 2GB `dd` baseline; result: slice p50/p95 ≈ 0.003/0.010 ms, 0 upload bytes copied.
- **Documentation** — ADR set under `docs/decisions/` (0001–0009), this changelog, and `.env.example`.

### Changed

- **Repository identity** — renamed from `originmain` to `wursor`; description set to the product tagline; stale homepage cleared; topics `wordpress`, `ai`, `agent` added (see [ADR 9](docs/decisions/0009-repo-rename.md)).
- **PRD / IMPLEMENTATION** — expanded risk register (R1–R14 with mitigations and sprint ownership), media-proxy and capability-tier decisions locked, pairing and warm-pool details corrected.
- **README / AGENTS.md** — repo layout and Phase 0 gate documented; status updated to reflect the workspace existing while product code remains gated.
- **`.gitignore`** — added coverage/report/build artifacts and the large-export fixture path.

### Removed

- Nothing removed from the current product; the prior `originmain` codebase was removed earlier in `702ce4e`.

### Security

- Pairing threat model and plugin install allowlist formalize the two highest-risk boundaries (live-site backdoor, arbitrary plugin install). See [ADR 3](docs/decisions/0003-pairing-code-direction.md) and [ADR 4](docs/decisions/0004-plugin-install-allowlist.md).

## [0.1.0] - 2026-08-15

First tracked Wursor artifact set.

### Added

- pstack-style engineering rigor skill family (`.agents/skills/`) and `AGENTS.md` routing (`0dae13c`).
- Wursor v2.0 PRD and IMPLEMENTATION guide — non-technical-first pivot (`dfb3c93`).

## [0.0.0] - 2026-08-13

### Added

- Initial Wursor PRD after removing the prior Originmain codebase (`702ce4e`).
