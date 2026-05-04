import type { DesignLanguageFileBody } from './schema.js';

// ── Fluent 2 token mapping ────────────────────────────────────────────────────
// Maps DLF token names to Fluent 2 (Griffel) CSS custom property names.
// A token entry with a `fluentToken` field overrides the default Fluent 2 value.

export type FluentTokenMap = Record<string, string>;

/**
 * Extract color tokens from a DLF as a Fluent 2 token map.
 * Tokens are flat strings (spec Layer 5.1: tokens.colors is Record<string,string>),
 * so each key becomes a CSS custom property name and the value is the CSS value.
 */
export function extractColorTokens(dlf: DesignLanguageFileBody): FluentTokenMap {
  const out: FluentTokenMap = {};
  const colors = dlf.tokens?.colors ?? {};
  for (const [name, value] of Object.entries(colors)) {
    if (value) out[name] = value;
  }
  return out;
}

/** Convert a Fluent 2 token map to CSS custom properties for injection. */
export function tokensToCssVars(tokens: FluentTokenMap): string {
  const entries = Object.entries(tokens)
    .map(([name, value]) => `  --${camelToKebab(name)}: ${value};`)
    .join('\n');
  return `:root {\n${entries}\n}`;
}

/** Convert a DLF to a CSS var block suitable for injection into the renderer iframe. */
export function dlfToCssVars(dlf: DesignLanguageFileBody): string {
  return tokensToCssVars(extractColorTokens(dlf));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`);
}

/** Build a short human-readable summary of the DLF's token count for logging. */
export function dlfSummary(dlf: DesignLanguageFileBody): string {
  const tokenCounts = {
    colors: Object.keys(dlf.tokens?.colors ?? {}).length,
    typography: Object.keys(dlf.tokens?.typography ?? {}).length,
    spacing: Object.keys(dlf.tokens?.spacing ?? {}).length,
    components: Object.keys(dlf.components ?? {}).length,
    screens: Object.keys(dlf.screens ?? {}).length,
  };
  return Object.entries(tokenCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
}
