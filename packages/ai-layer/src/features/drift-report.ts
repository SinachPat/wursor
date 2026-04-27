import type { AIGateway } from '../gateway.js';
import { buildSystemPrompt } from '../prompts/system.js';

export interface DriftReportInput {
  /** Screenshot of the live app as base64 data URL (optional — text-only analysis if absent) */
  screenshotBase64?: string;
  /** Active Design Language File as JSON string (optional — generic advice if absent) */
  dlfJson?: string;
  /** Human-readable artboard metadata to give the model context (name, size, origin, etc.) */
  artboardContext?: string;
}

export interface DriftViolation {
  component: string;
  property: string;
  currentValue: string;
  expectedValue: string;
  severity: 'critical' | 'warning';
  description: string;
}

export interface DriftReportOutput {
  violations: DriftViolation[];
  summary: string;
  violationCount: number;
}

export async function generateDriftReport(
  gateway: AIGateway,
  input: DriftReportInput
): Promise<DriftReportOutput> {
  const system = buildSystemPrompt({
    role: 'a design system compliance auditor',
    ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
  });

  type ContentBlock =
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }
    | { type: 'text'; text: string };

  const userContent: ContentBlock[] = [];

  if (input.screenshotBase64) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: input.screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }

  const analysisInstructions = input.screenshotBase64
    ? 'Compare this screenshot against the design language file provided in your system context.'
    : `Analyse the following artboard for design system drift:\n\n${input.artboardContext ?? '(no artboard context provided)'}`;

  userContent.push({
    type: 'text',
    text: `${analysisInstructions} Identify all design system drift violations.\n\nReturn a JSON object:\n{\n  "violations": [{"component":"...", "property":"...", "currentValue":"...", "expectedValue":"...", "severity":"critical|warning", "description":"..."}],\n  "summary": "...",\n  "violationCount": N\n}\n\nRespond ONLY with valid JSON.`,
  });

  const response = await gateway.complete({
    system,
    messages: [{ role: 'user', content: userContent }],
    maxTokens: 4096,
  });

  // Returning empty violations on parse failure would be a false-negative in a
  // compliance feature. Throw so the caller can surface the error clearly.
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch (err) {
    throw new Error(
      `Drift report returned unparseable JSON: ${String(err)}. ` +
      `Raw response (first 300 chars): ${response.text.slice(0, 300)}`
    );
  }

  return parsed as DriftReportOutput;
}
