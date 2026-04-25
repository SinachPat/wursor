import { z } from 'zod';

// ── Component snapshot ────────────────────────────────────────────────────────

export interface ComponentSnapshot {
  id: string;
  name: string;
  filePath?: string;
  props: Record<string, unknown>;
  styles?: Record<string, string>;
  children?: ComponentSnapshot[];
}

export const ComponentSnapshotSchema: z.ZodType<ComponentSnapshot> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    filePath: z.string().optional(),
    props: z.record(z.unknown()),
    styles: z.record(z.string()).optional(),
    children: z.array(ComponentSnapshotSchema).optional(),
  })
) as z.ZodType<ComponentSnapshot>;

// ── Change types ──────────────────────────────────────────────────────────────

export const ChangeTypeSchema = z.enum(['added', 'removed', 'modified', 'unchanged']);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const PropChangeSchema = z.object({
  key: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  changeType: ChangeTypeSchema,
});
export type PropChange = z.infer<typeof PropChangeSchema>;

// ── Component diff ────────────────────────────────────────────────────────────

export interface ComponentDiff {
  id: string;
  name: string;
  changeType: ChangeType;
  propChanges: PropChange[];
  styleChanges: PropChange[];
  patch: string;
  childDiffs?: ComponentDiff[];
}

export const ComponentDiffSchema: z.ZodType<ComponentDiff> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    changeType: ChangeTypeSchema,
    propChanges: z.array(PropChangeSchema),
    styleChanges: z.array(PropChangeSchema),
    patch: z.string(),
    childDiffs: z.array(ComponentDiffSchema).optional(),
  })
) as z.ZodType<ComponentDiff>;

// ── Layout ────────────────────────────────────────────────────────────────────

export const DiffLayoutSchema = z.enum(['split', 'unified']);
export type DiffLayout = z.infer<typeof DiffLayoutSchema>;
