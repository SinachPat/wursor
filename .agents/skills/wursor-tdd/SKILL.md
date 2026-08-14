---
name: wursor-tdd
description: "Write a failing test first, then implement, then verify. For any code change in api/ (Node.js + TypeScript), web/ (React + TypeScript), plugin/ (PHP), or infrastructure/ (Docker) that has a measurable test path. Adapted from pstack's /tdd skill."
---

# Wursor TDD

Write the failing test first, then the implementation, then verify the test passes. This is the default workflow for any code change in this repository.

## When to use

Use this skill when:
- Fixing a bug with a measurable test path
- Building a new feature with unit-testable boundaries
- Adding a helper, utility, or pure function
- Refactoring where behavior should be preserved
- The task tells you the test path is cheap or fast

Do **not** use this for: configuration-only changes, non-code documentation, or infrastructure scripts whose test would be a full e2e run.

## Playbook

### Step 1 — Understand what's being tested

Read the relevant module. Understand the function signature, the inputs, the outputs, and the side effects. For `api/` modules, check the existing `__tests__/` or `tests/` directory for patterns.

### Step 2 — Write the failing test

One test per behavior. One assertion per test.

```typescript
// Example for api/ modules
import { describe, it, expect } from 'vitest';

describe('SandboxMirror', () => {
  it('fetches site info from the plugin API', async () => {
    const mirror = new SandboxMirror('https://example.com', 'token');
    const info = await mirror.fetchSiteInfo();
    expect(info.theme).toBeDefined();
    expect(info.plugins).toBeInstanceOf(Array);
  });
});
```

```php
// Example for plugin/ modules
class WursorAuthTest extends WP_UnitTestCase {
  public function test_generates_six_character_code() {
    $auth = new Wursor_Auth();
    $code = $auth->generate_pairing_code();
    $this->assertEquals(6, strlen($code));
    $this->assertMatchesRegularExpression('/^[A-Z0-9]{6}$/', $code);
  }
}
```

### Step 3 — Run the test. It must fail.

Do not proceed until the test runner confirms the test fails. A test that passes before implementation is a test that tests nothing.

```bash
# api/ — vitest
pnpm test -- --grep "SandboxMirror"
# plugin/ — phpunit
phpunit --filter test_generates_six_character_code
```

### Step 4 — Implement the minimum code to pass

Write the implementation. No more than what's needed to make the test pass.

### Step 5 — Run the test. It must pass.

Same command as step 3. The test must pass.

### Step 6 — Refactor

Clean up the implementation and the test. Remove debug code, rename unclear variables, extract helpers if they exist. The test should still pass.

### Step 7 — Verify with the broader test suite

Run the relevant test suite to make sure nothing is broken:

```bash
# api/
pnpm test:api
# web/
pnpm test:web
# plugin/
phpunit
```

### Step 8 — Report

State what was tested, what the test proved, and what the broader suite showed.

## Hard rules

- No implementation code is written without a failing test.
- One test per behavior. One assertion per test.
- Tests are deterministic: no network calls in unit tests. Mock the Grok API, the plugin API, Docker, and the filesystem.
- The test must fail before the implementation. If it passes, the test is wrong.
- Coverage floor: api/ and web/ ≥ 90% line coverage. plugin/ ≥ 80%.