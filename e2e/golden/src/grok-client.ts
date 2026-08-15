import type { GrokResponse } from './types.ts';

const url = 'https://api.x.ai/v1/chat/completions';

export async function callGrok(input: {
  apiKey: string;
  prompt: string;
  siteId: string;
  builder: string;
}): Promise<GrokResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content:
            'You edit a WordPress fixture. Use only edit_heading, edit_text, or update_option. Fill slots. Do not explain.',
        },
        {
          role: 'user',
          content: `site=${input.siteId} builder=${input.builder}\n${input.prompt}`,
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
    throw new Error(`Grok HTTP ${response.status}`);
  }
  return (await response.json()) as GrokResponse;
}
