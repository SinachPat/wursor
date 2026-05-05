#!/usr/bin/env node

// ── Originmain CLI ───────────────────────────────────────────────────────────
// Usage:
//   npx @originmain/cli dev   --target http://localhost:3000 [--port 4170]
//                             [--index-port 4171] [--no-index]
//   npx @originmain/cli login [--app-url https://app.originmain.io]
//
// Starts a reverse proxy + optional AST indexer for live React component
// inspection in Originmain artboards. See SOURCE-AWARE-CANVAS.md for details.

import { parseArgs }                       from 'node:util';
import { resolve }                         from 'node:path';
import { startProxy }                      from './proxy.js';
import { Indexer }                         from './indexer.js';
import { startIndexServer }                from './index-server.js';
import { detectProjectMeta }               from './detect-framework.js';
import { initIsolationServer }             from './isolation-server.js';
import { runLogin }                        from './commands/login.js';

const DEFAULT_PORT       = 4170;
const DEFAULT_INDEX_PORT = 4171;

function printUsage(): void {
  console.log(`
  \x1b[36m\x1b[1mOriginmain CLI\x1b[0m

  Commands:
    originmain dev   --target <url> [options]
    originmain login [--app-url <url>]

  Dev options:
    --target, -t       Target dev server URL (required)
                       Example: http://localhost:3000
    --port, -p         Proxy listen port (default: ${DEFAULT_PORT})
    --index-port       AST indexer API port (default: ${DEFAULT_INDEX_PORT})
    --no-index         Disable the AST indexer (Props/Code tabs degraded)
    --help, -h         Show this help

  Login options:
    --app-url          Originmain app URL (default: https://app.originmain.io)

  Environment variables:
    ORIGINMAIN_BRIDGE_URL  Agent Bridge URL (default: http://localhost:4172)
    ORIGINMAIN_APP_URL     Originmain app URL (overrides --app-url default)

  Examples:
    npx @originmain/cli login
    npx @originmain/cli dev --target http://localhost:3000
    npx @originmain/cli dev --target http://localhost:3000 --no-index
`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      target:       { type: 'string',  short: 't' },
      port:         { type: 'string',  short: 'p' },
      'index-port': { type: 'string' },
      'no-index':   { type: 'boolean' },
      'app-url':    { type: 'string' },
      help:         { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0];

  if (values.help || !command) {
    printUsage();
    process.exit(values.help ? 0 : 1);
  }

  // ── login command ──────────────────────────────────────────────────────────
  if (command === 'login') {
    const appUrl = values['app-url'] as string | undefined;
    await runLogin(appUrl ? { appUrl } : {});
    process.exit(0);
  }

  if (command !== 'dev') {
    console.error(`  Unknown command: ${command}\n  Run "originmain --help" for usage.`);
    process.exit(1);
  }

  // ── Validate --target ─────────────────────────────────────────────────────
  const target = values.target;
  if (!target || typeof target !== 'string') {
    console.error('  Error: --target is required.\n  Example: originmain dev --target http://localhost:3000');
    process.exit(1);
  }

  let targetUrl: URL;
  try { targetUrl = new URL(target); }
  catch {
    console.error(`  Error: Invalid target URL: ${target}`);
    process.exit(1);
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    console.error(`  Error: Target must be http:// or https:// (got ${targetUrl.protocol})`);
    process.exit(1);
  }

  // ── Parse ports ───────────────────────────────────────────────────────────
  const port = values.port ? parseInt(values.port as string, 10) : DEFAULT_PORT;
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error(`  Error: Invalid port: ${values.port}`);
    process.exit(1);
  }

  const indexPortRaw = values['index-port'] as string | undefined;
  const indexPort    = indexPortRaw ? parseInt(indexPortRaw, 10) : DEFAULT_INDEX_PORT;
  if (Number.isNaN(indexPort) || indexPort < 1 || indexPort > 65535) {
    console.error(`  Error: Invalid index port: ${indexPortRaw}`);
    process.exit(1);
  }

  const noIndex = values['no-index'] === true;

  // ── Agent Bridge URL ──────────────────────────────────────────────────────
  let bridgeUrl = process.env['ORIGINMAIN_BRIDGE_URL'];
  if (!bridgeUrl) {
    // Try ~/.originmain/config.json
    try {
      const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
      const cfgPath = resolve(homeDir, '.originmain', 'config.json');
      const { readFileSync } = await import('node:fs');
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8')) as Record<string, unknown>;
      if (typeof cfg['bridgeUrl'] === 'string') bridgeUrl = cfg['bridgeUrl'];
    } catch { /* config not present */ }

    if (!bridgeUrl) {
      bridgeUrl = 'http://localhost:4172';
      console.log(`  \x1b[2mUsing default Agent Bridge URL: ${bridgeUrl}\x1b[0m`);
    }
  }

  // ── Start AST indexer (unless --no-index) ─────────────────────────────────
  const projectRoot = process.cwd();
  let indexServer: { close: () => void } | null = null;

  if (!noIndex) {
    const projectMeta = await detectProjectMeta(projectRoot);
    const indexer     = new Indexer(projectRoot);

    // Start watching in background (non-blocking)
    indexer.watch().catch((err: Error) => {
      console.error(`[originmain indexer] Watch error: ${err.message}`);
    });

    indexServer = startIndexServer({ indexer, projectMeta, projectRoot, port: indexPort });
  } else {
    console.log('  \x1b[2mAST indexer disabled (--no-index)\x1b[0m');
  }

  // ── Start the reverse proxy ───────────────────────────────────────────────
  const indexUrl = noIndex ? null : `http://localhost:${indexPort}`;
  const proxy = startProxy({ target, port, indexUrl });

  // ── Initialize the isolation server (serves /__om_isolation__ requests) ───
  // Must be done after the proxy starts so `handleIsolationRequest` is wired up.
  initIsolationServer({ projectRoot, devServerBase: target });

  // ── Register indexer with Agent Bridge (spec Phase 5 §8.3) ───────────────
  // Read workspace token from env or ~/.originmain/config.json.
  // If no token is found, skip registration and log a warning.
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  if (!noIndex && indexUrl) {
    const HEARTBEAT_INTERVAL_MS = 120_000; // 120 s — matches server TTL refresh spec
    const TTL_SECONDS           = 300;

    let workspaceToken: string | null = process.env['ORIGINMAIN_WORKSPACE_TOKEN'] ?? null;
    if (!workspaceToken) {
      try {
        const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
        const cfgPath = resolve(homeDir, '.originmain', 'config.json');
        const { readFileSync } = await import('node:fs');
        const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8')) as Record<string, unknown>;
        if (typeof cfg['workspaceToken'] === 'string') workspaceToken = cfg['workspaceToken'];
      } catch { /* config not present — skip registration */ }
    }

    if (workspaceToken) {
      const registerUrl = `${bridgeUrl}/api/agent-bridge/register-indexer`;

      async function registerIndexer(): Promise<void> {
        try {
          const res = await fetch(registerUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workspaceToken}` },
            body:    JSON.stringify({ indexerUrl: indexUrl, ttl: TTL_SECONDS }),
            signal:  AbortSignal.timeout(8_000),
          });
          if (res.ok) {
            console.log(`  \x1b[32m✓\x1b[0m Indexer registered with Agent Bridge (TTL: ${TTL_SECONDS}s)`);
          } else {
            console.warn(`  \x1b[33m⚠\x1b[0m Agent Bridge registration failed: ${res.status}`);
          }
        } catch (err) {
          // Non-fatal — agent features are unavailable but the rest of the CLI works
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  \x1b[33m⚠\x1b[0m Could not reach Agent Bridge (${msg}). Agent features disabled.`);
        }
      }

      async function sendHeartbeat(): Promise<void> {
        try {
          await fetch(registerUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workspaceToken}` },
            body:    JSON.stringify({}), // no indexerUrl = heartbeat path
            signal:  AbortSignal.timeout(5_000),
          });
        } catch { /* non-fatal heartbeat miss */ }
      }

      void registerIndexer();
      heartbeatTimer = setInterval(() => { void sendHeartbeat(); }, HEARTBEAT_INTERVAL_MS);
    } else {
      console.log('  \x1b[2mNot logged in — Agent Bridge integration disabled.\x1b[0m');
      console.log('  \x1b[2mRun \x1b[0moriginmain login\x1b[2m to enable agent features.\x1b[0m');
    }
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  function shutdown(): void {
    console.log('\n  Shutting down...');
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    proxy.close();
    indexServer?.close();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error('  Fatal error:', err);
  process.exit(1);
});
