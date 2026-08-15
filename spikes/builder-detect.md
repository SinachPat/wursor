# Spike: builder detect (R6 / R13)

**Status:** done

## Question

How do we know what actually renders a page?

## Done when

- A site-info payload reports `builder: elementor | beaver | divi | gutenberg | classic`
- Detection uses plugin slugs + post meta
- Documented in the plugin API sketch below

## Result

`detectBuilder()` in `e2e/golden/src/builder-detect.ts`.

Order (first match wins):

1. Active `elementor` **and** `_elementor_edit_mode` or `_elementor_data` → `elementor`
2. Active `beaver-builder-lite-version` or `bb-plugin` **and** `_fl_builder_data` or `_fl_builder_enabled` → `beaver`
3. Theme `Divi` or active `divi-builder` **and** `_et_pb_use_builder === on` → `divi`
4. Any post content contains `<!-- wp:` → `gutenberg`
5. Else `classic`

Plugin slug alone is not enough (inactive junk). Gutenberg markup loses to Elementor when both exist — Elementor is what renders.

Proved on the two golden fixtures and six unit tests.

## Plugin API sketch

`GET /wp-json/wursor/v1/site-info` (read token + HMAC)

```json
{
  "theme": "hello-elementor",
  "plugins": [{ "slug": "elementor", "active": true }],
  "wordpress_version": "6.5.5",
  "php_version": "8.1.30",
  "builder": "elementor",
  "capabilities": { "content": true, "design": true, "install": true },
  "preflight": { "https": true, "rest": true, "disallow_file_mods": false }
}
```

`builder` is computed on the plugin with the same rules as `detectBuilder`. Content and design playbooks must use this field. Editing `post_content` on an Elementor site is a failed test.

### Decision

- **Context:** Elementor stores the page in post meta. Gutenberg stores it in `post_content`.
- **Chosen:** slugs + the meta keys those builders actually write. Priority: paid builders, then block markup, then classic.
- **Rejected:** “if elementor is installed, always Elementor” (inactive plugin). Theme-name-only detection.
- **Reverted later?**
