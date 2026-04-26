import type Anthropic from '@anthropic-ai/sdk';

// ── System prompt builder ─────────────────────────────────────────────────────
// The DLF is placed as the FIRST cache breakpoint — it's stable across all
// requests in a workspace session, so cache hit rate is very high.
// Variable content (artboard context, user question) comes AFTER the breakpoints.

export function buildSystemPrompt(opts: {
  role: string;
  dlfJson?: string;
}): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [];

  // First block: stable role description — cached
  blocks.push({
    type: 'text',
    text: `You are ${opts.role}. You work within Originmain, an AI-native design engineering platform. Your outputs are used directly by designers and engineers to implement product changes. Be precise, structured, and always respect the design system constraints provided.`,
    cache_control: { type: 'ephemeral' },
  });

  // Second block: DLF if provided — cached (stable per workspace)
  if (opts.dlfJson) {
    blocks.push({
      type: 'text',
      text: `<design_language_file>\n${opts.dlfJson}\n</design_language_file>`,
      cache_control: { type: 'ephemeral' },
    });
  }

  return blocks;
}
