# 2. Phase 0 spikes gate the scaffold

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

IMPLEMENTATION.md says "Do not start the web-app scaffold until the four boxes have a written result." The four spikes were golden-task harness, builder detection, pairing threat model, and large-site mirror timing — plus a plugin catalog.

## Decision

Treat the spikes as a hard gate. Product code (`web/` chat, playbooks, deploy) does not start until each spike has a written, verifiable result in the repo. Fixtures and throwaway scripts are allowed during the gate.

### Options considered

- Honor the gate.
- Spike in parallel with Sprint 1.
- Skip spikes and start the scaffold.

### Rejected

- Parallel — spike results change the architecture (e.g. mirror slice, pairing direction); building Sprint 1 against unverified assumptions means rework.
- Skip — the spikes exist precisely because an unvalidated assumption can kill the 5-minute exit or the live-site safety guarantee.

## Consequences

- Phase 0 exit is reviewable: five written spike notes, three with executable proofs.
- The scaffold exists only as empty packages (ADR 8), not product code.
- The remaining gate item is a live Grok score (see `spikes/golden-task.md`).
