import type { AIGateway } from '../gateway.js';
import { buildAgentQueryMessages } from '../prompts/agent-query.prompt.js';

export interface AgentQAInput {
  /** Question from the coding agent (e.g. Cursor or Claude Code) */
  question: string;
  /** The diff ID this question is about */
  diffId: string;
  /** Full artboard context as JSON */
  artboardContextJson: string;
  /** Active DLF */
  dlfJson?: string;
  /** Before-state screenshot as base64 data URL (spec Layer 6.3-R3) */
  beforeScreenshotBase64?: string;
  /** After-state screenshot as base64 data URL (spec Layer 6.3-R3) */
  afterScreenshotBase64?: string;
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
  const { system, userContent, maxTokens } = buildAgentQueryMessages(input);

  const response = await gateway.complete({
    system,
    // userContent is ContentBlockParam[] — may include image blocks for screenshots
    messages:    [{ role: 'user', content: userContent }],
    maxTokens,
    temperature: 0.1,  // spec Layer 6.3: 0.1 for agent-query (factual, authoritative)
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
