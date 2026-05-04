import { z } from 'zod';

// ── Design Language File Schema ───────────────────────────────────────────────
// Matches the spec exactly (Layer 5.1). This schema validates DLF files uploaded
// by teams. All fields must align with the spec — deviations break real uploads.

export const DesignLanguageFileBodySchema = z.object({
  /** Spec requires exactly '1.0' — reject any other version string. */
  version: z.literal('1.0'),

  /** Human-readable name, e.g. "Acme Design System" */
  name: z.string().optional(),

  tokens: z.object({
    /** name → hex or token reference, e.g. { "brand": "#0F52BA" } */
    colors:     z.record(z.string()),
    typography: z.record(z.string()),
    spacing:    z.record(z.string()),
    motion:     z.record(z.string()).optional(),
  }),

  /**
   * Per-component rules, keyed by component display name.
   * allowedProps: prop → array of allowed string values
   * forbiddenVariants: Fluent 2 variant strings that are prohibited
   * requiredAria: ARIA attribute names that must be present
   */
  components: z.record(z.object({
    allowedProps:      z.record(z.array(z.string())).optional(),
    forbiddenVariants: z.array(z.string()).optional(),
    requiredAria:      z.array(z.string()).optional(),
  })),

  /** Per-screen rules, keyed by screen name or route pattern */
  screens: z.record(z.object({
    allowedComponents:  z.array(z.string()).optional(),
    forbiddenComponents: z.array(z.string()).optional(),
    requiredSections:   z.array(z.string()).optional(),
  })).optional(),

  voice: z.object({
    /** Array of tone descriptors, e.g. ["friendly", "concise"] */
    tone:       z.array(z.string()),
    avoidWords: z.array(z.string()).optional(),
  }).optional(),

  accessibility: z.object({
    minContrastRatio:  z.number().default(4.5),
    minTouchTargetPx:  z.number().default(44),
    requireAltText:    z.boolean().default(true),
  }).optional(),
});

export type DesignLanguageFileBody = z.infer<typeof DesignLanguageFileBodySchema>;

// Convenience re-exports for downstream consumers
export type ComponentRule = NonNullable<DesignLanguageFileBody['components'][string]>;
export type ScreenRule    = NonNullable<NonNullable<DesignLanguageFileBody['screens']>[string]>;
export type Tokens        = DesignLanguageFileBody['tokens'];
