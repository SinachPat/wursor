#!/usr/bin/env node
// ── @originmain/next build script ────────────────────────────────────────────
// Produces ESM + CJS bundles and TypeScript declarations under dist/:
//
//   dist/index.js   — ESM bundle for next.config.mjs / next.config.ts
//   dist/index.cjs  — CJS bundle for next.config.js (legacy require())
//   dist/index.d.ts — TypeScript declarations for withOriginmain()
//
// Run: node build.mjs  (or via "pnpm build")

import { build }                     from 'esbuild';
import { execFileSync }              from 'node:child_process';
import { createRequire }             from 'node:module';

const req = createRequire(import.meta.url);
// Resolve the tsc binary explicitly — avoids relying on PATH.
const tscBin = req.resolve('typescript/bin/tsc');

const SHARED = {
  entryPoints: ['src/index.ts'],
  bundle:      true,
  platform:    'node',
  target:      ['node18'],
  // 'next' is a peer dep — leave it external so users' own copy is used.
  external:    ['next'],
  logLevel:    'info',
};

// ── ESM bundle ────────────────────────────────────────────────────────────────
await build({
  ...SHARED,
  format:  'esm',
  outfile: 'dist/index.js',
});

// ── CJS bundle ────────────────────────────────────────────────────────────────
// Required for projects where next.config.js uses module.exports = ...
await build({
  ...SHARED,
  format:  'cjs',
  outfile: 'dist/index.cjs',
});

// ── TypeScript declarations ───────────────────────────────────────────────────
// withOriginmain() is a typed export — consumers need the .d.ts so their IDE
// and type-checker know the function's signature.
execFileSync(process.execPath, [tscBin, '--project', 'tsconfig.build.json'], {
  stdio: 'inherit',
});

console.log('  ✓ dist/index.js   (ESM)');
console.log('  ✓ dist/index.cjs  (CJS)');
console.log('  ✓ dist/index.d.ts (types)');
