import type { GoldenAssert, SiteFixture } from './types.ts';

export type AssertionResult = {
  ok: boolean;
};

function pageText(site: SiteFixture, slug: string): string {
  const post = site.posts.find((item) => item.slug === slug);
  if (post === undefined) {
    return '';
  }
  return `${post.content}\n${Object.values(post.meta).join('\n')}`;
}

export function checkAssertion(site: SiteFixture, assertion: GoldenAssert): AssertionResult {
  if (assertion.type === 'option') {
    return { ok: site.options[assertion.key] === assertion.value };
  }
  return { ok: pageText(site, assertion.page).includes(assertion.contains) };
}
