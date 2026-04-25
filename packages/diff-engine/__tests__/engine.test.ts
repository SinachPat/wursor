import { describe, it, expect } from 'vitest';
import { computeDiff, diffComponents } from '../src/engine.js';
import type { ComponentSnapshot } from '../src/schemas.js';

const btn: ComponentSnapshot = {
  id: 'btn-1',
  name: 'Button',
  filePath: 'src/components/Button.tsx',
  props: { variant: 'primary', size: 'md', disabled: false },
  styles: { background: '#0066FF', borderRadius: '8px' },
};

describe('computeDiff', () => {
  it('marks unchanged when nothing changed', () => {
    const d = computeDiff(btn, btn);
    expect(d.changeType).toBe('unchanged');
    expect(d.propChanges).toHaveLength(0);
    expect(d.styleChanges).toHaveLength(0);
    expect(d.patch).toBe('');
  });

  it('detects modified prop', () => {
    const after = { ...btn, props: { ...btn.props, size: 'lg' } };
    const d = computeDiff(btn, after);
    expect(d.changeType).toBe('modified');
    const change = d.propChanges.find(c => c.key === 'size');
    expect(change?.before).toBe('md');
    expect(change?.after).toBe('lg');
    expect(change?.changeType).toBe('modified');
  });

  it('detects added prop', () => {
    const after = { ...btn, props: { ...btn.props, loading: true } };
    const d = computeDiff(btn, after);
    const change = d.propChanges.find(c => c.key === 'loading');
    expect(change?.changeType).toBe('added');
    expect(change?.before).toBeUndefined();
    expect(change?.after).toBe(true);
  });

  it('detects removed prop', () => {
    const { disabled: _, ...remaining } = btn.props;
    const after = { ...btn, props: remaining };
    const d = computeDiff(btn, after);
    const change = d.propChanges.find(c => c.key === 'disabled');
    expect(change?.changeType).toBe('removed');
    expect(change?.before).toBe(false);
    expect(change?.after).toBeUndefined();
  });

  it('detects style change', () => {
    const after = { ...btn, styles: { ...btn.styles, borderRadius: '12px' } };
    const d = computeDiff(btn, after);
    const change = d.styleChanges.find(c => c.key === 'borderRadius');
    expect(change?.before).toBe('8px');
    expect(change?.after).toBe('12px');
  });

  it('generates a non-empty patch when changed', () => {
    const after = { ...btn, props: { ...btn.props, size: 'xl' } };
    const d = computeDiff(btn, after);
    expect(d.patch).toBeTruthy();
    expect(d.patch).toContain('--- a/');
    expect(d.patch).toContain('+++ b/');
  });

  it('propagates id and name from after snapshot', () => {
    const d = computeDiff(btn, { ...btn, name: 'IconButton' });
    expect(d.name).toBe('IconButton');
    expect(d.id).toBe(btn.id);
  });

  it('deep-equal objects are unchanged', () => {
    const snap: ComponentSnapshot = {
      id: 'x',
      name: 'X',
      props: { config: { a: 1, b: [2, 3] } },
    };
    const d = computeDiff(snap, { ...snap, props: { config: { a: 1, b: [2, 3] } } });
    expect(d.changeType).toBe('unchanged');
  });

  it('deep-equal objects with different value are modified', () => {
    const snap: ComponentSnapshot = {
      id: 'x',
      name: 'X',
      props: { config: { a: 1, b: [2, 3] } },
    };
    const d = computeDiff(snap, { ...snap, props: { config: { a: 1, b: [2, 99] } } });
    expect(d.changeType).toBe('modified');
  });

  it('handles added child', () => {
    const child: ComponentSnapshot = { id: 'c1', name: 'Icon', props: { name: 'check' } };
    const before: ComponentSnapshot = { id: 'x', name: 'X', props: {}, children: [] };
    const after: ComponentSnapshot = { ...before, children: [child] };
    const d = computeDiff(before, after);
    expect(d.childDiffs).toBeDefined();
    expect(d.childDiffs![0]?.changeType).toBe('added');
  });

  it('handles removed child', () => {
    const child: ComponentSnapshot = { id: 'c1', name: 'Icon', props: { name: 'check' } };
    const before: ComponentSnapshot = { id: 'x', name: 'X', props: {}, children: [child] };
    const after: ComponentSnapshot = { ...before, children: [] };
    const d = computeDiff(before, after);
    expect(d.childDiffs).toBeDefined();
    expect(d.childDiffs![0]?.changeType).toBe('removed');
  });

  it('omits childDiffs when no child changes', () => {
    const child: ComponentSnapshot = { id: 'c1', name: 'Icon', props: { name: 'check' } };
    const snap: ComponentSnapshot = { id: 'x', name: 'X', props: {}, children: [child] };
    const d = computeDiff(snap, snap);
    expect(d.childDiffs).toBeUndefined();
  });
});

describe('diffComponents', () => {
  it('returns diff and patch at top level', () => {
    const after = { ...btn, props: { ...btn.props, size: 'xl' } };
    const result = diffComponents(btn, after);
    expect(result.diff.changeType).toBe('modified');
    expect(result.patch).toBe(result.diff.patch);
    expect(result.patch).toBeTruthy();
  });

  it('patch and diff.patch are identical', () => {
    const result = diffComponents(btn, btn);
    expect(result.patch).toBe('');
    expect(result.diff.patch).toBe('');
  });
});
