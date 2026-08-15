# Architecture Decision Records

Wursor records significant technical and product decisions as ADRs. This directory is the source of truth; PRD §14 holds the product-level "locked decisions", while these records capture the engineering choices and tradeoffs behind them.

Each ADR is a single file following the [Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): **Status**, **Context**, **Decision**, **Consequences**. "Options considered" and "Rejected" are kept explicit to honor the `wursor-decision-log` skill.

## Status legend

- **Accepted** — agreed; in force.
- **Proposed** — under discussion, not yet binding.
- **Superseded** — replaced by a later ADR; see the link.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-mvp-scope-content-loop-first.md) | MVP is the content-change loop, not the full P0 feature list | Accepted |
| [0002](0002-phase-zero-spikes-gate.md) | Phase 0 spikes gate the scaffold | Accepted |
| [0003](0003-pairing-code-direction.md) | Wursor generates the pairing code, not the plugin | Accepted |
| [0004](0004-plugin-install-allowlist.md) | Plugin install is a 40-slug allowlist, fail-closed | Accepted |
| [0005](0005-golden-harness-fixtures.md) | Golden harness scores slot-fill tool calls against JSON fixtures | Accepted |
| [0006](0006-builder-detection.md) | Builder detection uses slugs + post meta with a priority order | Accepted |
| [0007](0007-media-proxy-not-copy.md) | Sandboxes proxy uploads; never copy the media library | Accepted |
| [0008](0008-empty-packages-not-stubs.md) | Workspace ships empty packages, not placeholder source | Accepted |
| [0009](0009-repo-rename.md) | Repository renamed originmain → wursor | Accepted |

## How to add one

1. Copy the previous number + 1.
2. Write Status / Context / Decision (with options + rejected) / Consequences.
3. Add a row to this index.
