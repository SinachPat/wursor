---
name: wursor-feature
description: "Build new or changed behavior in the Wursor repo, from a named data shape, TDD-first, with a defined verification path. Includes a refactoring mode for behavior-preserving structural change. Adapted from pstack's feature playbook."
---

# Wursor Feature

Build a new feature, or change behavior, with the rigor of a named data shape, a failing test first, and a defined verification path.

## When to use

Use this skill when:
- The task is "add X", "build Y", "change Z"
- A user story describes new behavior
- A refactoring preserves behavior while changing structure

Do **not** use this for: one-line changes, copy edits, or bugs (use `wursor-bug-fix`).

## Playbook

### Step 1 — Name the data shape

Before any code, define what the feature operates on. The core types, in concrete form:

- What is the input? (request, event, message)
- What is the output? (response, deployed state, preview URL)
- What states does it pass through? (enumerate them)
- What can go wrong? (enumerate the errors)

Write these as types or interfaces where the language supports it. For `api/` this usually means a TypeScript type or a Zod schema at the boundary. For `plugin/` a class or array-shaped response.

### Step 2 — Write the failing test

Following `wursor-tdd`:

- One test per behavior, one assertion per test
- The test must fail before implementation
- Mocks at boundaries: Grok API, plugin API, Docker, filesystem

### Step 3 — Implement

Write the minimum code to pass the test(s). Follow the principles:

- Foundational thinking — the types from step 1 drive the implementation
- Make operations idempotent — the feature must be retry-safe
- Boundary discipline — parse and validate external input at the boundary

### Step 4 — Verify

- The new tests pass
- The broader suite passes (`pnpm test:api`, `pnpm test:web`, or `phpunit` as appropriate)
- For UI features: the component renders in the browser/E2E test, not just "compiles"

### Step 5 — Report

```
## What changed
- new module [x.ts] — does the specific thing, shaped by type T
## Data shape
- input: ..., output: ..., states: [...], errors: [...]
## Verification
- [feature.test.ts] — 4 tests, all pass
- full suite — green
## Follow-ups
- schema migration needed in [y.ts] when playbook runner lands
```