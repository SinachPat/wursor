# Spike: golden-task harness (R7)

**Status:** done — live run scored via OpenRouter (`x-ai/grok-4.6`), `gb-01` passed

## Question

Can we score a model on WordPress tasks without vibes?

## Done when

- 20 fixture prompts against at least 2 canned WordPress sites
- Each prompt has a hard assertion (preview text, option value, or screenshot)
- One Grok run is scored
- Harness lives under `e2e/golden/`

## Result

Yes, if “score” means: apply a tool call to a fixture and assert the new heading/option. The harness is now live-scored through OpenRouter.

### What exists

| Piece | Path |
|---|---|
| 20 prompts | `e2e/golden/prompts.json` |
| Gutenberg dental site | `e2e/golden/sites/gutenberg-business/site.json` |
| Elementor restaurant site | `e2e/golden/sites/elementor-restaurant/site.json` |
| Apply + assert + LLM parser | `e2e/golden/src/` |
| Provider client (grok + openrouter) | `e2e/golden/src/llm-client.ts` |
| Scoreboard | `e2e/golden/runs/latest.json` |

Two sites. Ten prompts each. Assertions are `preview_text`, `option`, or `screenshot`. Screenshot here means “the fixture page text must contain X” — not a PNG/SSIM check.

`pnpm --filter @wursor/e2e golden` scored **20/20** fixture tool traces and **gb-01 passed live** (`x-ai/grok-4.6` via OpenRouter).

`pnpm test:e2e` — 28 tests, including the scorer and the provider client.

### How to score a real run

```bash
# .env: LLM_PROVIDER=openrouter, OPENROUTER_API_KEY=…
pnpm --filter @wursor/e2e golden
```

Sends `gb-01` through OpenRouter and asserts the homepage heading.

### Finding

The model needs the page slugs in context. The first live call returned `page: "home"` and failed; after passing `pages=homepage,about,…` in the prompt, `gb-01` passed. The real agent must ship page/site context with every tool-call prompt.

### Decision

- **Context:** R7 said stop grading models by vibes.
- **Chosen:** slot-fill tools + fixture apply + hard assert. Sites are JSON, not Docker WP (Docker was not available).
- **Rejected:** “the model said it worked.” Waiting on Docker before any harness.
- **Reverted later?**
