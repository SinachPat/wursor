import type { Builder, PluginRef, PostFixture } from './types.ts';

export type DetectInput = {
  theme: string;
  plugins: PluginRef[];
  posts: Pick<PostFixture, 'content' | 'meta'>[];
};

export function detectBuilder(input: DetectInput): Builder {
  const active = new Set(input.plugins.filter((plugin) => plugin.active).map((plugin) => plugin.slug));
  const theme = input.theme.toLowerCase();

  if (
    active.has('elementor') &&
    input.posts.some((post) => post.meta._elementor_edit_mode !== undefined || post.meta._elementor_data !== undefined)
  ) {
    return 'elementor';
  }

  if (
    (active.has('beaver-builder-lite-version') || active.has('bb-plugin')) &&
    input.posts.some((post) => post.meta._fl_builder_data !== undefined || post.meta._fl_builder_enabled !== undefined)
  ) {
    return 'beaver';
  }

  if (
    (theme === 'divi' || active.has('divi-builder')) &&
    input.posts.some((post) => post.meta._et_pb_use_builder === 'on')
  ) {
    return 'divi';
  }

  if (input.posts.some((post) => post.content.includes('<!-- wp:'))) {
    return 'gutenberg';
  }

  return 'classic';
}

export function siteInfoPayload(input: DetectInput): { builder: Builder } {
  return { builder: detectBuilder(input) };
}
