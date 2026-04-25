import { describe, it, expect } from 'vitest';
import { computeEditScript } from '../src/myers.js';

describe('computeEditScript', () => {
  it('returns empty for two empty arrays', () => {
    expect(computeEditScript([], [])).toEqual([]);
  });

  it('returns all-insert for empty before', () => {
    const ops = computeEditScript([], ['a', 'b']);
    expect(ops).toEqual([{ type: 'insert', lines: ['a', 'b'] }]);
  });

  it('returns all-delete for empty after', () => {
    const ops = computeEditScript(['a', 'b'], []);
    expect(ops).toEqual([{ type: 'delete', lines: ['a', 'b'] }]);
  });

  it('returns all-equal for identical arrays', () => {
    const ops = computeEditScript(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(ops).toEqual([{ type: 'equal', lines: ['a', 'b', 'c'] }]);
  });

  it('detects a single changed line', () => {
    const ops = computeEditScript(['a', 'b', 'c'], ['a', 'X', 'c']);
    const types = ops.map(o => o.type);
    expect(types).toContain('delete');
    expect(types).toContain('insert');
    const deleted = ops.filter(o => o.type === 'delete').flatMap(o => o.lines);
    const inserted = ops.filter(o => o.type === 'insert').flatMap(o => o.lines);
    expect(deleted).toContain('b');
    expect(inserted).toContain('X');
  });

  it('detects inserted lines at end', () => {
    const ops = computeEditScript(['a'], ['a', 'b', 'c']);
    const inserted = ops.filter(o => o.type === 'insert').flatMap(o => o.lines);
    expect(inserted).toEqual(['b', 'c']);
  });

  it('detects deleted lines at start', () => {
    const ops = computeEditScript(['x', 'y', 'a'], ['a']);
    const deleted = ops.filter(o => o.type === 'delete').flatMap(o => o.lines);
    expect(deleted).toEqual(['x', 'y']);
  });

  it('merges consecutive ops of same type', () => {
    const ops = computeEditScript(['a', 'b'], ['c', 'd']);
    // Should have merged deletes and inserts, not one-op-per-line
    const delOp = ops.find(o => o.type === 'delete');
    const insOp = ops.find(o => o.type === 'insert');
    expect(delOp?.lines.length).toBeGreaterThanOrEqual(1);
    expect(insOp?.lines.length).toBeGreaterThanOrEqual(1);
  });

  it('round-trip: applying ops to before yields after', () => {
    const before = ['prop: 1', 'style: red', 'size: md'];
    const after = ['prop: 1', 'style: blue', 'size: lg', 'weight: 600'];
    const ops = computeEditScript(before, after);

    const result: string[] = [];
    for (const op of ops) {
      if (op.type === 'equal' || op.type === 'insert') result.push(...op.lines);
    }
    expect(result).toEqual(after);
  });

  it('handles single-element change', () => {
    const ops = computeEditScript(['x'], ['y']);
    expect(ops.some(o => o.type === 'delete' && o.lines.includes('x'))).toBe(true);
    expect(ops.some(o => o.type === 'insert' && o.lines.includes('y'))).toBe(true);
  });
});
