/**
 * resolver.ts — Phase 6
 *
 * Resolves a live CSS value (computed from the selected element) to the closest
 * matching design token, using OKLCH perceptual color distance for colors and
 * exact/near-match for numeric values.
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.3 "Token Resolver"
 */

import { formatHex, oklch, parse as culoriParse, differenceCiede2000 } from 'culori';
import type { DesignToken } from './parser.js';

export interface TokenMatch {
  token: DesignToken;
  /** Value matches token exactly (distance === 0). */
  exact: boolean;
  /** 0 = exact; higher = further from a match. Max useful threshold ≈ 10. */
  distance: number;
}

// ── Color resolution ──────────────────────────────────────────────────────────

const colorDifference = differenceCiede2000();

/**
 * Compute the perceptual color distance between two CSS color strings.
 * Uses CIEDE2000 via culori. Returns Infinity if either value cannot be parsed.
 */
function colorDistance(a: string, b: string): number {
  try {
    const ca = culoriParse(a);
    const cb = culoriParse(b);
    if (!ca || !cb) return Infinity;
    return colorDifference(ca, cb);
  } catch {
    return Infinity;
  }
}

// ── Numeric resolution ────────────────────────────────────────────────────────

function parseNumericPx(value: string): number | null {
  const v = value.trim();
  if (v.endsWith('px')) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  if (v.endsWith('rem')) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n * 16; // normalise with standard 16px base
  }
  const n = parseFloat(v);
  if (!isNaN(n) && v === String(n)) return n;
  return null;
}

function numericDistance(a: string, b: string): number {
  const na = parseNumericPx(a);
  const nb = parseNumericPx(b);
  if (na === null || nb === null) return Infinity;
  return Math.abs(na - nb);
}

// ── Public API ────────────────────────────────────────────────────────────────

const COLOR_DISTANCE_THRESHOLD  = 10;  // CIEDE2000 units (perceptible but close)
const NUMERIC_DISTANCE_THRESHOLD = 2;  // px

/**
 * Find the best matching design token for a given CSS value.
 *
 * @param cssValue  A computed CSS value string (e.g. "rgb(0, 102, 255)", "16px")
 * @param tokens    The loaded token array from the canvas store
 * @param rootFontSizePx  Optional root font size for rem → px normalisation (default 16)
 * @returns TokenMatch or null if no match is within the acceptable threshold
 */
export function resolveValueToToken(
  cssValue: string,
  tokens: DesignToken[],
  rootFontSizePx = 16,
): TokenMatch | null {
  if (!tokens.length || !cssValue.trim()) return null;

  // Normalise the input value to a canonical form
  const normalised = normaliseCssValue(cssValue.trim(), rootFontSizePx);

  let bestMatch: TokenMatch | null = null;
  let bestDistance = Infinity;

  for (const token of tokens) {
    const tokenNorm = normaliseCssValue(token.rawValue, rootFontSizePx);
    let distance: number;

    if (token.type === 'color') {
      distance = colorDistance(normalised, tokenNorm);
      if (distance > COLOR_DISTANCE_THRESHOLD) continue;
    } else {
      distance = numericDistance(normalised, tokenNorm);
      if (distance > NUMERIC_DISTANCE_THRESHOLD) continue;
    }

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { token, exact: distance === 0, distance };
    }
  }

  return bestMatch;
}

/**
 * Find ALL tokens that closely match a value, sorted by distance (closest first).
 * Useful for the TokenPicker dropdown.
 *
 * @param limit   Maximum number of matches to return (default 5)
 */
export function resolveValueToTokens(
  cssValue: string,
  tokens: DesignToken[],
  rootFontSizePx = 16,
  limit = 5,
): TokenMatch[] {
  if (!tokens.length || !cssValue.trim()) return [];

  const normalised = normaliseCssValue(cssValue.trim(), rootFontSizePx);
  const matches: TokenMatch[] = [];

  for (const token of tokens) {
    const tokenNorm = normaliseCssValue(token.rawValue, rootFontSizePx);
    let distance: number;

    if (token.type === 'color') {
      distance = colorDistance(normalised, tokenNorm);
      if (distance > COLOR_DISTANCE_THRESHOLD) continue;
    } else {
      distance = numericDistance(normalised, tokenNorm);
      if (distance > NUMERIC_DISTANCE_THRESHOLD) continue;
    }

    matches.push({ token, exact: distance === 0, distance });
  }

  return matches
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Given a token key (CSS custom property), look it up in the token array.
 */
export function findTokenByKey(key: string, tokens: DesignToken[]): DesignToken | undefined {
  return tokens.find((t) => t.key === key);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a CSS value to a canonical form for comparison.
 * - Colors: convert to hex via culori
 * - rem values: convert to px using the root font size
 * - Everything else: lowercase trim
 */
function normaliseCssValue(value: string, rootFontSizePx: number): string {
  const v = value.trim().toLowerCase();

  // Try color parsing
  try {
    const parsed = culoriParse(v);
    if (parsed) {
      return formatHex(parsed) ?? v;
    }
  } catch { /* not a color */ }

  // rem → px
  if (v.endsWith('rem')) {
    const n = parseFloat(v);
    if (!isNaN(n)) return `${n * rootFontSizePx}px`;
  }

  return v;
}

// ── OKLCH color info (for UI display) ────────────────────────────────────────

export interface OklchInfo {
  l: number; // lightness 0–1
  c: number; // chroma
  h: number; // hue 0–360
}

/**
 * Parse a CSS color string into OKLCH components.
 * Returns null if the color cannot be parsed.
 */
export function parseOklch(color: string): OklchInfo | null {
  try {
    const parsed = culoriParse(color);
    if (!parsed) return null;
    const ok = oklch(parsed);
    if (!ok) return null;
    return { l: ok.l ?? 0, c: ok.c ?? 0, h: ok.h ?? 0 };
  } catch {
    return null;
  }
}
