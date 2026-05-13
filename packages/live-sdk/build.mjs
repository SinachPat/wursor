#!/usr/bin/env node
// ── @originmain/live build script ────────────────────────────────────────────
// Produces a single self-contained browser ESM bundle under dist/:
//
//   dist/index.js  — side-effect-only browser module, no external deps
//
// Run: node build.mjs  (or via "pnpm build")
//
// Design notes:
//  • Platform 'browser' — esbuild replaces process.env.NODE_ENV and
//    avoids injecting Node built-in shims.
//  • format 'esm' — the published package is "type": "module"; webpack/
//    turbopack will tree-shake and include it in the user's bundle.
//  • bundle: true — @originmain/live has no runtime npm dependencies so
//    bundling produces one fully self-contained file with no require() calls.
//  • minify: true — the hook ships inside the user's production bundle;
//    every byte matters.
//  • No type declarations needed — the package is a side-effect-only import
//    (`import '@originmain/live'`) with no exported symbols.

import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle:      true,
  platform:    'browser',
  format:      'esm',
  target:      ['es2020', 'chrome88', 'firefox78', 'safari14'],
  minify:      true,
  sourcemap:   false,   // keep bundle clean; source is MIT-licensed anyway
  outfile:     'dist/index.js',
  logLevel:    'info',
});

console.log('  ✓ dist/index.js  (browser ESM bundle)');
