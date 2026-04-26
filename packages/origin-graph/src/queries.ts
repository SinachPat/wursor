// ── Query interface ───────────────────────────────────────────────────────────
// These functions describe the Origin Graph query surface. They accept a
// generic `db` client (matching Supabase's SupabaseClient shape) so the
// package doesn't take a hard dependency on @supabase/supabase-js. Wire them
// to TanStack Query's queryFn in the app layer.

import type {
  Artboard,
  Workspace,
  Origin,
  IntentDiff,
  DesignLanguageFile,
  AgentSession,
  TeamMember,
  Project,
  InsertArtboard,
  InsertOrigin,
  InsertIntentDiff,
  InsertAgentSession,
  InsertTeamMember,
  InsertProject,
  DiffStatus,
  ArtboardAncestry,
} from './types.js';

// ── Minimal Supabase client interface ────────────────────────────────────────

export interface DbClient {
  from(table: string): {
    select(cols?: string): DbQuery;
    insert(row: unknown): DbMutation;
    update(row: unknown): DbMutation;
    delete(): DbMutation;
  };
  rpc(fn: string, args?: unknown): Promise<{ data: unknown; error: DbError | null }>;
}

export interface DbQuery {
  eq(col: string, val: unknown): DbQuery;
  in(col: string, vals: unknown[]): DbQuery;
  order(col: string, opts?: { ascending?: boolean }): DbQuery;
  limit(n: number): DbQuery;
  single(): Promise<{ data: unknown; error: DbError | null }>;
  then(resolve: (result: { data: unknown[]; error: DbError | null }) => void): void;
}

export interface DbMutation {
  eq(col: string, val: unknown): DbMutation;
  select(cols?: string): DbMutation;
  single(): Promise<{ data: unknown; error: DbError | null }>;
  then(resolve: (result: { data: unknown; error: DbError | null }) => void): void;
}

export interface DbError {
  message: string;
  code?: string;
}

// ── Artboard queries ──────────────────────────────────────────────────────────

