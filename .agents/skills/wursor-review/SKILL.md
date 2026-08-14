---
name: wursor-review
description: "Review a diff or pull request in the Wursor repo across multiple lenses: correctness, security, domain modeling, type discipline, and the non-technical-first product bar. Adapted from pstack's /interrogate and the code-quality lens."
---

# Wursor Review

Review a diff or PR across several lenses. The point is to break it, not to bless it.

## When to use

Use this skill when:
- The user asks to "review this PR" or "review this diff"
- A change is about to be committed and deserves a second pass
- A subagent produced work that needs a skeptical read

## Playbook

### Step 1 — Read the diff fully

Read every changed file in full, not just the diff summary. Read the tests that accompany the change. If there are no tests, that is finding #1.

### Step 2 — Review across lenses

Go through each lens in order:

**Correctness**
- Does the code do what the tests claim?
- Are the state transitions sound? (sandbox states, deploy phases, playbook steps)
- Are there race conditions? (GC vs. verifier, warm pool vs. spin-up)
- Is the code idempotent? What happens on a retry after partial failure?

**Security & safety**
- Is external input validated at the boundary? (Grok responses, plugin API payloads, webhook bodies)
- Are tokens and secrets handled correctly? (never logged, never in URLs, encrypted at rest)
- Can this change touch the live site unexpectedly? (deploys, migrations, plugin installs)
- Are expensive operations gated? (paid plugins, SEO-affecting URL changes — the no-surprise rule)

**Domain modeling**
- Is the domain encoded in types, or scattered conditionals?
- Are states modeled as a state machine, not string comparisons?
- Would a new engineer understand the boundaries from the types alone?

**Type discipline**
- Are external shapes validated at the boundary?
- Are illegal states unrepresentable?
- Are there `any` escapes or unvalidated casts?

**The product bar**
- Does this serve the non-technical user? (no engineer-only UI leaks)
- Does it honor the chat-preview-approve loop? (no settings screens, no toggles, no diffs for the user)
- Is the change experienced as simpler, or more complex?

### Step 3 — Rank findings

- **Blocker** — incorrect behavior, security hole, live-site risk
- **Should fix** — violates a principle, missing test for changed behavior, race
- **Nit** — style, naming, tiny refactor

### Step 4 — Write the review

```
## Verdict: [approve / request changes]
## Blockers
1. ...
## Should fix
2. ...
## Nits
3. ...
## What's good
- the state machine in [x.ts] is clean; the tests at [y.test.ts] prove the transition
```