import type { AIGateway } from '../gateway.js';
import { buildSystemPrompt } from '../prompts/system.js';

export interface DriftReportInput {
  /** Screenshot of the live app as base64 data URL */
  screenshotBase64: string;
  /** Active Design Language File as JSON string */
  dlfJson: string;
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
    dlfJson: input.dlfJson,
  });

  const response = await gateway.complete({
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: input.screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            type: 'text',
            text: 'Compare this screenshot against the design language file provided in your system context. Identify all design system drift violations.\n\nReturn a JSON object:\n{\n  "violations": [{"component":"...", "property":"...", "currentValue":"...", "expectedValue":"...", "severity":"critical|warning", "description":"..."}],\n  "summary": "...",\n  "violationCount": N\n}\n\nRespond ONLY with valid JSON.',
          },
        ],
      },
    ],
    maxTokens: 4096,
    temperature: 0.3,
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
