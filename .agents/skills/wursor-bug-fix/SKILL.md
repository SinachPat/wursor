---
name: wursor-bug-fix
description: "Reproduce a defect, root-cause it, and fix it with runtime evidence. Follow the repro-first discipline: never patch a symptom without proving the cause. For bugs in api/, web/, plugin/, infrastructure/, and e2e/. Adapted from pstack's bug-fix playbook."
---

# Wursor Bug Fix

Reproduce a defect, root-cause it, fix it, and prove the fix with runtime evidence.

## When to use

Use this skill when:
- The user reports a symptom: "X is slow", "X crashes", "X returns the wrong value"
- A test fails and the failure is unexplained
- A behavior regressed
- A task involves fixing a defect rather than adding a feature

## Playbook

### Step 1 — Reproduce it first

Do not touch code until the defect is reproduced with a reliable, minimal repro.

- If there's a failing test, run it and confirm it fails for the stated reason
- If there's no test, write the smallest test or script that reproduces the symptom
- Capture the actual behavior: error message, stack trace, wrong value, timing
- The repro must be repeatable. "Sometimes it breaks" is not a repro; narrow it until it's deterministic

### Step 2 — Root-cause it

Trace the symptom back to its cause. Ask "why" repeatedly:

1. Why does this output appear? → Because module A does X
2. Why does A do X? → Because B passed it the wrong input
3. Why did B pass the wrong input? → Because the schema validation at the boundary is missing

Stop when the answer is a genuine defect, not another symptom. A root cause is a place where the code violates its own contract, not a place that "needs a guard."

### Step 3 — State the root cause

Write it down before fixing. "The sandbox GC destroys a container while the deploy verifier is still polling it, because the verifier checks status once and the GC doesn't check the verifier's lease."

### Step 4 — Fix the root cause

Apply the smallest change that fixes the cause at the point where it happens. Follow the principles:

- **Fix root causes** — no nil-check that silences a crash
- **Laziness protocol** — the smallest correct change
- **Boundary discipline** — the guard belongs at the boundary, not in every consumer

### Step 5 — Prove the fix

- The repro from step 1 must now pass (the test, the script, the manual case)
- Run the surrounding test suite
- If the bug was a regression, add the repro as a permanent test so it cannot return silently

### Step 6 — Report

```
## Root cause
[file.ts:42] — the verifier polls status without a lease; GC does not respect it
## Fix
[file.ts:52] — verifier now holds a short lease; GC skips leased containers
## Proof
- repro test added at [bug.test.ts] — passes before fix, fails after revert
- pnpm test:api — 412 passed, 0 failed
```