export async function getArtboards(
  db: DbClient,
  workspaceId: string,
  projectId?: string,
): Promise<Artboard[]> {
  let q: DbQuery = db
    .from('artboards')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await (q.order('created_at', { ascending: false }) as unknown as Promise<{ data: Artboard[]; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function getArtboard(db: DbClient, id: string): Promise<Artboard> {
  const { data, error } = await (db
    .from('artboards')
    .select('*')
    .eq('id', id)
    .single() as Promise<{ data: Artboard; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function createArtboard(db: DbClient, row: InsertArtboard): Promise<Artboard> {
  const { data, error } = await (db
    .from('artboards')
    .insert(row)
    .select()
    .single() as Promise<{ data: Artboard; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function updateArtboard(
  db: DbClient,
  id: string,
  patch: Partial<InsertArtboard>,
): Promise<Artboard> {
  const { data, error } = await (db
    .from('artboards')
    .update(patch)
    .eq('id', id)
    .select()
    .single() as Promise<{ data: Artboard; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteArtboard(db: DbClient, id: string): Promise<void> {
  const { error } = await (db
    .from('artboards')
    .delete()
    .eq('id', id) as unknown as Promise<{ data: unknown; error: DbError | null }>);
  if (error) throw new Error(error.message);
}

export async function getArtboardAncestors(db: DbClient, artboardId: string): Promise<ArtboardAncestry[]> {
  const { data, error } = await (db
    .from('artboard_ancestry')
    .select('*')
    .eq('artboard_id', artboardId)
    .order('depth', { ascending: true }) as unknown as Promise<{ data: ArtboardAncestry[]; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

// ── Intent diff queries ───────────────────────────────────────────────────────

export async function getDiffs(db: DbClient, artboardId: string): Promise<IntentDiff[]> {
  const { data, error } = await (db
    .from('intent_diffs')
    .select('*')
    .eq('artboard_id', artboardId)
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: IntentDiff[]; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function getDiffsByStatus(db: DbClient, workspaceId: string, status: DiffStatus): Promise<IntentDiff[]> {
  // Join through artboards for workspace scoping
  const { data, error } = await (db.rpc('get_diffs_by_status', { p_workspace_id: workspaceId, p_status: status }) as Promise<{ data: IntentDiff[]; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data as IntentDiff[];
}

export async function createDiff(db: DbClient, row: InsertIntentDiff): Promise<IntentDiff> {
  const { data, error } = await (db
    .from('intent_diffs')
    .insert(row)
    .select()
    .single() as Promise<{ data: IntentDiff; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function getDiff(db: DbClient, id: string): Promise<IntentDiff> {
  const { data, error } = await (db
    .from('intent_diffs')
    .select('*')
    .eq('id', id)
    .single() as Promise<{ data: IntentDiff; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDiffStatus(
  db: DbClient,
  id: string,
  status: DiffStatus,
  notes?: string
): Promise<IntentDiff> {
  const { data, error } = await (db
    .from('intent_diffs')
    .update({ status, ...(notes !== undefined ? { notes } : {}) })
    .eq('id', id)
    .select()
    .single() as Promise<{ data: IntentDiff; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

// ── Design language file queries ──────────────────────────────────────────────

export async function getActiveDesignLanguageFile(
  db: DbClient,
  workspaceId: string
): Promise<DesignLanguageFile | null> {
  const { data, error } = await (db
    .from('design_language_files')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('version', { ascending: false })
    .limit(1)
    .single() as Promise<{ data: DesignLanguageFile | null; error: DbError | null }>);
  if (error?.code === 'PGRST116') return null; // No rows found
  if (error) throw new Error(error.message);
  return data;
}

// ── Origin queries ────────────────────────────────────────────────────────────

export async function createOrigin(db: DbClient, row: InsertOrigin): Promise<Origin> {
  const { data, error } = await (db
    .from('origins')
    .insert(row)
    .select()
    .single() as Promise<{ data: Origin; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

// ── Agent session queries ─────────────────────────────────────────────────────

export async function createAgentSession(db: DbClient, row: InsertAgentSession): Promise<AgentSession> {
  const { data, error } = await (db
    .from('agent_sessions')
    .insert(row)
    .select()
    .single() as Promise<{ data: AgentSession; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

// ── Workspace queries ─────────────────────────────────────────────────────────

export async function getWorkspace(db: DbClient, id: string): Promise<Workspace> {
  const { data, error } = await (db
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single() as Promise<{ data: Workspace; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function getTeamMembers(db: DbClient, workspaceId: string): Promise<TeamMember[]> {
  const { data, error } = await (db
    .from('team_members')
    .select('*')
    .eq('workspace_id', workspaceId) as unknown as Promise<{ data: TeamMember[]; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function addTeamMember(db: DbClient, row: InsertTeamMember): Promise<TeamMember> {
  const { data, error } = await (db
    .from('team_members')
    .insert(row)
    .select()
    .single() as Promise<{ data: TeamMember; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function removeTeamMember(
  db: DbClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const { error } = await (db
    .from('team_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId) as unknown as Promise<{ data: unknown; error: DbError | null }>);
  if (error) throw new Error(error.message);
}

export async function updateWorkspace(
  db: DbClient,
  id: string,
  patch: { name?: string },
): Promise<Workspace> {
  const { data, error } = await (db
    .from('workspaces')
    .update(patch)
    .eq('id', id)
    .select()
    .single() as Promise<{ data: Workspace; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

// ── Project queries ───────────────────────────────────────────────────────────

export async function getProject(db: DbClient, id: string): Promise<Project> {
  const { data, error } = await (db
    .from('projects')
    .select('*')
    .eq('id', id)
    .single() as Promise<{ data: Project; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function createProject(db: DbClient, row: InsertProject): Promise<Project> {
  const { data, error } = await (db
    .from('projects')
    .insert(row)
    .select()
    .single() as Promise<{ data: Project; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProject(
  db: DbClient,
  id: string,
  patch: Partial<InsertProject>,
): Promise<Project> {
  const { data, error } = await (db
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select()
    .single() as Promise<{ data: Project; error: DbError | null }>);
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProject(db: DbClient, id: string): Promise<void> {
  const { error } = await (db
    .from('projects')
    .delete()
    .eq('id', id) as unknown as Promise<{ data: unknown; error: DbError | null }>);
  if (error) throw new Error(error.message);
}
