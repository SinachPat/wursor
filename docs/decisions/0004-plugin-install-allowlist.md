# 4. Plugin install is a 40-slug allowlist, fail-closed

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

wordpress.org is not a reviewed-safe catalog. A malicious plugin looks fine in preview and only phones home after deploy. The agent will eventually install plugins, but must not be able to in the MVP either (R2).

## Decision

The agent may install only from a written ~40-slug allowlist (`spikes/plugin-catalog.md`), and only via `wp plugin install <slug>`. No URLs, no zips, no premium marketplaces. Unknown slug → refuse. A detect-only list (Wordfence, Jetpack, cache suites) is never installed.

### Options considered

- Open wordpress.org search.
- Written allowlist now; reputation/egress gate later (Sprint 9).
- No wall until the install playbook exists.

### Rejected

- Open search — reintroduces R2.
- No wall until later — the MVP agent could still `wp plugin install <url>` unless the tool schema forbids it from day one.

## Consequences

- Sprint 3 `tool-schemas.ts` must forbid `wp plugin install http` and unknown slugs even though no install playbook ships in MVP.
- Reputation gate, zip SHA, and egress watch on first activate are Sprint 9 scope, already specced.
- Catalog changes are PRs, not prompt edits.
