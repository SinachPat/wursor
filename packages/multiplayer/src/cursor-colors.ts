// ── Cursor colour palette ─────────────────────────────────────────────────────
// 12-colour WCAG AA-passing palette for presence cursors.
// Colours are assigned deterministically by user ID so they're stable across reconnects.

const PALETTE = [
  '#E03D3D', // red
  '#E07B3D', // orange
  '#D4A017', // amber
  '#4CAF50', // green
  '#2196F3', // blue
  '#9C27B0', // purple
  '#00BCD4', // cyan
  '#FF4081', // pink
  '#8BC34A', // lime
  '#FF5722', // deep-orange
  '#3F51B5', // indigo
  '#009688', // teal
] as const;

/** Assigns a cursor colour to a user ID deterministically. */
export function cursorColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const color = PALETTE[hash % PALETTE.length];
  return color ?? PALETTE[0];
}

export { PALETTE as CURSOR_PALETTE };
