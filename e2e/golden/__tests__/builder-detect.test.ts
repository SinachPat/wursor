import { describe, it, expect } from 'vitest';
import { detectBuilder } from '../src/builder-detect.ts';

describe('detectBuilder', () => {
  it('reports elementor when the plugin is active and post meta has _elementor_edit_mode', () => {
    expect(
      detectBuilder({
        theme: 'hello-elementor',
        plugins: [{ slug: 'elementor', active: true }],
        posts: [{ id: 1, slug: 'home', title: 'Home', content: '', meta: { _elementor_edit_mode: 'builder' } }],
      }),
    ).toBe('elementor');
  });

  it('reports beaver when beaver-builder is active and _fl_builder_data is present', () => {
    expect(
      detectBuilder({
        theme: 'bb-theme',
        plugins: [{ slug: 'beaver-builder-lite-version', active: true }],
        posts: [{ id: 1, slug: 'home', title: 'Home', content: '', meta: { _fl_builder_data: '{}' } }],
      }),
    ).toBe('beaver');
  });

  it('reports divi when the theme is Divi and _et_pb_use_builder is on', () => {
    expect(
      detectBuilder({
        theme: 'Divi',
        plugins: [],
        posts: [{ id: 1, slug: 'home', title: 'Home', content: '', meta: { _et_pb_use_builder: 'on' } }],
      }),
    ).toBe('divi');
  });

  it('reports gutenberg when content has block markup and no builder plugin', () => {
    expect(
      detectBuilder({
        theme: 'twentytwentyfour',
        plugins: [],
        posts: [{ id: 1, slug: 'home', title: 'Home', content: '<!-- wp:heading --><h1>Hi</h1><!-- /wp:heading -->', meta: {} }],
      }),
    ).toBe('gutenberg');
  });

  it('reports classic when content is HTML and no builder plugin is active', () => {
    expect(
      detectBuilder({
        theme: 'twentytwentyone',
        plugins: [],
        posts: [{ id: 1, slug: 'home', title: 'Home', content: '<h1>Hi</h1>', meta: {} }],
      }),
    ).toBe('classic');
  });

  it('prefers elementor over gutenberg markup when both are present', () => {
    expect(
      detectBuilder({
        theme: 'hello-elementor',
        plugins: [{ slug: 'elementor', active: true }],
        posts: [
          {
            id: 1,
            slug: 'home',
            title: 'Home',
            content: '<!-- wp:heading --><h1>Hi</h1><!-- /wp:heading -->',
            meta: { _elementor_data: '[]' },
          },
        ],
      }),
    ).toBe('elementor');
  });
});
