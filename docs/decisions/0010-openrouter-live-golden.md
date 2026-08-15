# 10. Golden harness scores live runs through a provider-agnostic LLM client (OpenRouter first)

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

Phase 0's golden-task spike was the last gate item, stuck at "partial" because no `XAI_API_KEY` was set and the harness hard-coded `api.x.ai`. The developer holds an OpenRouter key, and OpenRouter speaks the same OpenAI-compatible `chat/completions` shape (including tool-calling), so the live run could be unblocked without a Grok-specific key.

## Decision

Replace the hard-coded `grok-client.ts` with a provider-agnostic `llm-client.ts` that supports `grok` (x.ai) and `openrouter`, selected by `LLM_PROVIDER`. The OpenRouter default model is `x-ai/grok-4.6`. The harness now passes the site's page slugs into the prompt.

### Options considered

- Wait for an `XAI_API_KEY` and keep the hard-coded x.ai client.
- Hard-code OpenRouter, dropping the x.ai path.
- Provider-agnostic client with `grok` + `openrouter` (chosen).

### Rejected

- Wait for x.ai — blocks the gate on a key we don't have, for no technical reason.
- OpenRouter-only — the plan (IMPLEMENTATION §3) still names Grok the default adapter; keeping both providers matches that plan and costs one env switch.

## Consequences

- The live gate run is scored and passing (`gb-01` passed on `x-ai/grok-4.6`); the Phase 0 golden spike flips to done.
- `x-ai/grok-latest` is not a callable OpenRouter ID (returns 400); the pinned `x-ai/grok-4.6` works and supports `tool_choice: required`.
- A real finding: without the page-slug list in the prompt, the model guessed `page: "home"` and failed. Tool-call prompts must always carry site/page context. Sprint 3 must inherit this when it builds `api/src/agents/llm-client.ts`.
- `llm-client.ts` here is a spike; Sprint 3 will generalize it (streaming, circuit breaker, fallback) rather than promote this file verbatim.
