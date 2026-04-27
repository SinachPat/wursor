import type { AIGateway } from '../gateway.js';
import { buildSystemPrompt } from '../prompts/system.js';

export interface DiffSummaryInput {
  /** Serialized component-level changes (JSON) */
  changesJson: string;
  /** Component name */
  componentName: string;
}

export interface DiffSummaryOutput {
  summary: string;
}

export async function generateDiffSummary(
  gateway: AIGateway,
  input: DiffSummaryInput
): Promise<DiffSummaryOutput> {
  const system = buildSystemPrompt({ role: 'a technical writer summarizing UI component changes' });

  const response = await gateway.complete({
    system,
    messages: [
      {
        role: 'user',
        content: `Summarize the following component changes for "${input.componentName}" in one concise sentence (max 20 words) suitable for a developer reviewing a pull request. Focus on what changed and its purpose.\n\n<changes>\n${input.changesJson}\n</changes>\n\nRespond with only the summary sentence.`,
      },
    ],
    maxTokens: 128,
  });

  return { summary: response.text.trim() };
}
