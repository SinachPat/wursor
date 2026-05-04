import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const OriginTypeSchema = z.enum([
  // Spec Layer 4 lowercase set (canonical)
  'route', 'linear', 'git', 'slack', 'feedback', 'fork', 'manual',
  // Legacy uppercase set (migration 001) — kept for backward compat
  'GIT_COMMIT', 'LINEAR_ISSUE', 'SLACK_MESSAGE', 'URL', 'FORK',
  // Canonical uppercase aliases (migration 007)
  'ROUTE', 'FEEDBACK', 'MANUAL',
]);
export type OriginType = z.infer<typeof OriginTypeSchema>;

export const DiffStatusSchema = z.enum([
  // Spec Layer 4 lowercase set (canonical)
  'draft', 'exported', 'acknowledged', 'implemented', 'rejected',
  // Legacy uppercase set — kept for backward compat
  'DRAFT', 'EXPORTED', 'IMPLEMENTED', 'BLOCKED',
  // UI-driven additions
  'ACKNOWLEDGED', 'REJECTED', 'REVIEWED', 'APPLIED',
]);
export type DiffStatus = z.infer<typeof DiffStatusSchema>;

export const TeamRoleSchema = z.enum(['OWNER', 'DESIGNER', 'ENGINEER', 'PM', 'VIEWER']);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const AgentTypeSchema = z.enum([
  // Spec lowercase (canonical)
  'cursor', 'claude-code', 'generic',
  // Legacy uppercase
  'CURSOR', 'CLAUDE_CODE', 'GENERIC',
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const WorkspacePlanSchema = z.enum(['FREE', 'TEAM', 'ENTERPRISE']);
export type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;

// ── Row types (match PostgreSQL columns 1:1) ─────────────────────────────��────

export const WorkspaceSchema = z.object({
  id:             z.string().uuid(),
  name:           z.string(),
  owner_id:       z.string(),
  plan:           WorkspacePlanSchema,
  settings_jsonb: z.record(z.unknown()),
  created_at:     z.string().datetime(),
  updated_at:     z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ArtboardSchema = z.object({
  id:                 z.string().uuid(),
  workspace_id:       z.string().uuid(),
  project_id:         z.string().uuid().nullable(),
  name:               z.string(),
  origin_id:          z.string().uuid().nullable(),
  parent_artboard_id: z.string().uuid().nullable(),
  /** Spec alias added migration 008 — mirrors parent_artboard_id */
  parent_id:          z.string().uuid().nullable().optional(),
  metadata_jsonb:     z.record(z.unknown()),
  route:              z.string().nullable().optional(),
  remote_url:         z.string().nullable().optional(),
  /** Spec: NOT NULL DEFAULT 1440 (migration 008) */
  width:              z.number().int().default(1440),
  /** Spec: NOT NULL DEFAULT 900 (migration 008) */
  height:             z.number().int().default(900),
  created_by:         z.string().optional(),
  created_at:         z.string().datetime(),
  updated_at:         z.string().datetime(),
});
export type Artboard = z.infer<typeof ArtboardSchema>;

export const OriginSchema = z.object({
  id:                    z.string().uuid(),
  type:                  OriginTypeSchema,
  source_ref:            z.string(),
  source_metadata_jsonb: z.record(z.unknown()),
  /** Spec Layer 4 FK: origins.artboard_id (added migration 008) */
  artboard_id:           z.string().uuid().nullable().optional(),
  source_id:             z.string().nullable().optional(),
  source_url:            z.string().nullable().optional(),
  screenshot_url:        z.string().nullable().optional(),
  created_at:            z.string().datetime(),
  updated_at:            z.string().datetime(),
});
export type Origin = z.infer<typeof OriginSchema>;

export const IntentDiffSchema = z.object({
  id:                 z.string().uuid(),
  artboard_id:        z.string().uuid(),
  author_id:          z.string(),
  /** Spec column name: changes (renamed from changes_jsonb in migration 008) */
  changes:            z.record(z.unknown()),
  /** Spec column name: aggregate_summary (renamed from summary in migration 008) */
  aggregate_summary:  z.string(),
  status:             DiffStatusSchema,
  notes:              z.string().optional(),
  session_id:         z.string().nullable().optional(),
  before_screenshot:  z.string().nullable().optional(),
  after_screenshot:   z.string().nullable().optional(),
  exported_code:      z.string().nullable().optional(),
  created_at:         z.string().datetime(),
  updated_at:         z.string().datetime(),
});
export type IntentDiff = z.infer<typeof IntentDiffSchema>;

export const AgentSessionSchema = z.object({
  id:             z.string().uuid(),
  artboard_id:    z.string().uuid(),
  diff_id:        z.string().uuid().nullable(),
  agent_type:     AgentTypeSchema,
  messages_jsonb: z.array(z.record(z.unknown())),
  status:         z.enum(['ACTIVE', 'COMPLETED', 'FAILED']),
  created_at:     z.string().datetime(),
  updated_at:     z.string().datetime(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;

export const DesignLanguageFileSchema = z.object({
  id:           z.string().uuid(),
  workspace_id: z.string().uuid(),
  name:         z.string(),
  schema_jsonb: z.record(z.unknown()),
  version:      z.number().int(),
  is_active:    z.boolean().optional(),
  created_by:   z.string().nullable().optional(),
  created_at:   z.string().datetime(),
  updated_at:   z.string().datetime(),
});
export type DesignLanguageFile = z.infer<typeof DesignLanguageFileSchema>;

export const TeamMemberSchema = z.object({
  id:           z.string().uuid(),
  workspace_id: z.string().uuid(),
  user_id:      z.string(),
  role:         TeamRoleSchema,
  created_at:   z.string().datetime(),
  updated_at:   z.string().datetime(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const ProjectSchema = z.object({
  id:           z.string().uuid(),
  workspace_id: z.string().uuid(),
  name:         z.string(),
  description:  z.string().nullable(),
  app_url:      z.string().nullable(),
  framework:    z.string().nullable(),
  created_at:   z.string().datetime(),
  updated_at:   z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ── Ancestry (from closure table) ────────────────────────────────────────────

export interface ArtboardAncestry {
  artboard_id: string;
  ancestor_id: string;
  depth: number;
}

// ── Insert types (omit server-set fields) ───────────────────��─────────────────

export type InsertWorkspace          = Omit<Workspace,           'id' | 'created_at' | 'updated_at'>;
/**
 * width/height are optional on insert because the DB column defaults are
 * 1440 and 900 respectively (migration 008). Callers may omit them.
 */
export type InsertArtboard           = Omit<Artboard,            'id' | 'created_at' | 'updated_at' | 'width' | 'height'>
                                     & { width?: number; height?: number };
export type InsertOrigin             = Omit<Origin,              'id' | 'created_at' | 'updated_at'>;
export type InsertIntentDiff         = Omit<IntentDiff,          'id' | 'created_at' | 'updated_at'>;
export type InsertAgentSession       = Omit<AgentSession,        'id' | 'created_at' | 'updated_at'>;
export type InsertDesignLanguageFile = Omit<DesignLanguageFile,  'id' | 'created_at' | 'updated_at'>;
export type InsertTeamMember         = Omit<TeamMember,          'id' | 'created_at' | 'updated_at'>;
export type InsertProject            = Omit<Project,             'id' | 'created_at' | 'updated_at'>;
