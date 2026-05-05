/**
 * parser.ts — Phase 6
 *
 * Parses design token files into the normalised DesignToken[] format used by
 * the canvas store and token resolver.
 *
 * Supported input formats (auto-detected from the top-level structure):
 *   1. W3C DTCG  — uses $value / $type fields (https://design-tokens.github.io/community-group/format/)
 *   2. Style Dictionary — nested groups, each leaf has { value, ... }
 *   3. Flat CSS variable map — { "--color-primary": "#FF0066", ... }
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.2 "Design Language System"
 */

// ── DesignToken type (mirrors canvas.types.ts in the app package) ─────────────
// Duplicated here to avoid a cross-package import at runtime.

export type TokenType =
  | 'color'
  | 'spacing'
  | 'sizing'
  | 'borderRadius'
  | 'borderWidth'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'shadow'
  | 'opacity'
  | 'other';

export interface DesignToken {
  /** CSS custom property name: "--color-primary" */
  key: string;
  /** Human label: "Color / Primary" */
  name: string;
  /** Top-level group: "color", "spacing", etc. */
  group: string;
  /** Resolved CSS value: "#0066FF" */
  rawValue: string;
  type: TokenType;
  description?: string;
  /** If resolved from an alias chain, lists each intermediate key. */
  aliasChain?: string[];
}

// ── Format detection ──────────────────────────────────────────────────────────

type TokenFileFormat = 'dtcg' | 'style-dictionary' | 'flat-css-vars';

function detectFormat(raw: Record<string, unknown>): TokenFileFormat {
  // Flat CSS var map: all keys start with "--"
  const keys = Object.keys(raw);
  if (keys.length > 0 && keys.every((k) => k.startsWith('--'))) {
    return 'flat-css-vars';
  }

  // DTCG: any value node uses $value / $type
  const hasW3cNodes = keys.some((k) => {
    const v = raw[k];
    return v && typeof v === 'object' && ('$value' in (v as object) || '$type' in (v as object));
  });
  if (hasW3cNodes) return 'dtcg';

  // Assume Style Dictionary for everything else
  return 'style-dictionary';
}

// ── Flat CSS var format ───────────────────────────────────────────────────────

function parseFlatCssVars(raw: Record<string, unknown>): DesignToken[] {
  const tokens: DesignToken[] = [];
  for (const [key, val] of Object.entries(raw)) {
    if (!key.startsWith('--')) continue;
    const rawValue = String(val ?? '').trim();
    if (!rawValue) continue;

    // Derive group from the property name: "--color-primary-500" → "color"
    const withoutDashes = key.replace(/^--/, '');
    const parts = withoutDashes.split('-');
    const group = parts[0] ?? 'other';
    const name = parts.slice(1).map(capitalise).join(' ') || withoutDashes;

    tokens.push({
      key,
      name: `${capitalise(group)} / ${name}`,
      group,
      rawValue,
      type: inferTokenType(group, rawValue),
    });
  }
  return tokens;
}

// ── W3C DTCG format ───────────────────────────────────────────────────────────

function parseDtcg(raw: Record<string, unknown>, pathParts: string[] = []): DesignToken[] {
  const tokens: DesignToken[] = [];

  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith('$')) continue; // skip $metadata, $description etc.
    if (!val || typeof val !== 'object') continue;

    const node = val as Record<string, unknown>;

    if ('$value' in node) {
      // Leaf token
      const rawValue = resolveAlias(String(node['$value'] ?? '').trim(), raw);
      if (!rawValue) continue;

      const fullPath = [...pathParts, key];
      const group = fullPath[0] ?? 'other';
      // §9.2: each segment passes through toKebabCase before joining so that
      // camelCase group names (e.g. "borderRadius") produce correct CSS names.
      const cssKey = `--${fullPath.map(toKebabCase).join('-').replace(/\s+/g, '-')}`;

      tokens.push({
        key: cssKey,
        name: fullPath.map(capitalise).join(' / '),
        group,
        rawValue,
        type: inferTokenTypeFromDtcg(String(node['$type'] ?? ''), rawValue),
        ...(typeof node['$description'] === 'string' && { description: node['$description'] }),
      });
    } else {
      // Group node — recurse
      tokens.push(...parseDtcg(node, [...pathParts, key]));
    }
  }

  return tokens;
}

// ── Style Dictionary format ───────────────────────────────────────────────────

