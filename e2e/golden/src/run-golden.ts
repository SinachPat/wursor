import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBuilder } from './builder-detect.ts';
import { asGrokResponse, expectedCalls } from './expected-calls.ts';
import { callLlm, type LlmProvider } from './llm-client.ts';
import { loadPrompts } from './load-prompts.ts';
import { loadSite } from './load-site.ts';
import { scoreGrokResponse } from './score.ts';

const goldenRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function provider(): LlmProvider {
  return process.env.LLM_PROVIDER === 'openrouter' ? 'openrouter' : 'grok';
}

function key(): string | undefined {
  const value = provider() === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.XAI_API_KEY;
  return value !== undefined && value !== '' ? value : undefined;
}

const prompts = loadPrompts();
const fixtureScores = prompts.map((prompt) => {
  const call = expectedCalls[prompt.id];
  if (call === undefined) {
    throw new Error(`missing expected call for ${prompt.id}`);
  }
  const verdict = scoreGrokResponse({
    site: loadSite(prompt.site),
    assert: prompt.assert,
    grok: asGrokResponse(call),
  });
  return { id: prompt.id, site: prompt.site, passed: verdict.passed, source: 'fixture-tool-trace' };
});

const apiKey = key();
let grokLive: { id: string; passed: boolean; error?: string } | undefined;

if (apiKey !== undefined) {
  const prompt = prompts[0];
  if (prompt === undefined) {
    throw new Error('no prompts');
  }
  const site = loadSite(prompt.site);
  try {
    const grok = await callLlm({
      provider: provider(),
      apiKey,
      model: provider() === 'openrouter' ? process.env.OPENROUTER_MODEL : undefined,
      prompt: prompt.prompt,
      siteId: site.id,
      builder: detectBuilder(site),
      pages: site.posts.map((post) => post.slug),
    });
    grokLive = {
      id: prompt.id,
      passed: scoreGrokResponse({ site, assert: prompt.assert, grok }).passed,
    };
  } catch (error) {
    grokLive = { id: prompt.id, passed: false, error: error instanceof Error ? error.message : 'unknown' };
  }
}

const report = {
  fixturePassed: fixtureScores.filter((row) => row.passed).length,
  fixtureTotal: fixtureScores.length,
  grokLive: grokLive ?? {
    skipped: true,
    reason: provider() === 'openrouter' ? 'OPENROUTER_API_KEY not set' : 'XAI_API_KEY not set',
  },
  scores: fixtureScores,
};

mkdirSync(join(goldenRoot, 'runs'), { recursive: true });
writeFileSync(join(goldenRoot, 'runs', 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (report.fixturePassed !== report.fixtureTotal) {
  process.exitCode = 1;
}
