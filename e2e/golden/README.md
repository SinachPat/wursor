# Golden-task harness

Phase 0. Two canned sites, 20 prompts, builder detect, subset + media proxy.

```
e2e/golden/
  prompts.json
  sites/gutenberg-business/site.json
  sites/elementor-restaurant/site.json
  src/                 # detect, apply, score, subset, proxy, runners
  __tests__/
  runs/latest.json
  runs/mirror-timing.json
```

```bash
pnpm test:e2e
pnpm --filter @wursor/e2e golden          # 20/20 fixture traces; live Grok if XAI_API_KEY
pnpm --filter @wursor/e2e mirror:time     # ≥2GB synthetic + p50/p95
```
