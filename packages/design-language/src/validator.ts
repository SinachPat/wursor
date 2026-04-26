import { DesignLanguageFileBodySchema, type DesignLanguageFileBody } from './schema.js';
import type { ZodError } from 'zod';

// ── Validation result ─────────────────────────────────────────────────────────

export interface ValidationSuccess {
  valid: true;
  dlf: DesignLanguageFileBody;
}

export interface ValidationFailure {
  valid: false;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ── Parse & validate ──────────────────────────────────────────────────────────

export function validateDesignLanguageFile(input: unknown): ValidationResult {
  const result = DesignLanguageFileBodySchema.safeParse(input);
  if (result.success) {
    return { valid: true, dlf: result.data };
  }
  return { valid: false, errors: formatZodErrors(result.error) };
}

function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map(e => ({
    path: e.path.join('.') || '(root)',
    message: e.message,
  }));
}

// ── Runtime constraint checks ─────────────────────────────────────────────────
// These run during visual edits and AI completions to catch violations
// against the active DLF before they're shown to the user.

export interface ViolationCheck {
  /** Name of the component being checked */
  componentName: string;
  /** Props being applied */
  props: Record<string, unknown>;
  /** The active DLF */
  dlf: DesignLanguageFileBody;
}

export interface Violation {
  prop: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export function checkComponentConstraints(check: ViolationCheck): Violation[] {
  const { componentName, props, dlf } = check;
  const violations: Violation[] = [];

  const componentRule = dlf.components?.[componentName];
  if (!componentRule) return violations;

  const { props: propRules } = componentRule;
  if (!propRules) return violations;

  for (const [propKey, rule] of Object.entries(propRules)) {
    const value = props[propKey];

    // Use hasOwnProperty to distinguish "key absent" from "key set to undefined".
    // Under exactOptionalPropertyTypes these are semantically different.
    if (rule.required && !Object.prototype.hasOwnProperty.call(props, propKey)) {
      violations.push({ prop: propKey, value, message: `"${propKey}" is required by design system rules`, severity: 'error' });
    }

    if (rule.forbidden && value !== undefined && rule.forbidden.includes(value)) {
      violations.push({ prop: propKey, value, message: `"${propKey}=${String(value)}" is forbidden by design system rules`, severity: 'error' });
    }

    if (rule.allowed && value !== undefined && !rule.allowed.includes(value)) {
      violations.push({ prop: propKey, value, message: `"${propKey}=${String(value)}" is not in the allowed values list`, severity: 'warning' });
    }
  }

  return violations;
}
