# What this batch is for

Pairing and the plugin catalog (notes 1–2) answered “who is allowed to talk to the live site” and “what may ever be installed.” This batch answers the other three kill-shots before any product UI exists:

3. Can we tell if the model actually did the WordPress thing?
4. Do we know which store holds the page (Gutenberg vs Elementor vs Classic)?
5. Can a 2GB site still show a preview in time if we refuse to copy the media library?

If 3 is vibes, we will ship a confident liar. If 4 is wrong, we will edit `post_content` while Elementor renders JSON from post meta — the preview will not change and we will not know why. If 5 is a full copy, the five-minute product is dead on any real business site.

None of this is the chat app. It is the measuring stick the chat app has to pass.

## 3 — Golden-task harness

### What it does

It keeps twenty English requests, two fake but structured WordPress sites, and a scorer.

A prompt is not “make it modern.” It is “change the homepage heading to Welcome to My Business.” The assertion is not “the model sounded sure.” It is: after the tool call is applied to the fixture, that string is in the page (or that option equals that value).

Sites:

- `gutenberg-business` — Twenty Twenty-Four, block markup, a dental practice.
- `elementor-restaurant` — Hello Elementor, `_elementor_data` JSON, a trattoria.

Ten prompts each. Mix of heading edits, text replace, `blogname` / `blogdescription` / `blog_public`, and two `screenshot` rows that today still assert on fixture text (see uncertainties).

### How it was implemented

TDD first. Tests imported modules that did not exist. Vitest failed. Then:

- `applyTool` mutates a `SiteFixture` (heading regex or Elementor `title`, string replace, option set).
- `checkAssertion` reads the result.
- `scoreGrokResponse` parses an xAI/OpenAI-shaped `tool_calls` payload, applies, asserts.
- `run-golden.ts` scores the twenty expected traces and, if `XAI_API_KEY` is set, sends `gb-01` to `api.x.ai`.

Proof on this machine:

```
pnpm test:e2e          → 21 passed
pnpm --filter @wursor/e2e golden
                       → 20/20 fixture traces
                       → live Grok skipped (no key)
```

### Why this shape

WordPress work is slot filling (`page`, `old`, `new`) plus a deterministic write. If we score free-form chat, Grok can narrate a heading change that never happened. If we only score “did the API return 200,” we learn nothing about the page.

Applying the tool to a fixture is the smallest thing that can fail for the right reason. JSON sites instead of Docker WP because Docker was not available here; the assertion types stay valid when real sandboxes exist — swap `applyTool` for a REST/`wp post update` runner and keep `prompts.json`.

Expected traces are an answer key for the *harness*, not a grade for Grok. A live grade is one HTTP call away. That is deliberate: unit tests stay offline (TDD rule: no network in unit tests).

## 4 — Builder detect

### What it does

Given theme, plugin slugs, post content, and post meta, it returns exactly one of:

`elementor | beaver | divi | gutenberg | classic`

That value is what `site-info` will send. Playbooks are required to branch on it.

### How it was implemented

Same TDD file: six cases, one assertion each. Rules use **slug plus the meta key that builder actually writes**. Gutenberg is `<!-- wp:` in content. Classic is the leftover.

Elementor wins over block markup. A site can have leftover Gutenberg in `post_content` while Elementor is what the visitor sees. Editing the wrong store is the R6/R13 failure mode.

### Why this is the right approach

Theme name alone is a lie (Hello Elementor vs a child theme vs Divi). “Elementor is installed” is a lie (inactive). Reading only `post_content` is a lie on builders.

The combination is what WordPress itself uses: active plugin, then that plugin’s post meta. We copied that, in a function small enough to test without PHP. The plugin will run the same rules in PHP later; the TypeScript copy is the spec the PHP tests must match.

## 5 — Mirror timing

### What it does

It asks: if the site’s uploads are 2GB, can the *content-edit* path still put the target page in a sandbox in under 60 seconds?

The prototype:

