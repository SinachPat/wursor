import type { AIGateway } from '../gateway.js';
import { buildSystemPrompt } from '../prompts/system.js';

export interface AgentQAInput {
  /** Question from the coding agent (e.g. Cursor or Claude Code) */
  question: string;
  /** The diff ID this question is about */
  diffId: string;
  /** Full artboard context as JSON */
  artboardContextJson: string;
  /** Active DLF */
  dlfJson?: string;
}

export interface AgentQAOutput {
  answer: string;
  /** Optional visual reference description (e.g. "see padding token in section 3") */
  visualReference?: string;
}

export async function answerAgentQuestion(
  gateway: AIGateway,
  input: AgentQAInput
): Promise<AgentQAOutput> {
  const system = buildSystemPrompt({
    role: 'a design agent answering questions from a coding agent implementing a design diff',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  const response = await gateway.complete({
    system,
    messages: [
      {
        role: 'user',
        content: `<artboard_context>\n${input.artboardContextJson}\n</artboard_context>\n\n<diff_id>${input.diffId}</diff_id>\n\n<question>\n${input.question}\n</question>\n\nAnswer the coding agent's question concisely and precisely. If the answer references a specific design token, component, or visual region, include a "visualReference" field. Return JSON:\n{\n  "answer": "...",\n  "visualReference": "..." (optional)\n}\n\nRespond ONLY with valid JSON.`,
      },
    ],
    maxTokens: 1024,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim());
  } catch (err) {
    throw new Error(
      `Design agent returned unparseable JSON: ${String(err)}. ` +
      `Raw response (first 300 chars): ${response.text.slice(0, 300)}`
    );
  }

  const output = parsed as AgentQAOutput;
  if (!output.answer || typeof output.answer !== 'string') {
    throw new Error(
      `Design agent response missing required "answer" field. ` +
      `Raw response (first 300 chars): ${response.text.slice(0, 300)}`
    );
  }

  return output;
}
