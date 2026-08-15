# Spike: P0 plugin catalog

**Status:** done

## Question

What may the agent ever install?

## Done when

- ~40 slugs written
- `wp plugin install <url>` is forbidden even before an install playbook exists

## Result

The agent may install **only** from the catalog table below, and only from wordpress.org via slug (`wp plugin install <slug>`). That playbook does not exist in the MVP. The rule still ships in Sprint 3 tool schemas so a heading-change agent cannot install anything.

### Forbidden (now and in v1)

- `wp plugin install <url>`
- `wp plugin install` with a local zip or any path
- Premium / marketplace URLs (Elementor Pro zip, Woo market, GitHub)
- Any slug not in the catalog
- Re-install of a detect-only plugin (table below)

Fail closed. Unknown slug → refuse and say so in chat. Do not search wordpress.org ad hoc.

Reputation, zip SHA, and egress-watch on first activate are Sprint 9. This note is only the allowlist.

Paid *services* behind a free slug (WooPayments, Site Kit) still hit the no-surprise gate at deploy.

### Catalog (40)

wordpress.org slugs. Installable only when the site is `install-safe` (writable filesystem, `DISALLOW_FILE_MODS` off).

| # | Slug | Why |
|---|---|---|
| 1 | `contact-form-7` | Forms. Most common. |
| 2 | `wpforms-lite` | Forms. Non-technical default. |
| 3 | `fluentform` | Forms. |
| 4 | `forminator` | Forms + polls/quizzes. |
| 5 | `ninja-forms` | Forms. |
| 6 | `wordpress-seo` | Yoast. SEO. |
| 7 | `seo-by-rank-math` | SEO. |
| 8 | `all-in-one-seo-pack` | SEO. |
| 9 | `woocommerce` | Store. |
| 10 | `woocommerce-payments` | Checkout. Paid service → no-surprise. |
| 11 | `woocommerce-gateway-stripe` | Checkout. |
| 12 | `woocommerce-paypal-payments` | Checkout. |
| 13 | `elementor` | Builder. Install only if site has no other builder. |
| 14 | `kadence-blocks` | Gutenberg blocks. |
| 15 | `stackable-ultimate-gutenberg-blocks` | Gutenberg blocks. |
| 16 | `ultimate-addons-for-gutenberg` | Spectra. Gutenberg blocks. |
| 17 | `classic-editor` | Needed on Classic sites before content edits. |
| 18 | `simply-schedule-appointments` | Booking. |
| 19 | `booking` | Booking Calendar. |
| 20 | `easy-appointments` | Booking. |
| 21 | `google-site-kit` | Analytics. Google account → no-surprise. |
| 22 | `independent-analytics` | Analytics without Google. |
| 23 | `fluent-smtp` | Mail delivery. SMTP secrets stay redacted (R10). |
| 24 | `wp-mail-smtp` | Mail delivery. |
| 25 | `redirection` | Redirects. Slug changes still hit R12. |
| 26 | `akismet` | Comment spam. |
| 27 | `cookie-law-info` | CookieYes. Consent. |
| 28 | `complianz-gdpr` | Consent. |
| 29 | `updraftplus` | Backup. |
| 30 | `backwpup` | Backup. |
| 31 | `autoptimize` | CSS/JS minify. |
| 32 | `wp-optimize` | Cleanup / cache. |
| 33 | `polylang` | Languages. |
| 34 | `translatepress-multilingual` | Languages. |
| 35 | `tablepress` | Tables. |
| 36 | `duplicate-post` | Duplicate a page. |
| 37 | `disable-comments` | Turn comments off. |
| 38 | `safe-svg` | SVG uploads. |
| 39 | `modula-best-grid-gallery` | Gallery. |
| 40 | `foogallery` | Gallery. |

40 slugs. Adding one is a catalog PR, not a prompt change.

### Detect-only — never install

These break REST, deploys, or hosts. Site-info reports them. The agent does not install them.

| Slug | Why not |
|---|---|
| `wordfence` | Kills REST / pairing. |
| `better-wp-security` | iThemes. Same. |
| `sucuri-scanner` | Host / firewall coupling. |
| `litespeed-cache` | Host-specific. |
| `w3-total-cache` | Easy to brick a site. |
| `wp-super-cache` | Same. |
| `jetpack` | Too large; host-coupled. Configure if already present, later. |

### Sprint 3 tests (this note is the spec)

`api/__tests__/agents/tool-schemas.test.ts`

1. `generateToolSchemas()` has no tool or enum value matching `wp plugin install http`
2. `wp plugin install` (when it exists) accepts only slugs from this catalog
3. A tool call with slug `evil-plugin` is rejected before any sandbox exec
4. A tool call with a URL or `.zip` is rejected

Until the install playbook exists, the simpler form is enough: **no install tool at all**, plus assertion (1).

### Decision

- **Context:** wordpress.org is not a reviewed-safe catalog. Preview cannot see a plugin phoning home. MVP has no install playbook, but the agent still needs a hard wall.
- **Options:** open wordpress.org search vs a written allowlist vs delay any wall until Sprint 9.
- **Chosen:** 40-slug allowlist now; no URL/zip; detect-only list for security/cache suites; no install tool in MVP.
- **Rejected:** open search (R2). Installing Wordfence/Jetpack/cache suites (they break the product or the site).
- **Reverted later?**
