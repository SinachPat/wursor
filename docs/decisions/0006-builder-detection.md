# 6. Builder detection uses slugs + post meta with a priority order

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

WordPress pages live in different stores: Gutenberg in `post_content` block markup, Elementor in `_elementor_data` post meta, Classic as raw HTML. Editing the wrong store means the preview does not change and we do not know why (R6, R13).

## Decision

`detectBuilder()` returns `elementor | beaver | divi | gutenberg | classic` from theme + active plugin slugs + post meta + content. Priority: elementor (slug + `_elementor_edit_mode`/`_elementor_data`) → beaver (`_fl_builder_data`) → divi (theme + `_et_pb_use_builder`) → gutenberg (`<!-- wp:`) → classic.

### Options considered

- Theme-name-only.
- "Elementor is installed" (active plugin only).
- Slugs + the meta keys each builder actually writes.

### Rejected

- Theme-name-only — lies for child themes / Hello Elementor vs Divi.
- Active-plugin-only — inactive junk and leftover block markup produce false positives.

## Consequences

- Elementor wins over leftover Gutenberg markup, matching what a visitor actually renders.
- The TypeScript function is the spec; the PHP plugin reimplements the same rules, and `site-info` reports `builder`.
- Content and design playbooks branch on this field; editing `post_content` on an Elementor site is a failed test.
