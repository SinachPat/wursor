# 9. Repository renamed originmain → wursor

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

The GitHub repo was still named `originmain` — a prior product whose code was deleted in commit `702ce4e` — with a stale description and a homepage pointing at `originmain.vercel.app`. The repo now builds Wursor.

## Decision

Rename the repository to `wursor`, set the description to the product tagline, clear the stale homepage, and add topics `wordpress`, `ai`, `agent`.

### Options considered

- Rename in place.
- Create a new repo and migrate.

### Rejected

- New repo — loses history and the continuity of the pivot commits (`702ce4e` → `dfb3c93` → `0dae13c`).

## Consequences

- Remote is `https://github.com/SinachPat/wursor`; identity matches the product.
- Redirects from the old name are handled by GitHub automatically.