1. Builds a synthetic export: 8k posts, 20k Woo orders, a **2,147,483,648** byte blob.
2. Runs `exportDbSubset(content)` — keeps `wp_posts` / `wp_postmeta` / `wp_options`, drops orders and comments, redacts `*_key` / `*_secret` / `smtp_pass`.
3. Resolves `/uploads/…` to `origin + path`. Copies **0** upload bytes.
4. Times that 20 times.
5. Times a real local `dd` of the 2GB blob as “what copying the library costs on this disk.”

### How it was implemented

Tests first (subset tables, redaction, proxy, replace-only copy). Then `run-mirror-timing.ts`. `mkfile` created the blob once under `e2e/fixtures/large-exports/` (gitignored). First naive baseline used `cp`; on APFS that is `clonefile` and finished in ~2s without writing bytes. That number was thrown out. `dd if=… of=…` wrote the bytes: **2449 ms**, ~905 MB/s.

Slice p50 **0.003 ms**, p95 **0.010 ms**, upload bytes copied **0**. Decision: **do not change Layer 3**.

### Why this is the right approach

Warm pool hides *boot*. It does not hide *copy*. A Woo store’s cost is `wp_posts`, plugin folders, and upload thumbs — not MySQL start time. Copying 2GB from a customer host over the plugin REST API will not finish in a minute. Proxying `/wp-content/uploads/*` to origin makes the preview honest without the copy. The 2.4s local `dd` is a *lower bound* on copy cost; a real host will be slower. The slice does not need that copy at all.

Redacting secrets in the same function is R10: a sandbox with outbound internet should not hold `smtp_pass`.

## Why this batch, in this order, is the best next step

The product is describe → preview → approve. Before UI:

- You need a test that can fail a bad model (3).
- You need to know which bytes to change or the preview is fake (4).
- You need to know the preview can appear before the user leaves (5).

Doing them as scripts + fixtures instead of `web/` + `api/` keeps the Phase 0 gate honest. We did not invent a chat panel that cannot be scored.

TDD on the spike code means the later plugin/API ports have a contract: same types, same assertions, same 60s budget.

## What I am not sure about

1. **Live Grok was not scored.** No `XAI_API_KEY` in this environment. The harness can call `api.x.ai`; it did not. I do not know Grok’s actual score on these twenty prompts. Do not treat 20/20 fixture traces as a model eval.

2. **Sites are JSON, not WordPress.** No Docker on this machine. Builder detect and heading replace are faithful to how WP stores data, but they are not PHP, not `$wpdb`, not a running theme. A real Elementor document is a deeper JSON tree than the two-widget fixture.

3. **“Screenshot” assertions are not screenshots.** They assert text in the fixture. Pixel/SSIM checks need a sandbox and Playwright. I used the type so the prompt file matches the done-when enum, not because we captured a PNG.

4. **Mirror p50/p95 are in-process.** They do not include plugin HTTP, PHP serialization, or nginx. They prove the *algorithm* is not the 60s problem. They do not prove a 2GB *site on SiteGround* will preview in 60s. I am sure we should still not copy uploads. I am not sure the first real content-slice *pull* will stay under 60s.

5. **Naive copy at 2.4s is this SSD.** A cheap VPS or a network pull will be worse. Do not quote 2.4s as “copy is fine.”

6. **Elementor `title` patcher.** `JSON.stringify`’s replacer changes the first `title` key it sees. That is correct for the fixture (heading widget first). A real tree may put a button title first. The PHP adapter must walk widgets by `widgetType === heading'`, not “first title.”

7. **Grok model id.** The client uses `grok-3`. If xAI has renamed the tool-calling model, the live runner will 404 until that string is updated.

8. **Divi/Beaver** are unit-tested with synthetic meta only. They are not in the two canned sites. Alpha still needs a real Elementor host; Beaver/Divi are unverified in the wild.

## Commands a reviewer can rerun

```bash
pnpm test:e2e
pnpm --filter @wursor/e2e golden
pnpm --filter @wursor/e2e mirror:time    # reuses the 2GB blob if present
```

Gate status after this batch: catalog done, pairing done, builder done, mirror done on synthetic 2GB, golden harness built, **live Grok still open**. Product chat still blocked until you either accept that gap or set `XAI_API_KEY` and score `gb-01`.
