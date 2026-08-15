# Spike: pairing threat model (R9)

**Status:** done

## Question

What stops a leaked URL from owning the site?

## Done when

Written threat model that becomes the Sprint 2 / Layer 2 auth tests:

- 8+ character pairing code
- 5-minute TTL
- 5-attempt lockout
- HMAC request signing
- hashed + scoped tokens (read vs deploy)

## Result

The plugin is a privileged backdoor: files, DB, WP-CLI. A leaked URL, a guessed pairing code, or a stolen bearer token is site ownership. Isolation of the *sandbox* does not help — this boundary is the *live* site.

### Locked flow

Wursor generates the pairing code (bound to the signed-in account). The user pastes it into the plugin. The plugin redeems it with the site URL. Tokens are issued once.

This matches PRD §7.1.4. The `Wursor_Auth::generate_pairing_code()` sketch in IMPLEMENTATION.md is the wrong direction — plugin-local generate/redeem cannot bind the code to an account before the site is known. Sprint 2 tests follow this note, not that sketch.

```
User (signed in) → POST /sites/pair → Wursor stores pending pairing
User pastes code in plugin admin
Plugin → POST https://api.wursor…/sites/redeem { code, site_url }
Wursor binds site_url, returns read_token + deploy_token + hmac_secret (once)
Plugin stores hashes + encrypted hmac_secret
Wursor stores tokens encrypted (it must send them later)
```

Wursor is the HTTPS client. The plugin is the server. Tokens never appear in query strings or logs.

### Protocol

**Pairing code**

- Alphabet: `[A-Z0-9]`, length ≥ 8. Generate 8. `36^8 ≈ 2.8e12`.
- Bound to `account_id` at creation. Not reusable after success.
- `expires_at = created_at + 300s`. Clock for tests is injectable (`advance_clock`).
- After 5 failed redeems on that code, `locked = true`. Further redeems fail even if the code is correct.
- Redeem also fails if `site_url` is not `https` or does not parse as a URL.
- One successful redeem. Second redeem of the same code fails.

**Tokens**

| Token | Scope | Plugin endpoints |
|---|---|---|
| `read` | site-info, file read, DB read, preflight | GET only |
| `deploy` | file write, DB write, WP-CLI, prepare/commit, rollback | mutating |

- 256-bit random, encoded unpadded base64url, shown once.
- Plugin stores `SHA-256(token)` only. Compare with `hash_equals`.
- Wursor stores ciphertext (envelope key, not plaintext in Postgres).
- A `read` token on a deploy route returns 403. A `deploy` token may call read routes.
- Rotation: Wursor issues a new pair; plugin replaces hashes; old hashes stop working.
- Disconnect: both hashes deleted; Wursor ciphertext deleted.

**HMAC (every plugin request)**

```
canonical = timestamp + "\n" + METHOD + "\n" + path + "\n" + hex(sha256(body))
X-Wursor-Timestamp: unix seconds
X-Wursor-Signature: hex(HMAC-SHA256(hmac_secret, canonical))
Authorization: Bearer <read_token|deploy_token>
```

- Reject if `|now - timestamp| > 60`.
- Reject if signature missing or `hash_equals` fails.
- `hmac_secret` is 256-bit, issued at redeem, stored on the plugin encrypted with the site salt (`AUTH_KEY` + `AUTH_SALT`). Not the same bytes as either token.
- Body hash is over the raw bytes. Empty body is SHA-256 of `""`.

**Transport**

- Plugin REST namespace: `/wp-json/wursor/v1/`.
- Plugin refuses non-HTTPS callbacks except `WP_ENVIRONMENT_TYPE === 'local'`.
- Wursor never puts tokens in URLs, logs, or SSE payloads.

### Threats

| ID | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | Attacker guesses pairing codes | 8+ charset, 5-try lockout, 5-min TTL | Online brute force is ~5 guesses / 5 min / code |
| T2 | Pairing code leaked (screenshot, chat) | TTL + single use + requires wp-admin to paste | Anyone with the code and wp-admin wins until expiry |
| T3 | Attacker redeems victim's code onto attacker site | After redeem, Wursor shows the bound `site_url` and requires an explicit “this is my site” confirm before the site is usable | User who confirms a foreign URL is connected to it |
| T4 | Bearer token in a URL / access log / Referer | Tokens only in `Authorization`. Tests fail if any helper puts them in a query | Operator error in a future client |
| T5 | Stolen request replayed | HMAC over timestamp+method+path+body; 60s skew window | Replay inside the window if the request was captured |
| T6 | Stolen `read` token used to deploy | Scoped tokens; deploy routes require `deploy` | Read token still exfiltrates site-info |
| T7 | Plugin DB dump / filesystem copy | Plugin stores hashes + encrypted hmac_secret, not raw tokens | Wursor-side ciphertext leak still lets us *call* the plugin until rotation |
| T8 | MITM on HTTP | HTTPS required except local | Mis-set `WP_ENVIRONMENT_TYPE` on a public HTTP site |
| T9 | CSRF in the browser against plugin REST | Bearer + HMAC. No cookie auth for `/wursor/v1/` | None if those headers stay required |
| T10 | Timing leak on token compare | `hash_equals` only | — |

Out of scope for this spike (handled elsewhere): stolen wp-admin session, compromised host, malicious plugin already on the site.

### Sprint 2 tests (this note is the spec)

`plugin/__tests__/test-auth.php`

1. `test_pairing_code_is_at_least_eight_alnum` — `^[A-Z0-9]{8,}$`
2. `test_pairing_code_expires_after_five_minutes` — `advance_clock(301)` → redeem false
3. `test_pairing_code_valid_at_four_minutes_fifty_nine` — `advance_clock(299)` → redeem true
4. `test_locks_out_after_five_failed_attempts` — five bad redeems → `is_locked_out()`
5. `test_lockout_rejects_even_the_correct_code`
6. `test_successful_redeem_cannot_be_replayed`
7. `test_read_token_hash_is_stored_not_plaintext`
8. `test_read_token_forbidden_on_deploy_route` → 403
9. `test_deploy_token_allowed_on_site_info`
10. `test_hmac_rejects_stale_timestamp` — timestamp older than 60s
11. `test_hmac_rejects_tampered_body`
12. `test_hmac_rejects_missing_signature`
13. `test_verify_uses_hash_equals`
14. `test_rotated_tokens_invalidate_old_hashes`

`api/__tests__/services/plugin-client.test.ts`

1. signs every request with timestamp + HMAC
2. sends token in `Authorization`, never in the URL
3. maps 401 to `Authentication failed`
4. refuses to construct a client with an `http://` site URL outside local

`api/__tests__/routes/sites-pair.test.ts`

1. pair requires a session
2. redeem binds `site_url` and returns tokens once
3. second redeem of the same code fails
4. site is not `connected` until the user confirms the shown URL (T3)

### Decision

- **Context:** plugin can own the live site; old 6-char sketch had no TTL, lockout, HMAC, or scopes.
- **Options:** plugin-generated code (TV pairing) vs Wursor-generated code (PRD).
- **Chosen:** Wursor-generated, pasted into the plugin, HMAC + scoped tokens as above.
- **Rejected:** plugin-local generate/redeem (cannot bind to account first; IMPLEMENTATION sketch). Tokens in query strings. Single unscope token.
- **Reverted later?**
