import type { DesignLanguageFileBody } from './schema.js';

// ── Fluent 2 token mapping ────────────────────────────────────────────────────
// Maps DLF token names to Fluent 2 (Griffel) CSS custom property names.
// A token entry with a `fluentToken` field overrides the default Fluent 2 value.

export type FluentTokenMap = Record<string, string>;

/** Extract color token overrides from a DLF as a Fluent 2 token map. */
export function extractColorTokens(dlf: DesignLanguageFileBody): FluentTokenMap {
  const out: FluentTokenMap = {};
  const colors = dlf.tokens?.colors ?? {};
  for (const [, token] of Object.entries(colors)) {
    if (!token) continue;
    if (token.fluentToken) {
      out[token.fluentToken] = token.value;
    }
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
