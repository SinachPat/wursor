---
name: wursor-investigation
description: "A read-only question about the Wursor codebase, product, or architecture. How does X work, why was Y built this way, what does module Z depend on. Read code, docs, and history; answer with evidence and citations to files and lines. Adapted from pstack's /how and /why skills."
---

# Wursor Investigation

Answer a read-only question about how the Wursor codebase works, or why it was built the way it was. No code changes.

## When to use

Use this skill when:
- The user asks "how does X work?" — a walkthrough of a subsystem
- The user asks "why was Y built this way?" — a rationale for a past decision
- The user asks "are we sure Z?" — a verification of an assumption
- A task starts with understanding before changing, and the understanding is the deliverable

## Playbook

### Step 1 — Restate the question in concrete terms

Translate the user's question into a specific, checkable claim. "How do sandboxes work?" becomes "What are the states a sandbox passes through, and which code drives each transition?"

### Step 2 — Read the code, not the summaries

- Find the relevant module. Read its source and its tests.
- Follow the call graph two levels out: who calls this module, what does it call?
- For architecture questions (why is this shaped this way), read the PRD and IMPLEMENTATION for the lock-in notes, then check history for the pivot.

### Step 3 — Gather evidence

Collect:
- File paths and line numbers for every claim
- Actual function signatures and state transitions
- Test names that prove the current behavior
- For "why" questions: the commit or doc that recorded the decision

### Step 4 — Answer with citations

Every claim in the answer must point at a file and (where possible) a line or symbol. No answer of the form "it uses a manager" — show the manager, its interface, and its caller.

### Step 5 — Flag uncertainty

If a claim is not verifiable from the repo (behavior depends on an external system, a decision predates the current docs), say so explicitly. Do not pad with plausible-sounding unverified detail.

## Output shape

```
## How X works
- [file.ts:12](../api/src/file.ts#L12) — this is the entry point
- ...walk the path...
## Why it's shaped this way
- PRD v2.0 §8.1 — the non-technical-first pivot forced the chat-preview-approve loop
## Things I could not verify
- ...explicit list...
```