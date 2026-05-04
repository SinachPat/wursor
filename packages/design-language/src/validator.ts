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

// ── Runtime constraint checks (per-component) ─────────────────────────────────
// Used by the Inspector panel to validate the selected component's live React
// props against the active DLF in real time.
//
// Uses the spec schema: `allowedProps` is `Record<string, string[]>` — each
// entry maps a prop name to the list of allowed string values.

export interface ViolationCheck {
  componentName: string;
  props: Record<string, unknown>;
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

  const { allowedProps, forbiddenVariants } = componentRule;

  // allowedProps: prop → string[] of allowed values
  if (allowedProps) {
    for (const [propKey, allowedValues] of Object.entries(allowedProps)) {
      const value = props[propKey];
      if (value !== undefined && !allowedValues.includes(String(value))) {
        violations.push({
          prop:     propKey,
          value,
          message:  `"${propKey}=${String(value)}" is not in the allowed values list`,
          severity: 'warning',
        });
      }
    }
  }

  // Component-level forbidden variant guard
  if (forbiddenVariants) {
    const variant = props['variant'];
    if (typeof variant === 'string' && forbiddenVariants.includes(variant)) {
      violations.push({
        prop:     'variant',
        value:    variant,
        message:  `variant="${variant}" is forbidden for ${componentName} by design system rules`,
        severity: 'error',
      });
    }
  }

  // requiredAria: ARIA attributes that must be present (spec Layer 5.2)
  // Each entry is an aria attribute name (e.g. "aria-label", "role").
  // Absence of any required ARIA attribute is a DLF error — accessibility
  // violations are always errors, never warnings.
  const { requiredAria } = componentRule;
  if (requiredAria) {
    for (const ariaAttr of requiredAria) {
      if (props[ariaAttr] === undefined || props[ariaAttr] === null || props[ariaAttr] === '') {
        violations.push({
          prop:     ariaAttr,
          value:    undefined,
          message:  `"${ariaAttr}" is required for ${componentName} by accessibility rules`,
          severity: 'error',
        });
      }
    }
  }

  // ── DLF accessibility block checks (spec Layer 5.2) ──────────────────────
  const a11y = dlf.accessibility;
  if (a11y) {
    // requireAltText: image-like components must have a non-empty alt prop.
    // Heuristic: component has a `src` prop (e.g. <img>, <Image>, <Avatar>).
    if (a11y.requireAltText) {
      const hasSrc = typeof props['src'] === 'string' && props['src'] !== '';
      const altVal = props['alt'];
      if (hasSrc && (altVal === undefined || altVal === null || altVal === '')) {
        violations.push({
          prop:     'alt',
          value:    altVal,
          message:  `"alt" text is required for image components (DLF accessibility.requireAltText)`,
          severity: 'error',
        });
      }
    }

    // minTouchTargetPx: interactive components must be at least N×N pixels.
    // Checked against numeric width/height props when both are present.
    const { minTouchTargetPx } = a11y;
    if (minTouchTargetPx > 0) {
      const w = typeof props['width']  === 'number' ? props['width']  : undefined;
      const h = typeof props['height'] === 'number' ? props['height'] : undefined;
      if (w !== undefined && w < minTouchTargetPx) {
        violations.push({
          prop: 'width', value: w,
          message: `width ${w}px is below the minimum touch target of ${minTouchTargetPx}px`,
          severity: 'warning',
        });
      }
      if (h !== undefined && h < minTouchTargetPx) {
        violations.push({
          prop: 'height', value: h,
          message: `height ${h}px is below the minimum touch target of ${minTouchTargetPx}px`,
          severity: 'warning',
        });
      }
    }

    // minContrastRatio: check foreground/background color props.
    // Only checked when both `color` and `backgroundColor` are hex strings,
    // since contrast requires both colors. Uses WCAG 2.x relative luminance.
    const { minContrastRatio } = a11y;
    if (minContrastRatio > 0) {
      const fg = props['color'];
      const bg = props['backgroundColor'];
      if (typeof fg === 'string' && typeof bg === 'string') {
        const ratio = wcagContrastRatio(fg, bg);
        if (ratio !== null && ratio < minContrastRatio) {
          violations.push({
            prop: 'color', value: fg,
            message: `Color contrast ratio ${ratio.toFixed(2)}:1 is below DLF minimum of ${minContrastRatio}:1`,
            severity: 'error',
          });
        }
      }
    }
  }

  return violations;
}

// ── WCAG 2.x contrast ratio helper ───────────────────────────────────────────
// Returns the contrast ratio [1, 21] for two hex colors, or null if either
// string is not a recognisable hex color. Handles #RGB and #RRGGBB formats.

function hexToLinearRgb(hex: string): [number, number, number] | null {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const expanded = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const linearise = (v: number) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return [linearise(r), linearise(g), linearise(b)];
}

