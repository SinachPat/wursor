import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const OriginTypeSchema = z.enum([
  'GIT_COMMIT',
  'LINEAR_ISSUE',
  'SLACK_MESSAGE',
  'URL',
  'FORK',
]);
export type OriginType = z.infer<typeof OriginTypeSchema>;

export const DiffStatusSchema = z.enum([
  'DRAFT',
  'EXPORTED',
  'IMPLEMENTED',
  'BLOCKED',
]);
export type DiffStatus = z.infer<typeof DiffStatusSchema>;

export const TeamRoleSchema = z.enum([
  'OWNER',
  'DESIGNER',
  'ENGINEER',
  'PM',
  'VIEWER',
]);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const AgentTypeSchema = z.enum(['CURSOR', 'CLAUDE_CODE', 'GENERIC']);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const WorkspacePlanSchema = z.enum(['FREE', 'TEAM', 'ENTERPRISE']);
export type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;

// ── Row types (match PostgreSQL columns 1:1) ──────────────────────────────────

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  owner_id: z.string(),
  plan: WorkspacePlanSchema,
  settings_jsonb: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ArtboardSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  origin_id: z.string().uuid().nullable(),
  parent_artboard_id: z.string().uuid().nullable(),
  metadata_jsonb: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Artboard = z.infer<typeof ArtboardSchema>;

export const OriginSchema = z.object({
  id: z.string().uuid(),
  type: OriginTypeSchema,
  source_ref: z.string(),
  source_metadata_jsonb: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Origin = z.infer<typeof OriginSchema>;

export const IntentDiffSchema = z.object({
  id: z.string().uuid(),
  artboard_id: z.string().uuid(),
  author_id: z.string(),
  changes_jsonb: z.record(z.unknown()),
  summary: z.string(),
  status: DiffStatusSchema,
  /** Free-text notes from the coding agent (e.g. why it was blocked) */
  notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type IntentDiff = z.infer<typeof IntentDiffSchema>;

export const AgentSessionSchema = z.object({
  id: z.string().uuid(),
  artboard_id: z.string().uuid(),
  diff_id: z.string().uuid().nullable(),
  agent_type: AgentTypeSchema,
  messages_jsonb: z.array(z.record(z.unknown())),
  status: z.enum(['ACTIVE', 'COMPLETED', 'FAILED']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;

export const DesignLanguageFileSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  schema_jsonb: z.record(z.unknown()),
  version: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type DesignLanguageFile = z.infer<typeof DesignLanguageFileSchema>;

export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  user_id: z.string(),
  role: TeamRoleSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

// ── Project ───────────────────────────────────────────────────────────────────

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

// ── Ancestry (from materialized view) ────────────────────────────────────────

export interface ArtboardAncestry {
  artboard_id: string;
  ancestor_id: string;
  depth: number;
}

// ── Insert types (omit server-set fields) ────────────────────────────────────

export type InsertWorkspace = Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;
export type InsertArtboard = Omit<Artboard, 'id' | 'created_at' | 'updated_at'>;
export type InsertOrigin = Omit<Origin, 'id' | 'created_at' | 'updated_at'>;
export type InsertIntentDiff = Omit<IntentDiff, 'id' | 'created_at' | 'updated_at'>;
export type InsertAgentSession = Omit<AgentSession, 'id' | 'created_at' | 'updated_at'>;
export type InsertDesignLanguageFile = Omit<DesignLanguageFile, 'id' | 'created_at' | 'updated_at'>;
export type InsertTeamMember = Omit<TeamMember, 'id' | 'created_at' | 'updated_at'>;
export type InsertProject = Omit<Project, 'id' | 'created_at' | 'updated_at'>;
