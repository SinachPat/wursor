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
import { createRequire }                      from 'node:module';

const req = createRequire(import.meta.url);

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
  // typescript uses CJS require() for Node built-ins internally — bundling it
  // into an ESM output causes "Dynamic require of 'fs' is not supported".
  // Leave it external so Node resolves it from node_modules at runtime.
  'typescript',
];

// ── html2canvas text-embed plugin ────────────────────────────────────────────
// Intercepts the import of html2canvas/dist/html2canvas.min.js and returns
// its content as a default-exported string, so the proxy can serve it
// locally (GET /__om_h2c__.js) without any CDN or runtime file reads.
const html2canvasTextPlugin = {
  name: 'html2canvas-text',
  setup(build) {
    build.onResolve({ filter: /html2canvas\.min\.js$/ }, (args) => ({
      path: req.resolve('html2canvas/dist/html2canvas.min.js'),
      namespace: 'h2c-text',
    }));
    build.onLoad({ filter: /.*/, namespace: 'h2c-text' }, (args) => {
      const text = readFileSync(args.path, 'utf-8');
      return { contents: `export default ${JSON.stringify(text)}`, loader: 'js' };
    });
  },
};

const SHARED_OPTIONS = {
  bundle:   true,
  platform: 'node',
  format:   'esm',
  target:   'node22',
  external: NODE_BUILTINS,
  plugins:  [html2canvasTextPlugin],
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
