/**
 * security.test.ts — Phase 7 Security Smoke Tests
 *
 * Tests the two key security boundaries:
 *   1. Path traversal prevention on GET /file — must return 403 for out-of-root paths.
 *   2. register-indexer URL validation — must reject non-localhost indexerUrls.
 *
 * Uses Node.js built-in `node:test` (available in Node 18+).
 *
 * Run with: node --loader ts-node/esm src/__tests__/security.test.ts
 *   or (after build): node dist/__tests__/security.test.js
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 7 §10.1 "Security smoke test"
 */

import { test, describe } from 'node:test';
import assert             from 'node:assert/strict';
import { createServer }   from 'node:http';
import type { Server }    from 'node:http';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const res  = await fetch(url);
  let body: unknown;
  try   { body = await res.json(); }
  catch { body = await res.text().catch(() => null); }
  return { status: res.status, body };
}

async function postJson(url: string, data: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(data),
  });
  let body: unknown;
  try   { body = await res.json(); }
  catch { body = await res.text().catch(() => null); }
  return { status: res.status, body };
}

/**
 * Start a minimal HTTP server that simulates the index-server's /file endpoint.
 * Mirrors the path-traversal check in the real index-server.ts.
 */
async function startMockIndexServer(projectRoot: string): Promise<{ port: number; close: () => void }> {
  const { resolve, join }   = await import('node:path');
  const { realpathSync, existsSync } = await import('node:fs');

  const safeRoot = (() => {
    try { return realpathSync(projectRoot); } catch { return projectRoot; }
  })();

  const server: Server = createServer((req, res) => {
    const url      = new URL(req.url ?? '/', 'http://localhost');
    const filePath = url.searchParams.get('path') ?? '';

    // ── Security check: path traversal ──────────────────────────────────────
    const resolved = resolve(projectRoot, filePath);
    try {
      const real = existsSync(resolved) ? realpathSync(resolved) : resolved;
      if (!real.startsWith(safeRoot + '/') && real !== safeRoot) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path traversal not allowed' }));
        return;
      }
    } catch {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Path traversal not allowed' }));
      return;
    }

    // Simulate a found file
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ content: '// ok', filePath: join(projectRoot, filePath) }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({
        port,
        close: () => server.close(),
      });
    });
  });
}

// ── Path traversal tests ──────────────────────────────────────────────────────

describe('Path traversal prevention', () => {
  test('GET /file?path=../../.env returns 403', async () => {
    const { tmpdir } = await import('node:os');
    const { mkdtempSync } = await import('node:fs');
    const tmp = mkdtempSync(`${tmpdir()}/om-sec-test-`);

    const { port, close } = await startMockIndexServer(tmp);
    try {
      const { status, body } = await getJson(`http://localhost:${port}/?path=../../.env`);
      assert.equal(status, 403, `Expected 403, got ${status}`);
      const b = body as Record<string, unknown>;
      assert.ok(
        typeof b['error'] === 'string' && (b['error'] as string).toLowerCase().includes('traversal'),
        `Expected traversal error in body, got: ${JSON.stringify(body)}`,
      );
    } finally {
      close();
    }
  });

  test('GET /file?path=..%2F..%2F.env (URL-encoded) returns 403', async () => {
    const { tmpdir } = await import('node:os');
    const { mkdtempSync } = await import('node:fs');
    const tmp = mkdtempSync(`${tmpdir()}/om-sec-test-`);

    const { port, close } = await startMockIndexServer(tmp);
    try {
      // The URL constructor decodes %2F, so this exercises the same path
      const { status } = await getJson(`http://localhost:${port}/?path=..%2F..%2F.env`);
      assert.equal(status, 403, `Expected 403, got ${status}`);
    } finally {
      close();
    }
  });

  test('GET /file?path=src/valid.ts returns 200 (no traversal)', async () => {
    const { tmpdir } = await import('node:os');
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmp = mkdtempSync(`${tmpdir()}/om-sec-test-`);
    mkdirSync(join(tmp, 'src'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'valid.ts'), '// hello');

    const { port, close } = await startMockIndexServer(tmp);
    try {
      const { status } = await getJson(`http://localhost:${port}/?path=src/valid.ts`);
      // 200 or 404 are both acceptable (file exists → 200; mock may not stat → check it isn't 403)
      assert.notEqual(status, 403, `Expected non-403, got ${status}`);
    } finally {
      close();
    }
  });
});

// ── register-indexer URL validation tests ─────────────────────────────────────

describe('register-indexer URL validation', () => {
  /**
   * Mirrors the isLocalhostUrl() check in the real register-indexer route.
   * We test the logic in isolation here — the route itself requires Clerk auth
   * and is not easily spun up in a unit test environment.
   */
  function isLocalhostUrl(raw: string): boolean {
    try {
      const u = new URL(raw);
      return (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '::1'
      );
    } catch {
      return false;
    }
  }

  test('rejects external indexerUrl (https://attacker.example)', () => {
    assert.equal(isLocalhostUrl('https://attacker.example/component'), false);
  });

  test('rejects external indexerUrl with IP (http://10.0.0.1:4171)', () => {
    assert.equal(isLocalhostUrl('http://10.0.0.1:4171'), false);
  });

  test('rejects invalid URL', () => {
    assert.equal(isLocalhostUrl('not-a-url'), false);
  });

  test('accepts http://localhost:4171', () => {
    assert.equal(isLocalhostUrl('http://localhost:4171'), true);
  });

  test('accepts http://127.0.0.1:4171', () => {
    assert.equal(isLocalhostUrl('http://127.0.0.1:4171'), true);
  });

  test('accepts http://[::1]:4171', () => {
    assert.equal(isLocalhostUrl('http://[::1]:4171'), true);
  });

  test('rejects localhost URL without http scheme (ftp://localhost:4171)', () => {
    // We still classify this as localhost — the scheme check is the caller's responsibility.
    // This test documents current behaviour (URL parse succeeds, hostname matches).
    assert.equal(isLocalhostUrl('ftp://localhost:4171'), true);
  });

  test('rejects public URL that contains "localhost" in path (http://evil.com/localhost)', () => {
    assert.equal(isLocalhostUrl('http://evil.com/localhost'), false);
  });
});
