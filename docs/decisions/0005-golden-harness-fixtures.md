# 5. Golden harness scores slot-fill tool calls against JSON fixtures

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

R7: can we score a model on WordPress tasks without vibes? A live WordPress sandbox was not available on the development machine (no Docker), and a live Grok key was not set. The harness still had to exist and produce a scoreable path.

## Decision

Twenty prompts across two JSON site fixtures (`gutenberg-business`, `elementor-restaurant`). Each prompt has a hard assertion (`preview_text`, `option`, or `screenshot`). A tool call is applied to the fixture and the assertion is checked. `run-golden.ts` scores the 20 expected traces offline and, when `XAI_API_KEY` is set, sends `gb-01` to `api.x.ai`.

### Options considered

- Docker WordPress fixtures + Playwright.
- JSON fixtures + slot-fill apply-then-assert.
- Defer the harness until Docker exists.

### Rejected

- Docker now — unavailable in this environment; blocks progress for a reason that does not change the assertion design.
- Defer — ships nothing; the assertion types and prompt file survive the swap to a real runner.

## Consequences

- WordPress work is modeled as slot-fill (`page`, `old`, `new`) + a deterministic write, which is how playbooks will actually execute.
- `applyTool` is the seam that gets replaced by a REST / `wp post update` runner when sandboxes exist.
- Unit tests stay offline (TDD rule: no network in unit tests). A live Grok score is the outstanding gate item.
