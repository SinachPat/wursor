import { applyTool } from './apply-tool.ts';
import { checkAssertion } from './check-assertion.ts';
import type { GoldenAssert, GrokResponse, SiteFixture, ToolCall, ToolName } from './types.ts';

const tools = new Set<ToolName>(['edit_heading', 'edit_text', 'update_option']);

function isToolName(name: string): name is ToolName {
  return tools.has(name as ToolName);
}

export function parseGrokToolCalls(grok: GrokResponse): ToolCall[] {
  const calls = grok.choices[0]?.message.tool_calls ?? [];
  return calls.map((call) => {
    if (!isToolName(call.function.name)) {
      throw new Error(`unknown tool: ${call.function.name}`);
    }
    return {
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments) as Record<string, string>,
    };
  });
}

export function scoreGrokResponse(input: {
  site: SiteFixture;
  assert: GoldenAssert;
  grok: GrokResponse;
}): { passed: boolean } {
  const next = parseGrokToolCalls(input.grok).reduce(applyTool, input.site);
  return { passed: checkAssertion(next, input.assert).ok };
}
