import { z } from 'zod';

// ── Token schemas ─────────────────────────────────────────────────────────────

export const ColorTokenSchema = z.object({
  value: z.string().regex(/^#[0-9A-Fa-f]{3,8}$|^rgba?\(|^hsl/, 'Must be a valid CSS color'),
  /** Fluent 2 token name this maps to, e.g. "colorBrandBackground" */
  fluentToken: z.string().optional(),
  description: z.string().optional(),
});

export const TypographyTokenSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.union([z.string(), z.number()]).optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  lineHeight: z.union([z.string(), z.number()]).optional(),
  letterSpacing: z.union([z.string(), z.number()]).optional(),
  fluentToken: z.string().optional(),
});

export const SpacingTokenSchema = z.object({
  value: z.union([z.string(), z.number()]),
  fluentToken: z.string().optional(),
});

export const MotionTokenSchema = z.object({
  duration: z.string().optional(),
  easing: z.string().optional(),
  fluentToken: z.string().optional(),
});

export const TokensSchema = z.object({
  colors: z.record(ColorTokenSchema).optional(),
  typography: z.record(TypographyTokenSchema).optional(),
  spacing: z.record(SpacingTokenSchema).optional(),
  motion: z.record(MotionTokenSchema).optional(),
});

// ── Component rules ───────────────────────────────────────────────────────────

export const PropRuleSchema = z.object({
  allowed: z.array(z.unknown()).optional(),
  forbidden: z.array(z.unknown()).optional(),
  required: z.boolean().optional(),
  type: z.string().optional(),
});

export const ComponentRuleSchema = z.object({
  /** Allowed prop values, keyed by prop name */
  props: z.record(PropRuleSchema).optional(),
  /** Fluent 2 variants that are explicitly forbidden */
  forbiddenVariants: z.array(z.string()).optional(),
  /** ARIA attributes that are required on this component */
  requiredAria: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ── Screen rules ──────────────────────────────────────────────────────────────

export const ScreenRuleSchema = z.object({
  /** Components that are allowed to appear on this screen */
  allowedComponents: z.array(z.string()).optional(),
  /** Components that must be present on this screen */
  requiredSections: z.array(z.string()).optional(),
  layout: z.string().optional(),
  notes: z.string().optional(),
});

// ── Voice / tone ──────────────────────────────────────────────────────────────

export const VoiceRuleSchema = z.object({
  tone: z.string().optional(),
  maxSentenceLength: z.number().optional(),
  avoidWords: z.array(z.string()).optional(),
  preferWords: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
});

// ── Accessibility ─────────────────────────────────────────────────────────────

export const AccessibilitySchema = z.object({
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional(),
  contrastRatio: z.number().optional(),
  customRules: z.array(z.string()).optional(),
});

// ── Design Language File ──────────────────────────────────────────────────────

export const DesignLanguageFileBodySchema = z.object({
  /** Semantic version, e.g. "1.0.0" */
  version: z.string().optional(),
  /** Human-readable name, e.g. "Acme Design System" */
  name: z.string().optional(),

  tokens: TokensSchema.optional(),

  /** Per-component rules, keyed by component display name */
  components: z.record(ComponentRuleSchema).optional(),

  /** Per-screen rules, keyed by screen name or route pattern */
  screens: z.record(ScreenRuleSchema).optional(),

  voice: VoiceRuleSchema.optional(),

  accessibility: AccessibilitySchema.optional(),
});

export type DesignLanguageFileBody = z.infer<typeof DesignLanguageFileBodySchema>;
export type Tokens = z.infer<typeof TokensSchema>;
export type ComponentRule = z.infer<typeof ComponentRuleSchema>;
export type ScreenRule = z.infer<typeof ScreenRuleSchema>;
