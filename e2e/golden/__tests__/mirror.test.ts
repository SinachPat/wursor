import { describe, it, expect } from 'vitest';
import { exportDbSubset } from '../src/subset.ts';
import { mediaProxyTarget, stageReplacement } from '../src/media-proxy.ts';
import type { SiteExport } from '../src/types.ts';

const dump = (): SiteExport => ({
  origin: 'https://example.com',
  tables: {
    wp_posts: [{ ID: 1, post_title: 'Home' }],
    wp_postmeta: [{ post_id: 1, meta_key: '_edit_lock', meta_value: '1' }],
    wp_options: [
      { option_name: 'blogname', option_value: 'Biz' },
      { option_name: 'woocommerce_stripe_secret_key', option_value: 'sk_live_xxx' },
      { option_name: 'smtp_pass', option_value: 'secret' },
    ],
    wp_wc_orders: [{ id: 99, total: '40.00' }],
    wp_comments: [{ comment_ID: 1, comment_content: 'hi' }],
  },
  uploads: [{ path: '/wp-content/uploads/2024/hero.jpg', bytes: 2_147_483_648 }],
});

describe('exportDbSubset', () => {
  it('keeps posts, postmeta, and options for a content playbook', () => {
    expect(exportDbSubset(dump(), { playbook: 'content', postIds: [1] }).tables).toEqual(
      expect.arrayContaining(['wp_posts', 'wp_postmeta', 'wp_options']),
    );
  });

  it('drops Woo orders from a content-edit slice', () => {
    expect(exportDbSubset(dump(), { playbook: 'content', postIds: [1] }).tables).not.toContain('wp_wc_orders');
  });

  it('drops comments from a content-edit slice', () => {
    expect(exportDbSubset(dump(), { playbook: 'content', postIds: [1] }).tables).not.toContain('wp_comments');
  });

  it('redacts option names ending in _key, _secret, or smtp_pass', () => {
    const options = exportDbSubset(dump(), { playbook: 'content', postIds: [1] }).options;
    expect(options.every((name) => !/(_key|_secret|smtp_pass)$/.test(name))).toBe(true);
  });
});

describe('media proxy', () => {
  it('does not copy the uploads library', () => {
    expect(mediaProxyTarget(dump(), '/wp-content/uploads/2024/hero.jpg')).toBe(
      'https://example.com/wp-content/uploads/2024/hero.jpg',
    );
  });

  it('copies a file only when it is replaced', () => {
    const staged = stageReplacement(dump(), '/wp-content/uploads/2024/hero.jpg', 12);
    expect(staged.copiedPaths).toEqual(['/wp-content/uploads/2024/hero.jpg']);
  });
});
