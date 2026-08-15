import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteFixture } from './types.ts';

const goldenRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadSite(id: string): SiteFixture {
  const raw = readFileSync(join(goldenRoot, 'sites', id, 'site.json'), 'utf8');
  return JSON.parse(raw) as SiteFixture;
}
