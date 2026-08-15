import { describe, it, expect } from 'vitest';
import { loadPrompts } from '../src/load-prompts.ts';
import { loadSite } from '../src/load-site.ts';

describe('golden prompts', () => {
  it('loads twenty prompts', () => {
    expect(loadPrompts()).toHaveLength(20);
  });

  it('covers at least two site fixtures', () => {
    expect(new Set(loadPrompts().map((p) => p.site)).size).toBeGreaterThanOrEqual(2);
  });

  it('gives every prompt a preview_text, option, or screenshot assertion', () => {
    const types = new Set(loadPrompts().map((p) => p.assert.type));
    expect([...types].every((t) => t === 'preview_text' || t === 'option' || t === 'screenshot')).toBe(true);
  });

  it('points every prompt at a site fixture that exists', () => {
    expect(loadPrompts().every((p) => loadSite(p.site).id === p.site)).toBe(true);
  });
});
