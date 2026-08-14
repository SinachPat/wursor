---
name: wursor-decision-log
description: "Write a reviewable decision trail for a non-trivial change in the Wursor repo. Logs the choices, alternatives, and tradeoffs so the trail can be audited later. Adapted from pstack's /show-me-your-work."
---

# Wursor Decision Log

Log decisions as they are made so the trail is reviewable and auditable.

## When to use

Use this skill when:
- The task is complex enough that a reviewer might ask "why was this done this way?"
- The change involves a tradeoff (speed vs. cost, simplicity vs. completeness, two architectural forks)
- The user explicitly asks for a decision trail
- The task is a prototype or spike with a decision at the end (which path to commit to)

## Playbook

### Step 1 — Log each decision as you make it

For each decision, record:

```
## Decision: [title]
- **Context:** what was the situation or constraint?
- **Options considered:** what were the alternatives?
- **Chosen:** which option was picked, and why?
- **Rejected:** why were the other options not chosen?
- **Reverted later?** (leave blank, filled only if this decision is ultimately undone)
```

### Step 2 — Keep the log in the conversation

Append each decision to the running log in thread. At the end of the task, present the full log.

### Step 3 — End with the full log

```
## Decision Log
### Decision: Sandbox storage backend
- **Context:** we need to persist sandbox state for GC and pause-to-disk
- **Options considered:** local filesystem on the VPS, Redis, S3
- **Chosen:** local filesystem — fast, no extra service, but means we cannot rebalance containers across hosts
- **Rejected:** Redis (no need for byte-level blob storage), S3 (latency is too high for pause/resume on a warm container)
- **Reverted later?** — yes, when we moved to multi-host orchestration in Phase 3
```

## Hard rules

- Log every decision you would need to explain to a reviewer
- Be explicit about tradeoffs — "we chose X over Y because Z" is better than "we chose X"
- Do not log decisions that are obvious from the code (e.g., "I decided to use `const` instead of `let`")