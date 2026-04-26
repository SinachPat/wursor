-- Origin Graph — Row-Level Security Policies
-- Migration: 003
-- All tables are workspace-scoped. A user may only read or write rows in
-- workspaces where they have a team_members record. The Clerk JWT is verified
-- server-side; auth.uid() maps to the Clerk user_id column.

-- Enable RLS on every table
ALTER TABLE workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE artboards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE origins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_diffs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_language_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members        ENABLE ROW LEVEL SECURITY;

-- ── Helper: is the current user a member of the given workspace? ──────────────

CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()::TEXT
  );
$$;

-- ── workspaces ────────────────────────────────────────────────────────────────

CREATE POLICY workspaces_select ON workspaces
  FOR SELECT USING (is_workspace_member(id));

CREATE POLICY workspaces_insert ON workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid()::TEXT);

CREATE POLICY workspaces_update ON workspaces
  FOR UPDATE USING (owner_id = auth.uid()::TEXT);

-- ── artboards ─────────────────────────────────────────────────────────────────

CREATE POLICY artboards_select ON artboards
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY artboards_insert ON artboards
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY artboards_update ON artboards
  FOR UPDATE USING (is_workspace_member(workspace_id));

CREATE POLICY artboards_delete ON artboards
  FOR DELETE USING (is_workspace_member(workspace_id));

-- ── intent_diffs ──────────────────────────────────────────────────────────────
-- Derived from artboard's workspace membership
CREATE POLICY intent_diffs_select ON intent_diffs
  FOR SELECT USING (
    is_workspace_member((SELECT workspace_id FROM artboards WHERE id = artboard_id))
  );

CREATE POLICY intent_diffs_insert ON intent_diffs
  FOR INSERT WITH CHECK (
    is_workspace_member((SELECT workspace_id FROM artboards WHERE id = artboard_id))
  );

CREATE POLICY intent_diffs_update ON intent_diffs
  FOR UPDATE USING (
    is_workspace_member((SELECT workspace_id FROM artboards WHERE id = artboard_id))
  );

-- ── agent_sessions ────────────────────────────────────────────────────────────

CREATE POLICY agent_sessions_select ON agent_sessions
  FOR SELECT USING (
    is_workspace_member((SELECT workspace_id FROM artboards WHERE id = artboard_id))
  );

CREATE POLICY agent_sessions_insert ON agent_sessions
  FOR INSERT WITH CHECK (
    is_workspace_member((SELECT workspace_id FROM artboards WHERE id = artboard_id))
  );

CREATE POLICY agent_sessions_update ON agent_sessions
  FOR UPDATE USING (
    is_workspace_member((SELECT workspace_id FROM artboards WHERE id = artboard_id))
  );

-- ── design_language_files ─────────────────────────────────────────────────────

CREATE POLICY dlf_select ON design_language_files
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY dlf_insert ON design_language_files
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY dlf_update ON design_language_files
  FOR UPDATE USING (is_workspace_member(workspace_id));

-- ── team_members ──────────────────────────────────────────────────────────────

CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (is_workspace_member(workspace_id));

-- Only workspace owners can add/remove members
CREATE POLICY team_members_insert ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid()::TEXT)
  );

CREATE POLICY team_members_delete ON team_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid()::TEXT)
  );
