import type { GrokResponse } from './types.ts';

export type LlmProvider = 'grok' | 'openrouter';

export type LlmConfig = {
  baseUrl: string;
  model: string;
};

const PROVIDERS: Record<LlmProvider, LlmConfig> = {
  grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-3' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'x-ai/grok-4.6' },
};

export function resolveProvider(provider: LlmProvider, model?: string): LlmConfig {
  const config = PROVIDERS[provider];
  return { baseUrl: config.baseUrl, model: model ?? config.model };
}

export async function callLlm(input: {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  prompt: string;
  siteId: string;
  builder: string;
  pages?: string[];
}): Promise<GrokResponse> {
  const { baseUrl, model } = resolveProvider(input.provider, input.model);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (input.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://wursor.dev';
    headers['X-Title'] = 'Wursor golden harness';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You edit a WordPress fixture. Use only edit_heading, edit_text, or update_option. Fill slots. Do not explain.',
        },
        {
          role: 'user',
          content: `site=${input.siteId} builder=${input.builder}${input.pages ? ` pages=${input.pages.join(',')}` : ''}\n${input.prompt}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'edit_heading',
            parameters: {
              type: 'object',
              properties: { page: { type: 'string' }, newText: { type: 'string' } },
              required: ['page', 'newText'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'edit_text',
            parameters: {
              type: 'object',
              properties: {
                page: { type: 'string' },
                target: { type: 'string' },
                replacement: { type: 'string' },
              },
              required: ['page', 'target', 'replacement'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'update_option',
            parameters: {
              type: 'object',
              properties: { key: { type: 'string' }, value: { type: 'string' } },
              required: ['key', 'value'],
            },
          },
        },
      ],
      tool_choice: 'required',
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}`);
  }
  return (await response.json()) as GrokResponse;
}
