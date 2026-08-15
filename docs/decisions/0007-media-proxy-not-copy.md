# 7. Sandboxes proxy uploads; never copy the media library

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

The MVP must preview a change in under five minutes. A WooCommerce store with years of posts and a 2GB media library cannot be copied in time — warm pool hides boot, not copy (R4). A full mirror also copies customer PII and secrets (R10).

## Decision

Task-scoped DB subset (content tables only, drop orders/comments/transients, redact `*_key`/`*_secret`/`smtp_pass`) plus an origin proxy for `/wp-content/uploads/*`. A file is copied into the sandbox only when the agent replaces it. Full-library copy is not a v1 path, even for 20GB+ sites.

### Options considered

- Full mirror + lazy media sync.
- Proxy uploads, subset content tables.

### Rejected

- Full mirror — the synthetic 2GB timing shows subset+proxy is ~0.01ms vs 2.4s+ to copy the blob locally (worse over a network); and it drags PII into a container with outbound internet.

## Consequences

- `subset.ts` and `media-proxy.ts` implement the decision and are unit-tested; `run-mirror-timing.ts` records the p50/p95 evidence.
- A real-host pull of the content slice is the unproven part; if it exceeds 60s, shrink the slice further — do not start copying uploads.
