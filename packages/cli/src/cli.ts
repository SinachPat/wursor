#!/usr/bin/env node

// ── Originmain CLI ───────────────────────────────────────────────────────────
// Usage:
//   npx @originmain/cli dev --target http://localhost:3000 [--port 4170]
//                          [--index-port 4171] [--no-index]
//
// Starts a reverse proxy + optional AST indexer for live React component
// inspection in Originmain artboards. See SOURCE-AWARE-CANVAS.md for details.

import { parseArgs }        from 'node:util';
import { resolve }          from 'node:path';
import { startProxy }       from './proxy.js';
import { Indexer }          from './indexer.js';
import { startIndexServer } from './index-server.js';
import { detectProjectMeta } from './detect-framework.js';

const DEFAULT_PORT       = 4170;
const DEFAULT_INDEX_PORT = 4171;

function printUsage(): void {
  console.log(`
  \x1b[36m\x1b[1mOriginmain CLI\x1b[0m

  Usage:
    originmain dev --target <url> [options]

  Options:
    --target, -t       Target dev server URL (required)
                       Example: http://localhost:3000
    --port, -p         Proxy listen port (default: ${DEFAULT_PORT})
    --index-port       AST indexer API port (default: ${DEFAULT_INDEX_PORT})
    --no-index         Disable the AST indexer (Props/Code tabs degraded)
    --help, -h         Show this help

  Environment variables:
    ORIGINMAIN_BRIDGE_URL  Agent Bridge URL (default: http://localhost:4172)

  Examples:
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

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  function shutdown(): void {
    console.log('\n  Shutting down...');
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
