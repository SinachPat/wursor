import { describe, it, expect } from 'vitest';
import { generatePatch } from '../src/patch.js';

const A = `Component: Button
Props:
  size: "md"
  variant: "primary"
Styles:
  background: #0066FF
  borderRadius: 8px
`;

const B = `Component: Button
Props:
  size: "lg"
  variant: "primary"
Styles:
  background: #0066FF
  borderRadius: 12px
`;

describe('generatePatch', () => {
  it('returns empty string for identical inputs', () => {
    expect(generatePatch(A, A)).toBe('');
  });

  it('returns empty string for two empty strings', () => {
    expect(generatePatch('', '')).toBe('');
  });

  it('includes --- and +++ headers', () => {
    const patch = generatePatch(A, B);
    expect(patch).toMatch(/^--- a\//m);
    expect(patch).toMatch(/^\+\+\+ b\//m);
  });

  it('includes @@ hunk header', () => {
    const patch = generatePatch(A, B);
    expect(patch).toMatch(/^@@ /m);
  });

  it('marks changed lines correctly', () => {
    const patch = generatePatch(A, B);
    expect(patch).toContain('-  size: "md"');
    expect(patch).toContain('+  size: "lg"');
    expect(patch).toContain('-  borderRadius: 8px');
    expect(patch).toContain('+  borderRadius: 12px');
  });

  it('preserves unchanged lines as context', () => {
    const patch = generatePatch(A, B);
    expect(patch).toContain('   variant: "primary"');
  });

  it('uses custom filename in headers', () => {
    const patch = generatePatch(A, B, { filename: 'Button.tsx' });
    expect(patch).toContain('--- a/Button.tsx');
    expect(patch).toContain('+++ b/Button.tsx');
  });

  it('handles all-insert (empty before)', () => {
    const patch = generatePatch('', 'line1\nline2\n');
    expect(patch).toContain('+line1');
    expect(patch).toContain('+line2');
  });

  it('handles all-delete (empty after)', () => {
    const patch = generatePatch('line1\nline2\n', '');
    expect(patch).toContain('-line1');
    expect(patch).toContain('-line2');
  });

  it('produces multiple hunks when changes are far apart', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n') + '\n';
    const after = before
      .replace('line0', 'CHANGED0')
      .replace('line19', 'CHANGED19');
    const patch = generatePatch(before, after);
    const hunkCount = (patch.match(/^@@/gm) ?? []).length;
    expect(hunkCount).toBe(2);
  });

  it('merges nearby hunks into one', () => {
    const before = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n') + '\n';
    const after = before.replace('line0', 'X').replace('line1', 'Y');
    const patch = generatePatch(before, after);
    const hunkCount = (patch.match(/^@@/gm) ?? []).length;
    expect(hunkCount).toBe(1);
  });
});
