// ── Framework & CSS Strategy Detection ───────────────────────────────────────
// Canonical detection logic for the Originmain CLI — used by indexer.ts,
// index-server.ts, and isolation-server.ts. Import from here; do not duplicate.
//
// Detection is best-effort and parse-only (no module resolution).
// Priority: explicit config files > package.json dependency names.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'tinyglobby';

export type Framework = 'next' | 'vite' | 'remix' | 'generic';

export interface ProjectMeta {
  framework: Framework;
  tailwind: boolean;
  cssModules: boolean;
  styledComponents: boolean;
}

/** Read and JSON-parse package.json from projectRoot, returning {} on any error. */
function readPackageJson(projectRoot: string): Record<string, unknown> {
  try {
    const raw = readFileSync(join(projectRoot, 'package.json'), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Return true if any of the given patterns exist as a file in projectRoot. */
function anyFileExists(projectRoot: string, patterns: string[]): boolean {
  return patterns.some((p) => existsSync(join(projectRoot, p)));
}

/** Return true if name appears in the combined deps+devDeps of the package. */
function hasDep(pkg: Record<string, unknown>, ...names: string[]): boolean {
  const deps    = (pkg['dependencies']    ?? {}) as Record<string, unknown>;
  const devDeps = (pkg['devDependencies'] ?? {}) as Record<string, unknown>;
  return names.some((n) => n in deps || n in devDeps);
}

/**
 * Detect the JS framework used in projectRoot.
 *
 * Priority order:
 *   1. `next` in package.json dependencies  → 'next'
 *   2. remix.config.* in root               → 'remix'
 *   3. vite.config.* in root                → 'vite'
 *   4. `vite` in devDependencies            → 'vite'
 *   5. fallback                             → 'generic'
 */
export function detectFramework(projectRoot: string): Framework {
  const pkg = readPackageJson(projectRoot);

  if (hasDep(pkg, 'next')) return 'next';

  if (anyFileExists(projectRoot, [
    'remix.config.js', 'remix.config.ts', 'remix.config.mjs', 'remix.config.cjs',
  ])) return 'remix';

  if (anyFileExists(projectRoot, [
    'vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs',
  ])) return 'vite';

  if (hasDep(pkg, 'vite')) return 'vite';

  return 'generic';
}

/**
 * Detect CSS strategy flags:
 *   tailwind        — tailwind.config.* exists OR 'tailwindcss' in deps
 *   cssModules      — any *.module.css exists in projectRoot (checked via glob)
 *   styledComponents — 'styled-components' OR '@emotion/react' in deps
 *
 * `cssModules` detection uses a glob walk and may be slow on large projects;
 * callers should invoke this once at startup and cache the result.
 */
export async function detectCssStrategy(projectRoot: string): Promise<{
  tailwind: boolean;
  cssModules: boolean;
  styledComponents: boolean;
}> {
  const pkg = readPackageJson(projectRoot);

  const tailwind = hasDep(pkg, 'tailwindcss') || anyFileExists(projectRoot, [
    'tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs', 'tailwind.config.cjs',
  ]);

  const styledComponents = hasDep(
    pkg,
    'styled-components', '@emotion/react', '@emotion/styled',
  );

  // Glob walk for *.module.css — skip node_modules. Uses tinyglobby for
  // cross-platform support on Node 20 LTS (node:fs/promises glob is Node 22+).
  let cssModules = false;
  try {
    const matches = await glob('**/*.module.css', {
      cwd: projectRoot,
      ignore: ['**/node_modules/**', '**/.git/**'],
      onlyFiles: true,
      // Stop early: we only need one match.
      // tinyglobby doesn't have a native limit, but the search is fast enough.
    });
    cssModules = matches.length > 0;
  } catch {
    cssModules = false;
  }

  return { tailwind, cssModules, styledComponents };
}

/**
 * Detect all project metadata in one call.
 * Returns synchronously for framework; async for CSS strategy.
 */
export async function detectProjectMeta(projectRoot: string): Promise<ProjectMeta> {
  const framework = detectFramework(projectRoot);
  const css       = await detectCssStrategy(projectRoot);
  return { framework, ...css };
}
