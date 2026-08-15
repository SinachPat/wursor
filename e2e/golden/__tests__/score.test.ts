import { describe, it, expect } from 'vitest';
import { applyTool } from '../src/apply-tool.ts';
import { checkAssertion } from '../src/check-assertion.ts';
import { scoreGrokResponse } from '../src/score.ts';
import type { SiteFixture } from '../src/types.ts';

const site = (): SiteFixture => ({
  id: 'gutenberg-business',
  theme: 'twentytwentyfour',
  plugins: [],
  wordpressVersion: '6.6',
  phpVersion: '8.2',
  options: { blogname: 'Old Biz', blog_public: '1' },
  posts: [
    {
      id: 1,
      slug: 'homepage',
      title: 'Home',
      content: '<!-- wp:heading --><h1>Welcome to our site</h1><!-- /wp:heading -->',
      meta: {},
    },
  ],
  uploads: [],
});

describe('applyTool', () => {
  it('replaces the homepage heading', () => {
    const next = applyTool(site(), {
      name: 'edit_heading',
      arguments: { page: 'homepage', newText: 'Welcome to My Business' },
    });
    expect(next.posts[0]?.content).toContain('Welcome to My Business');
  });
});

describe('checkAssertion', () => {
  it('passes preview_text when the page contains the string', () => {
    const next = applyTool(site(), {
      name: 'edit_heading',
      arguments: { page: 'homepage', newText: 'Welcome to My Business' },
    });
    expect(
      checkAssertion(next, { type: 'preview_text', page: 'homepage', contains: 'Welcome to My Business' }).ok,
    ).toBe(true);
  });

  it('fails preview_text when the string is absent', () => {
    expect(
      checkAssertion(site(), { type: 'preview_text', page: 'homepage', contains: 'Welcome to My Business' }).ok,
    ).toBe(false);
  });

  it('passes option when the value matches', () => {
    const next = applyTool(site(), {
      name: 'update_option',
      arguments: { key: 'blogname', value: 'My Business' },
    });
    expect(checkAssertion(next, { type: 'option', key: 'blogname', value: 'My Business' }).ok).toBe(true);
  });
});

describe('scoreGrokResponse', () => {
  it('passes a Grok tool-call that satisfies the assertion', () => {
    const verdict = scoreGrokResponse({
      site: site(),
      assert: { type: 'preview_text', page: 'homepage', contains: 'Welcome to My Business' },
      grok: {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: 'edit_heading',
                    arguments: JSON.stringify({ page: 'homepage', newText: 'Welcome to My Business' }),
                  },
                },
              ],
            },
          },
        ],
      },
    });
    expect(verdict.passed).toBe(true);
  });
});
