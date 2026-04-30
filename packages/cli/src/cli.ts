#!/usr/bin/env node

// ── Originmain CLI ───────────────────────────────────────────────────────────
// Usage:
//   npx @originmain/cli dev --target http://localhost:3000 [--port 4170]
//
// Starts a reverse proxy that enables live React component inspection
// in Originmain artboards. See RENDERING-ARCHITECTURE.md for details.

import { parseArgs } from 'node:util';
import { startProxy } from './proxy.js';

const DEFAULT_PORT = 4170;

function printUsage(): void {
  console.log(`
  \x1b[36m\x1b[1mOriginmain CLI\x1b[0m

  Usage:
    originmain dev --target <url> [--port <number>]

  Options:
    --target, -t   Target dev server URL (required)
                   Example: http://localhost:3000
    --port, -p     Proxy listen port (default: ${DEFAULT_PORT})
    --help, -h     Show this help

  Example:
    npx @originmain/cli dev --target http://localhost:3000
`);
}

function main(): void {
  // Parse arguments
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      target: { type: 'string', short: 't' },
      port:   { type: 'string', short: 'p' },
      help:   { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0];

  if (values.help || !command) {
    printUsage();
    // --help is a success; missing command is a usage error.
    process.exit(values.help ? 0 : 1);
  }

  if (command !== 'dev') {
    console.error(`  Unknown command: ${command}\n  Run "originmain --help" for usage.`);
    process.exit(1);
  }

  // Validate --target
  const target = values.target;
  if (!target || typeof target !== 'string') {
    console.error('  Error: --target is required.\n  Example: originmain dev --target http://localhost:3000');
    process.exit(1);
  }

  // Validate target URL
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    console.error(`  Error: Invalid target URL: ${target}`);
    process.exit(1);
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    console.error(`  Error: Target must be http:// or https:// (got ${targetUrl.protocol})`);
    process.exit(1);
  }

  // Parse port
  const port = values.port ? parseInt(values.port as string, 10) : DEFAULT_PORT;
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error(`  Error: Invalid port: ${values.port}`);
    process.exit(1);
  }

  // Start proxy
  const proxy = startProxy({ target, port });

  // Graceful shutdown
  function shutdown(): void {
    console.log('\n  Shutting down proxy...');
    proxy.close();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
