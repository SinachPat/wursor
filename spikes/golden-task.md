# Spike: golden-task harness (R7)

**Status:** partial — harness exists; live Grok run not scored (`XAI_API_KEY` unset)

## Question

Can we score a model on WordPress tasks without vibes?

## Done when

- 20 fixture prompts against at least 2 canned WordPress sites
- Each prompt has a hard assertion (preview text, option value, or screenshot)
- One Grok run is scored
- Harness lives under `e2e/golden/`

## Result

Yes, if “score” means: apply a tool call to a fixture and assert the new heading/option. No, if it means we have a Grok quality number. This machine has no `XAI_API_KEY`, so the live call was skipped.

### What exists

| Piece | Path |
|---|---|
| 20 prompts | `e2e/golden/prompts.json` |
| Gutenberg dental site | `e2e/golden/sites/gutenberg-business/site.json` |
| Elementor restaurant site | `e2e/golden/sites/elementor-restaurant/site.json` |
| Apply + assert + Grok parser | `e2e/golden/src/` |
| Scoreboard | `e2e/golden/runs/latest.json` |

Two sites. Ten prompts each. Assertions are `preview_text`, `option`, or `screenshot`. Screenshot here means “the fixture page text must contain X” — not a PNG/SSIM check.

`pnpm --filter @wursor/e2e golden` scored **20/20** fixture tool traces. Live Grok: skipped.

`pnpm test:e2e` — 21 tests, including the scorer.

### How to score a real Grok run

```bash
XAI_API_KEY=… pnpm --filter @wursor/e2e golden
```

That sends `gb-01` through `api.x.ai` and asserts the homepage heading.

### Decision

- **Context:** R7 said stop grading models by vibes.
- **Chosen:** slot-fill tools + fixture apply + hard assert. Sites are JSON, not Docker WP (Docker was not available).
- **Rejected:** “the model said it worked.” Waiting on Docker before any harness.
- **Reverted later?**