function parseStyleDictionary(raw: Record<string, unknown>, pathParts: string[] = []): DesignToken[] {
  const tokens: DesignToken[] = [];

  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;

    const node = val as Record<string, unknown>;

    if ('value' in node && typeof node['value'] !== 'object') {
      // Leaf token
      const rawValue = String(node['value'] ?? '').trim();
      if (!rawValue) continue;

      const fullPath = [...pathParts, key];
      const group = fullPath[0] ?? 'other';
      // §9.2: each segment passes through toKebabCase before joining.
      const cssKey = `--${fullPath.map(toKebabCase).join('-').replace(/\s+/g, '-')}`;

      tokens.push({
        key: cssKey,
        name: fullPath.map(capitalise).join(' / '),
        group,
        rawValue,
        type: inferTokenType(group, rawValue),
        ...(typeof node['comment'] === 'string' && { description: node['comment'] }),
      });
    } else {
      // Group node — recurse
      tokens.push(...parseStyleDictionary(node, [...pathParts, key]));
    }
  }

  return tokens;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a raw token file (parsed JSON/JS object) into a flat DesignToken[].
 * Auto-detects the format from the object structure.
 *
 * @param raw   Parsed token file contents (not a JSON string — call JSON.parse first)
 * @returns     Flat array of normalised design tokens
 * @throws      If the input is not a plain object or if parsing fails
 */
export function parseTokenFile(raw: unknown): DesignToken[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Token file must be a plain JSON object');
  }

  const obj = raw as Record<string, unknown>;
  const format = detectFormat(obj);

  switch (format) {
    case 'flat-css-vars':
      return parseFlatCssVars(obj);
    case 'dtcg':
      return parseDtcg(obj);
    case 'style-dictionary':
      return parseStyleDictionary(obj);
  }
}

/**
 * Parse a JSON string token file.
 */
export function parseTokenFileJson(jsonString: string): DesignToken[] {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parseTokenFile(raw);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a camelCase or PascalCase path segment to kebab-case.
 * Used when building CSS custom property names from token path segments so that
 * e.g. `{ "borderRadius": { "sm": ... } }` → `--border-radius-sm` instead of
 * `--borderradius-sm`.
 *
 * spec: SOURCE-AWARE-CANVAS §9.2 "camelCase segments are converted to kebab-case"
 *
 * Examples:
 *   "borderRadius"  → "border-radius"
 *   "fontSize"      → "font-size"
 *   "Color"         → "color"        (leading-hyphen guard prevents "---color-primary")
 *   "BoxShadow"     → "box-shadow"
 */
export function toKebabCase(s: string): string {
  return s
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, ''); // strip leading hyphen produced by an initial uppercase letter
}

function inferTokenType(group: string, value: string): TokenType {
  const g = group.toLowerCase();
  if (g === 'color' || g === 'colors' || g === 'colour') return 'color';
  if (g === 'spacing' || g === 'space') return 'spacing';
  if (g === 'sizing' || g === 'size') return 'sizing';
  if (g === 'radius' || g === 'border-radius' || g === 'borderradius') return 'borderRadius';
  if (g === 'border-width' || g === 'borderwidth') return 'borderWidth';
  if (g === 'font-family' || g === 'fontfamily') return 'fontFamily';
  if (g === 'font-size' || g === 'fontsize') return 'fontSize';
  if (g === 'font-weight' || g === 'fontweight') return 'fontWeight';
  if (g === 'line-height' || g === 'lineheight') return 'lineHeight';
  if (g === 'letter-spacing' || g === 'letterspacing') return 'letterSpacing';
  if (g === 'shadow' || g === 'box-shadow') return 'shadow';
  if (g === 'opacity') return 'opacity';
  // Fallback: infer from value
  return inferTokenTypeFromValue(value);
}

function inferTokenTypeFromDtcg(dtcgType: string, value: string): TokenType {
  switch (dtcgType.toLowerCase()) {
    case 'color':         return 'color';
    case 'dimension':
    case 'spacing':       return 'spacing';
    case 'font-family':   return 'fontFamily';
    case 'font-size':     return 'fontSize';
    case 'font-weight':   return 'fontWeight';
    case 'line-height':   return 'lineHeight';
    case 'letter-spacing':return 'letterSpacing';
    case 'shadow':        return 'shadow';
    case 'opacity':       return 'opacity';
    case 'border-radius': return 'borderRadius';
    default:              return inferTokenTypeFromValue(value);
  }
}

function inferTokenTypeFromValue(value: string): TokenType {
  const v = value.toLowerCase().trim();
  if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl') || v.startsWith('oklch')) return 'color';
  if (v.endsWith('px') || v.endsWith('rem') || v.endsWith('em')) return 'spacing';
  if (v.includes('shadow') || v.includes('blur')) return 'shadow';
  return 'other';
}

/**
 * Resolve a DTCG alias like "{color.primary.500}" to a flat CSS value.
 * Returns the alias string unchanged if it cannot be resolved.
 */
function resolveAlias(value: string, root: Record<string, unknown>): string {
  const aliasMatch = value.match(/^\{(.+)\}$/);
  if (!aliasMatch?.[1]) return value;

  const path = aliasMatch[1].split('.');
  let cursor: unknown = root;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') return value;
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  if (cursor && typeof cursor === 'object' && '$value' in (cursor as object)) {
    return String((cursor as Record<string, unknown>)['$value'] ?? value);
  }
  if (typeof cursor === 'string') return cursor;
  return value;
}
