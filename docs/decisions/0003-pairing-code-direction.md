# 3. Wursor generates the pairing code, not the plugin

- **Status:** Accepted
- **Date:** 2026-08-15

## Context

The IMPLEMENTATION.md Sprint 2 sketch had `Wursor_Auth::generate_pairing_code()` run on the plugin (TV-style pairing). PRD §7.1.4 says the user "copies a code from the Wursor web app" — the code must be bound to the signed-in account before the site is known. The plugin is a privileged backdoor (files, DB, WP-CLI) to the live site (R9).

## Decision

Wursor generates the pairing code bound to the account; the user pastes it into the plugin; the plugin redeems it with its `site_url`; Wursor issues scoped `read`/`deploy` tokens plus an HMAC secret. Full protocol in `spikes/pairing-threat-model.md`.

### Options considered

- Plugin-local generate/redeem (the sketch).
- Wursor-generated, pasted into the plugin.

### Rejected

- Plugin-local — cannot bind the code to an account before the site is known; a 6-char code with no TTL/lockout/HMAC is site ownership via a leaked URL.

## Consequences

- 8+ char code, 5-min TTL, 5-attempt lockout, one redeem, HMAC, hashed scoped tokens are the Sprint 2 test spec.
- The `generate_pairing_code` sketch in IMPLEMENTATION.md is wrong and will be corrected during Sprint 2.
- The threat model (T1–T10) is the audit trail for this boundary.
