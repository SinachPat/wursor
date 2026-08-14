---
name: wursor-principles
description: "The engineering principles for the Wursor codebase, adapted from Cursor's pstack principles. Reference this when deciding how to structure code, what tradeoffs to make, or how to verify work in api/, web/, plugin/, infrastructure/, and e2e/. It is the shared standard every playbook routes through."
---

# Wursor Engineering Principles

These are the rules that govern how work gets done in this repository. Each is a rule, not a suggestion. When a playbook or task runs into a decision, resolve it against these principles.

## Core

1. **Laziness protocol** — Bias toward deletion and the smallest change that solves the problem. When two solutions are otherwise equal, the shorter one wins. When a feature is questionable, the version that removes more code wins.

2. **Foundational thinking** — Apply before writing logic. Choose the core types and data shapes first (`Site`, `Sandbox`, `DeployLog`, `Playbook`, tool schemas). Get the data structures right so downstream code becomes obvious. Ask what concurrent actors share (warm pool, sandbox GC, SSE streams).

3. **Redesign from first principles** — When a requirement genuinely changed, redesign as if the new requirement had been foundational from day one. Do not bolt the new behavior onto a structure that no longer fits. The non-technical-first pivot is the standing example: the chat-preview-approve loop is the whole product surface; do not reintroduce engineer-only UI.

4. **Subtract before you add** — Remove dead weight, redundant validators, and stub references first, then build on the simpler base. If you find a module with placeholder code while working in it, delete the placeholder rather than working around it.

5. **Minimize reader load** — Count the layers between a question and its answer, and the hidden state a reader must hold in their head. Collapse one-caller wrappers, shrink mutable scope, and prefer a function that returns a value over one that mutates shared state.

6. **Outcome-oriented execution** — During planned rewrites or migrations, define explicit phase boundaries. Converge on the target architecture; do not preserve smooth intermediate states with throwaway compatibility code.

7. **Experience-first** — This product is for non-technical WordPress site owners. Choose user delight over implementation convenience. Ship fewer polished features over more rough ones. When in doubt, the choice that a non-technical user would experience as simpler wins.

8. **Exhaust the design space** — Before committing to a design with real tradeoffs, build 2–3 competing sketches (types, module boundaries, or prototypes) and compare side by side. Especially in the `api/src/playbooks/` and `api/src/sandbox/` modules.

9. **Build the lever** — Apply to any non-trivial work: edits, migrations, analyses, checks. Build the tool that does it or proves it (a script, a codemod, a test harness, a skill your subagents follow) instead of working by hand. The tool is the artifact a reviewer can rerun.

## Architecture

10. **Model the domain** — Encode the domain in structures instead of scattered conditionals. A `Playbook` is a type, not a switch statement. A `SandboxStatus` is a state machine, not a string comparison in three files.

11. **Boundary discipline** — Concentrate guards at system boundaries (API routes, plugin REST API, Docker client, LLM client, filesystem). Trust internal types; keep business logic in pure functions that cannot corrupt state.

12. **Type-system discipline** — Make illegal states unrepresentable. Use TypeScript discriminated unions for tool-call results and sandbox states. Parse external data (Grok responses, plugin API payloads, Docker events) at the boundary with a schema validator; never trust unvalidated external shapes inside business logic.

13. **Make operations idempotent** — Converge to the same end state regardless of partial prior runs. Deploys, sandbox spins, and plugin installs must be retry-safe. If a step can partially fail, design the operation to be re-run until it reaches a known state.

14. **Migrate callers, then delete legacy APIs** — Migrate callers and delete the old API in the same wave instead of preserving compatibility layers. No parallel legacy paths.

15. **Separate before serializing shared state** — Eliminate shared mutable state first; only serialize when one shared writer is a real invariant. The sandbox manager and warm pool must not serialize on a single mutex that everything else waits on.

## Verification

16. **Prove it works** — Apply after completing a task, before declaring done. Verify against the real artifact: run the test, start the sandbox, hit the endpoint, read the actual value, inspect the diff. Not a proxy, not a self-report, not "it compiles."

17. **Fix root causes** — Trace each symptom to its root cause and fix it there. Reproduce first. Ask "why" until you reach the source. Resist nil-checks and guards that silence crashes instead of fixing them.

18. **Sequence verifiable units** — Apply to multi-step work (sweeps, migrations, runs of similar edits). Break work into small units that each end in a verifiable state. Check each before the next. Order delivery so the sequence proves itself to a reviewer.

## Delegation

19. **Guard the context window** — Route bulk to subagents; keep summaries in the main thread, not raw payloads. When a task involves many similar files, delegate the sweep and bring back a tight report.

20. **Never block on the human** — Proceed, present the result, let the human course-correct after the fact. Reserve confirmation for irreversible actions (deploys to a live site, deleting data, changing auth).

## Meta

21. **Encode lessons in structure** — Encode a rule as a lint rule, a type, a schema, a runtime check, or a script instead of more text. If you find yourself repeating the same correction in prose, turn it into a check the code enforces.
