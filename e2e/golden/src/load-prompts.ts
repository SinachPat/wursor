import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GoldenPrompt } from './types.ts';

const goldenRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadPrompts(): GoldenPrompt[] {
  const raw = readFileSync(join(goldenRoot, 'prompts.json'), 'utf8');
  return JSON.parse(raw) as GoldenPrompt[];
}
