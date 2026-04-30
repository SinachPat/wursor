#!/usr/bin/env node
// ── CLI bundle script ─────────────────────────────────────────────────────────
// Produces two self-contained ESM bundles under dist/:
//
//   dist/cli.js    — the `originmain` binary (has shebang, chmod +x)
//   dist/index.js  — programmatic API: startProxy(), injectFiberHook()
//
// Run: node build.mjs  (or via "pnpm build")

import { build }                              from 'esbuild';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';

// Node.js built-in module names (without and with the node: prefix).
// Both forms must be listed so esbuild leaves them as-is whether the
// source imports 'http' or 'node:http'.
const NODE_BUILTINS = [
  'node:*',
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
  'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder',
  'sys', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8',
  'vm', 'worker_threads', 'zlib',
];

const SHARED_OPTIONS = {
  bundle:   true,
  platform: 'node',
  format:   'esm',
  target:   'node22',
  external: NODE_BUILTINS,
  logLevel: 'info',
};

// ── Build both entry points in parallel ──────────────────────────────────────

await Promise.all([
  build({ ...SHARED_OPTIONS, entryPoints: ['src/cli.ts'],   outfile: 'dist/cli.js'   }),
  build({ ...SHARED_OPTIONS, entryPoints: ['src/index.ts'], outfile: 'dist/index.js' }),
]);

// ── Add shebang + executable bit to the CLI binary ───────────────────────────

const SHEBANG = '#!/usr/bin/env node\n';
const cliContent = readFileSync('dist/cli.js', 'utf-8');

if (!cliContent.startsWith('#!')) {
  writeFileSync('dist/cli.js', SHEBANG + cliContent, 'utf-8');
}
chmodSync('dist/cli.js', 0o755);

console.log('  ✓ dist/cli.js   (binary)');
console.log('  ✓ dist/index.js (programmatic API)');
