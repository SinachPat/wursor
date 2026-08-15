# 1. MVP is the content-change loop, not the full P0 feature list

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

PRD §7.1 lists plugin-install and site-build playbooks as P0 ("launch-blocking"), but IMPLEMENTATION.md schedules them into Phase 2 (Sprints 9–10). The two documents disagreed on what "P0" meant.

## Decision

The MVP is the Phase 1 exit criterion only: a new user signs up, pairs a WordPress site, types "change the homepage heading", sees the change in a sandbox preview, and approves — in under five minutes.

Plugin-install, site-build, design picker, and multi-step workflows are explicitly deferred to Phase 2.

### Options considered

- Ship the full PRD P0 (plugin install + site build in the first release).
- Thin vertical slice even smaller than Phase 1 (fixture-only, deploy stubbed).
- **Chosen:** Phase 1 exit only.

### Rejected

- Full P0 — a plugin-install playbook requires the catalog, reputation gate, and egress watch (ADR 4) that are not built; shipping them prematurely reintroduces R2.
- Thinner slice — deploy/rollback is the product's trust guarantee (R3); stubbing it hides the one thing that can break a live site.

## Consequences

- Clear, single exit test: `e2e/phase1-exit-criteria.test.ts`.
- PRD §7.1 will be annotated to move plugin/site-build out of P0 (doc-sync follow-up).
- Fewer parallel workstreams; content + deploy are the critical path.
