# 8. Workspace ships empty packages, not placeholder source

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

The repo had only documentation. A buildable monorepo was needed before code could land, but Phase 0 was not done. The `wursor-principles` skill says "subtract before you add" and "delete the placeholder rather than working around it."

## Decision

Create the pnpm workspace (`api`, `web`, `e2e`, plus `plugin` composer + `infrastructure` dirs) with real manifests and tsconfigs but **no application source** — only `.gitkeep` markers and the Phase 0 spike/runner code that has tests.

### Options considered

- Empty packages.
- Stub every file from the IMPLEMENTATION.md tree.

### Rejected

- Stubs — `// TODO` files are placeholders we would have to delete; they also look like progress without being testable.

## Consequences

- `pnpm install` / `pnpm test:e2e` are green and prove the workspace is real.
- Product code remains gated on Phase 0 (ADR 2).