function relativeLuminance(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function wcagContrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToLinearRgb(hex1);
  const rgb2 = hexToLinearRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const L1 = relativeLuminance(rgb1);
  const L2 = relativeLuminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── ComponentChange validation (spec Layer 5.2) ───────────────────────────────

export interface ComponentChange {
  componentId: string;
  displayName: string;
  filePath?: string;
  changeType:
    | 'prop_change'
    | 'component_swap'
    | 'layout_change'
    | 'token_change'
    | 'removal'
    | 'insertion';
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  humanSummary: string;
}

export interface DesignViolation {
  componentId: string;
  /** DLF path of the violated rule, e.g. "components.Button.allowedProps.variant" */
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ChangeValidationResult {
  valid: boolean;
  violations: DesignViolation[];
}

export function validateChange(
  change: ComponentChange,
  dlf: DesignLanguageFileBody,
): ChangeValidationResult {
  const violations: DesignViolation[] = [];

  // Removals have no after-state to validate.
  if (change.changeType === 'removal') {
    return { valid: true, violations: [] };
  }

  // prop_change, component_swap, insertion → check after-state props.
  if (
    change.changeType === 'prop_change' ||
    change.changeType === 'component_swap' ||
    change.changeType === 'insertion'
  ) {
    const propViolations = checkComponentConstraints({
      componentName: change.displayName,
      props:         change.after,
      dlf,
    });

    for (const v of propViolations) {
      violations.push({
        componentId: change.componentId,
        rule:        `components.${change.displayName}.allowedProps.${v.prop}`,
        severity:    v.severity,
        message:     v.message,
      });
    }

    // Additional forbidden-variant check for component_swap.
    if (change.changeType === 'component_swap') {
      const rule = dlf.components?.[change.displayName];
      if (rule?.forbiddenVariants) {
        const newVariant = change.after['variant'];
        if (typeof newVariant === 'string' && rule.forbiddenVariants.includes(newVariant)) {
          violations.push({
            componentId: change.componentId,
            rule:        `components.${change.displayName}.forbiddenVariants`,
            severity:    'error',
            message:     `Variant "${newVariant}" is forbidden for ${change.displayName} by design system rules`,
          });
        }
      }
    }

    // prop_change: warn if a prop value is a hardcoded hex color that doesn't
    // match any value in dlf.tokens.colors. Design systems expect color props to
    // reference token names (e.g. "brand") not raw hex values ("#0F52BA").
    // Only fires when dlf.tokens.colors is populated (opt-in per DLF).
    if (change.changeType === 'prop_change' && dlf.tokens.colors) {
      const tokenColorValues = new Set(
        Object.values(dlf.tokens.colors).map(v => v.toLowerCase()),
      );
      const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      for (const [propKey, propValue] of Object.entries(change.after)) {
        if (typeof propValue === 'string' && HEX_RE.test(propValue)) {
          if (!tokenColorValues.has(propValue.toLowerCase())) {
            violations.push({
              componentId: change.componentId,
              rule:        `tokens.colors`,
              severity:    'warning',
              message:     `${change.displayName}.${propKey}="${propValue}" is a hardcoded color — use a DLF color token instead`,
            });
          }
        }
      }
    }
  }

  // layout_change → check spacing values against the DLF spacing scale.
  if (change.changeType === 'layout_change') {
    const spacingScale = dlf.tokens?.spacing;
    if (spacingScale) {
      const allowed = new Set(Object.values(spacingScale));
      const spacingProps = [
        'padding', 'margin', 'gap',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'marginTop',  'marginRight',  'marginBottom',  'marginLeft',
        'top', 'right', 'bottom', 'left',
      ];
      for (const key of spacingProps) {
        const val = change.after[key];
        if (val !== undefined && typeof val === 'string' && !allowed.has(val)) {
          violations.push({
            componentId: change.componentId,
            rule:        `tokens.spacing`,
            severity:    'warning',
            message:     `Spacing "${key}=${val}" is not in the design system spacing scale`,
          });
        }
      }
    }
    return { valid: violations.length === 0, violations };
  }

  // token_change → verify the new token name exists in dlf.tokens[category].
  if (change.changeType === 'token_change') {
    const newTokenName  = change.after['tokenName'];
    const tokenCategory = change.after['tokenCategory'] as string | undefined;

    if (typeof newTokenName === 'string' && tokenCategory) {
      const categoryMap: Record<string, Record<string, string> | undefined> = {
        colors:     dlf.tokens?.colors,
        typography: dlf.tokens?.typography,
        spacing:    dlf.tokens?.spacing,
        motion:     dlf.tokens?.motion,
      };
      const bucket = categoryMap[tokenCategory];
      if (bucket !== undefined && !Object.prototype.hasOwnProperty.call(bucket, newTokenName)) {
        violations.push({
          componentId: change.componentId,
          rule:        `tokens.${tokenCategory}.${newTokenName}`,
          severity:    'warning',
          message:     `Token "${newTokenName}" is not defined in the design language file under "${tokenCategory}"`,
        });
      }
    }
  }

  return { valid: violations.length === 0, violations };
}
