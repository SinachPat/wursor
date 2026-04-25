import { describe, it, expect } from 'vitest';
import { serializeSnapshot, serializeValue } from '../src/serialize.js';
import type { ComponentSnapshot } from '../src/schemas.js';

const snap: ComponentSnapshot = {
  id: 'btn-1',
  name: 'Button',
  filePath: 'src/components/Button.tsx',
  props: { variant: 'primary', size: 'md', disabled: false },
  styles: { borderRadius: '8px', background: '#0066FF' },
};

describe('serializeSnapshot', () => {
  it('includes component name and filePath', () => {
    const out = serializeSnapshot(snap);
    expect(out).toContain('Component: Button [src/components/Button.tsx]');
  });

  it('sorts props alphabetically for stable diffs', () => {
    const out = serializeSnapshot(snap);
    const propLines = out.split('\n').filter(l => l.includes(':') && !l.includes('Component'));
    const propNames = propLines
      .map(l => l.trim().split(':')[0]!.trim())
      .filter(k => ['disabled', 'size', 'variant', 'background', 'borderRadius'].includes(k));
    // disabled < size < variant (alphabetical)
    const dIdx = propNames.indexOf('disabled');
    const sIdx = propNames.indexOf('size');
    const vIdx = propNames.indexOf('variant');
    expect(dIdx).toBeLessThan(sIdx);
    expect(sIdx).toBeLessThan(vIdx);
  });

  it('sorts styles alphabetically', () => {
    const out = serializeSnapshot(snap);
    const bgIdx = out.indexOf('background:');
    const brIdx = out.indexOf('borderRadius:');
    expect(bgIdx).toBeLessThan(brIdx);
  });

  it('produces identical output for same input (deterministic)', () => {
    expect(serializeSnapshot(snap)).toBe(serializeSnapshot(snap));
  });

  it('handles component without filePath', () => {
    const out = serializeSnapshot({ id: 'x', name: 'Foo', props: {} });
    expect(out).toBe('Component: Foo');
  });

  it('handles empty props and styles', () => {
    const out = serializeSnapshot({ id: 'x', name: 'Foo', props: {}, styles: {} });
    expect(out).not.toContain('Props:');
    expect(out).not.toContain('Styles:');
  });

  it('serializes nested children', () => {
    const withChild: ComponentSnapshot = {
      ...snap,
      children: [{ id: 'icon', name: 'Icon', props: { name: 'check' } }],
    };
    const out = serializeSnapshot(withChild);
    expect(out).toContain('Children:');
    expect(out).toContain('[0]');
    expect(out).toContain('Component: Icon');
  });
});

describe('serializeValue', () => {
  it('wraps strings in quotes', () => expect(serializeValue('hello')).toBe('"hello"'));
  it('renders numbers as-is', () => expect(serializeValue(42)).toBe('42'));
  it('renders booleans', () => {
    expect(serializeValue(true)).toBe('true');
    expect(serializeValue(false)).toBe('false');
  });
  it('renders null', () => expect(serializeValue(null)).toBe('null'));
  it('renders undefined', () => expect(serializeValue(undefined)).toBe('undefined'));
  it('renders arrays', () => expect(serializeValue([1, 'a'])).toBe('[1, "a"]'));
  it('renders objects with sorted keys', () => {
    expect(serializeValue({ z: 1, a: 2 })).toBe('{ a: 2, z: 1 }');
  });
});
