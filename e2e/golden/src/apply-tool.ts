import type { SiteFixture, ToolCall } from './types.ts';

function replaceHeading(html: string, newText: string): string {
  if (!/<h1\b/i.test(html)) {
    return `<h1>${newText}</h1>${html}`;
  }
  return html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, `<h1>${newText}</h1>`);
}

function patchElementorHeading(meta: Record<string, string>, newText: string): Record<string, string> {
  const raw = meta._elementor_data;
  if (raw === undefined) {
    return meta;
  }
  try {
    const data: unknown = JSON.parse(raw);
    const next = JSON.stringify(data, (key, value) => {
      if (key === 'title' && typeof value === 'string') {
        return newText;
      }
      return value as unknown;
    });
    return { ...meta, _elementor_data: next };
  } catch {
    return meta;
  }
}

function pageOf(site: SiteFixture, slug: string) {
  const post = site.posts.find((item) => item.slug === slug);
  if (post === undefined) {
    throw new Error(`unknown page: ${slug}`);
  }
  return post;
}

export function applyTool(site: SiteFixture, call: ToolCall): SiteFixture {
  if (call.name === 'update_option') {
    const key = call.arguments.key;
    const value = call.arguments.value;
    if (key === undefined || value === undefined) {
      throw new Error('update_option requires key and value');
    }
    return { ...site, options: { ...site.options, [key]: value } };
  }

  if (call.name === 'edit_heading') {
    const page = call.arguments.page;
    const newText = call.arguments.newText;
    if (page === undefined || newText === undefined) {
      throw new Error('edit_heading requires page and newText');
    }
    pageOf(site, page);
    return {
      ...site,
      posts: site.posts.map((post) =>
        post.slug === page
          ? {
              ...post,
              content: replaceHeading(post.content, newText),
              meta: patchElementorHeading(post.meta, newText),
            }
          : post,
      ),
    };
  }

  if (call.name === 'edit_text') {
    const page = call.arguments.page;
    const target = call.arguments.target;
    const replacement = call.arguments.replacement;
    if (page === undefined || target === undefined || replacement === undefined) {
      throw new Error('edit_text requires page, target, and replacement');
    }
    const current = pageOf(site, page);
    return {
      ...site,
      posts: site.posts.map((post) =>
        post.slug === page
          ? {
              ...post,
              content: current.content.split(target).join(replacement),
              meta: Object.fromEntries(
                Object.entries(post.meta).map(([key, value]) => [key, value.split(target).join(replacement)]),
              ),
            }
          : post,
      ),
    };
  }

  throw new Error(`unknown tool: ${call.name}`);
}
