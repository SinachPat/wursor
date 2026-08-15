import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveProvider, callLlm } from '../src/llm-client.ts';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveProvider', () => {
  it('maps grok to the x.ai endpoint and grok-3 model', () => {
    expect(resolveProvider('grok')).toEqual({ baseUrl: 'https://api.x.ai/v1', model: 'grok-3' });
  });

  it('maps openrouter to the openrouter endpoint and the grok-4.6 model', () => {
    expect(resolveProvider('openrouter')).toEqual({
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'x-ai/grok-4.6',
    });
  });

  it('honors an explicit model override', () => {
    expect(resolveProvider('openrouter', 'openai/gpt-4o')).toEqual({
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o',
    });
  });
});

describe('callLlm', () => {
  it('posts an OpenAI-shaped tool-call request to the grok endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });

    await callLlm({
      provider: 'grok',
      apiKey: 'test-key',
      prompt: 'Change the heading',
      siteId: 'gutenberg-business',
      builder: 'gutenberg',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body) as { model: string; tool_choice: string; tools: Array<{ function: { name: string } }> };
    expect(body.model).toBe('grok-3');
    expect(body.tool_choice).toBe('required');
    expect(body.tools[0]?.function.name).toBe('edit_heading');
  });

  it('adds OpenRouter identification headers and uses the openrouter endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });

    await callLlm({
      provider: 'openrouter',
      apiKey: 'test-key',
      prompt: 'Change the heading',
      siteId: 'gutenberg-business',
      builder: 'gutenberg',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers['HTTP-Referer']).toBeDefined();
    expect(init.headers['X-Title']).toBeDefined();
    expect(JSON.parse(init.body).model).toBe('x-ai/grok-4.6');
  });

  it('includes page slugs in the user message when provided', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });

    await callLlm({
      provider: 'grok',
      apiKey: 'test-key',
      prompt: 'Change the heading',
      siteId: 'gutenberg-business',
      builder: 'gutenberg',
      pages: ['homepage', 'about', 'contact'],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
    expect(body.messages[1]?.content).toContain('pages=homepage,about,contact');
  });

  it('throws when the provider returns a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      callLlm({ provider: 'grok', apiKey: 'bad', prompt: 'x', siteId: 's', builder: 'b' }),
    ).rejects.toThrow('LLM HTTP 401');
  });
});
