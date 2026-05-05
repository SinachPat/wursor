// ── Canvas store shared types ─────────────────────────────────────────────────
// Kept in a separate file so canvas.ts can import them in a type-only position
// without circular dependency issues.

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

/** A single normalised design token from any of the three supported input formats
 *  (Style Dictionary, W3C DTCG, flat CSS variable map — see Phase 6 spec §9.2). */
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

export interface TokenMatch {
  token: DesignToken;
  /** Value matches token exactly (distance === 0). */
  exact: boolean;
  /** 0 = exact; higher = further from a match. */
  distance: number;
}
