---
name: wursor-precheck
description: "The entry point for any non-trivial Wursor task. Reads the task, routes it to the right playbook skill, opens a todo list, and establishes the verification bar before any work starts. Use this whenever a task involves changing code, fixing a bug, building a feature, or investigating how the Wursor codebase works. Modeled on Cursor's pstack poteto-mode."
---

# Wursor Precheck (Router)

This is the default entry point for non-trivial work in the Wursor repository. Its job is to make sure the right rigor applies to every task — before a single line is written.

## When to use

Use this skill at the start of any task that is more than a trivial one-line change. This includes:

- Building or editing any module in `api/`, `web/`, `plugin/`, `infrastructure/`, or `e2e/`
- Fixing a bug, with or without a repro
- Adding a feature or changing behavior
- Investigating how something works, or why it was built a certain way
- Reviewing a diff or a pull request
- Writing a decision trail that should be reviewable later

Do **not** use this for: trivial copy edits, one-line doc fixes, or tasks the user explicitly says are quick.

## What to do on activation

1. **Read the task.** Understand what the user is asking and why. If the request is ambiguous, ask a targeted clarifying question before proceeding.

2. **Open a todo list.** The first item is always: *understand the current state of the relevant module(s) before changing anything.*

3. **Route the task to the right playbook.** Read the request and pick the closest match:

| Task shape | Route to skill |
|---|---|
| A read-only question — "how does X work", "why was Y built this way", "are we sure Z" | `wursor-investigation` |
| A defect with a symptom — reproduce, root-cause, fix with runtime evidence | `wursor-bug-fix` |
| New or changed behavior, built from a named data shape | `wursor-feature` |
| A behavior-preserving change to structure or shape | `wursor-feature` (refactoring mode) |
| A diff or PR that needs to be broken | `wursor-review` |
| Any code change that has a cheap test path | `wursor-tdd` (write the failing test first) |
| You want the decisions captured for later review | `wursor-decision-log` |

When a task spans multiple playbooks, apply them in sequence: investigation first (understand), then bug-fix or feature (change), then review (verify).

4. **Copy the playbook steps in verbatim.** Read the routed skill's SKILL.md and follow its steps exactly. Do not improvise a lighter version because the task "feels small."

5. **Set the verification bar.** Before starting, state what "done" means for this task:
   - What test will prove the change works?
   - What command will the user (or a reviewer) run to verify?
   - What artifact is the proof — a passing test, a screenshot, a running sandbox, a clean diff?

6. **Do the work.** Execute the playbook. Keep the todo list updated. Surface findings in the reply as you go.

7. **Report unslopped.** When done, write a reply framed for the person who asked, plus a short note for the maintainer (what changed, why, what the verification was).

## Sticky behavior

Once this skill has been activated for a session, keep applying it to subsequent turns in the same session if the task still matches a playbook. Stay out of the way when the user is clearly doing something trivial. The user can opt out at any time by saying so.

## Hard rules

- Never skip the todo list.
- Never skip stating the verification bar.
- Never mark a task done without the proof defined in step 5 — a self-report ("it compiles") is not proof.
- Never touch the live WordPress site, production credentials, or real user data from this repo. Everything here is code and infrastructure definitions; if a task seems to require live data, stop and ask.
