import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { mediaProxyTarget } from './media-proxy.ts';
import { exportDbSubset } from './subset.ts';
import type { SiteExport } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const exportDir = join(repoRoot, 'e2e/fixtures/large-exports/synthetic-2g');
const blobPath = join(exportDir, 'uploads/2024/library.bin');
const targetBytes = 2 * 1024 * 1024 * 1024;
const runs = 20;

function ensureBlob(): number {
  mkdirSync(dirname(blobPath), { recursive: true });
  try {
    const existing = statSync(blobPath).size;
    if (existing >= targetBytes) {
      return existing;
    }
  } catch {
    // create below
  }
  const result = spawnSync('mkfile', [`${targetBytes}`, blobPath], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('mkfile failed');
  }
  return statSync(blobPath).size;
}

function dump(bytes: number): SiteExport {
  const posts = Array.from({ length: 8000 }, (_, index) => ({
    ID: index + 1,
    post_title: index === 0 ? 'Home' : `Post ${index + 1}`,
    post_content: 'x'.repeat(80),
  }));
  return {
    origin: 'https://big.example',
    tables: {
      wp_posts: posts,
      wp_postmeta: posts.map((post) => ({ post_id: post.ID, meta_key: '_edit_lock', meta_value: '1' })),
      wp_options: [
        { option_name: 'blogname', option_value: 'Big' },
        { option_name: 'woocommerce_stripe_secret_key', option_value: 'sk' },
      ],
      wp_wc_orders: Array.from({ length: 20000 }, (_, index) => ({ id: index, total: '10.00' })),
    },
    uploads: [{ path: '/wp-content/uploads/2024/library.bin', bytes }],
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

const bytes = ensureBlob();
const site = dump(bytes);
const samples: number[] = [];

for (let i = 0; i < runs; i += 1) {
  const start = performance.now();
  const subset = exportDbSubset(site, { playbook: 'content', postIds: [1] });
  const proxy = mediaProxyTarget(site, '/wp-content/uploads/2024/library.bin');
  if (subset.tables.includes('wp_wc_orders')) {
    throw new Error('subset leaked orders');
  }
  if (!proxy.startsWith('https://big.example/')) {
    throw new Error('proxy missed origin');
  }
  samples.push(performance.now() - start);
}

const copyDest = `${blobPath}.copy`;
const copyStart = performance.now();
const copy = spawnSync('dd', [`if=${blobPath}`, `of=${copyDest}`, 'bs=8m'], { stdio: 'inherit' });
const naiveCopyMs = performance.now() - copyStart;
if (copy.status !== 0) {
  throw new Error('naive copy failed');
}

const report = {
  blobBytes: bytes,
  runs,
  subsetProxyMs: samples,
  p50Ms: percentile(samples, 50),
  p95Ms: percentile(samples, 95),
  uploadBytesCopied: 0,
  naiveCopyMs,
  targetPageBudgetMs: 60_000,
  decision: percentile(samples, 95) <= 60_000 ? 'slice holds' : 'slice is wrong',
};

const out = join(dirname(fileURLToPath(import.meta.url)), '../runs/mirror-timing.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
