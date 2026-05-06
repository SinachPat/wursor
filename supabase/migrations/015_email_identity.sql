-- ── Migration 015: Email as universal user identity ───────────────────────────
--
-- Background
-- ----------
-- Prior migrations stored Clerk opaque user IDs (e.g. `user_2abc…`) in every
-- `user_id` / `owner_id` / `author_id` column. Those IDs are internal to Clerk
-- and cannot be resolved back to humans without an extra Clerk API call. The
-- only durable, human-readable identity available in this stack is the user's
-- primary email address.
--
-- What this migration does
-- ------------------------
--  1. Renames identity columns in all tables:
--       team_members.user_id   → email
--       workspaces.owner_id    → owner_email
--       intent_diffs.author_id → author_email
--
--  2. Drops all stale RLS policies that referenced the old column names or
--     used `auth.uid()::text` (which returns a UUID-shaped sub claim, not an
--     email) and recreates every policy to compare against
--     `auth.jwt() ->> 'email'` — the email claim injected by the Clerk
--     Supabase JWT template.
--
--  3. Updates the `is_workspace_member` helper function from migration 003
--     to use the renamed column.
--
-- Application changes (applied in tandem)
-- ----------------------------------------
--  • API routes use currentUser().primaryEmailAddress.emailAddress instead of
--    auth().userId for all DB identity lookups.
--  • The invite UI accepts an email address instead of a Clerk user ID.
--
-- Idempotency
-- -----------
-- Column renames are guarded by DO $$ blocks that skip if the target column
-- already exists. Policy drops use DROP … IF EXISTS. Safe to re-run.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Column renames
-- ══════════════════════════════════════════════════════════════════════════════

-- ── team_members: user_id → email ────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'email'
  ) THEN
    ALTER TABLE team_members RENAME COLUMN user_id TO email;
  END IF;
END $$;

-- Replace the unique constraint (workspace_id, user_id) with (workspace_id, email).
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_workspace_id_user_id_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_members_workspace_id_email_key'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_workspace_id_email_key UNIQUE (workspace_id, email);
  END IF;
END $$;

-- Replace the index.
DROP INDEX IF EXISTS team_members_user_id_idx;
CREATE INDEX IF NOT EXISTS team_members_email_idx ON team_members (email);

-- ── workspaces: owner_id → owner_email ───────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'owner_email'
  ) THEN
    ALTER TABLE workspaces RENAME COLUMN owner_id TO owner_email;
  END IF;
END $$;

DROP INDEX IF EXISTS workspaces_owner_id_idx;
CREATE INDEX IF NOT EXISTS workspaces_owner_email_idx ON workspaces (owner_email);

-- ── intent_diffs: author_id → author_email ───────────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intent_diffs' AND column_name = 'author_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intent_diffs' AND column_name = 'author_email'
  ) THEN
    ALTER TABLE intent_diffs RENAME COLUMN author_id TO author_email;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Drop all stale RLS policies
-- ══════════════════════════════════════════════════════════════════════════════

-- workspaces
DROP POLICY IF EXISTS workspaces_select                   ON workspaces;
DROP POLICY IF EXISTS workspaces_insert                   ON workspaces;
DROP POLICY IF EXISTS workspaces_update                   ON workspaces;
DROP POLICY IF EXISTS "workspace owner access"            ON workspaces;

-- artboards
DROP POLICY IF EXISTS artboards_select                    ON artboards;
DROP POLICY IF EXISTS artboards_insert                    ON artboards;
DROP POLICY IF EXISTS artboards_update                    ON artboards;
DROP POLICY IF EXISTS artboards_delete                    ON artboards;
DROP POLICY IF EXISTS "workspace member artboard access"  ON artboards;

-- origins
DROP POLICY IF EXISTS "workspace member origin access"    ON origins;

-- intent_diffs
DROP POLICY IF EXISTS intent_diffs_select                 ON intent_diffs;
DROP POLICY IF EXISTS intent_diffs_insert                 ON intent_diffs;
DROP POLICY IF EXISTS intent_diffs_update                 ON intent_diffs;
DROP POLICY IF EXISTS "workspace member diff access"      ON intent_diffs;

-- agent_sessions
DROP POLICY IF EXISTS agent_sessions_select               ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_insert               ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_update               ON agent_sessions;
DROP POLICY IF EXISTS "workspace member session access"   ON agent_sessions;

-- design_language_files
DROP POLICY IF EXISTS dlf_select                          ON design_language_files;
DROP POLICY IF EXISTS dlf_insert                          ON design_language_files;
DROP POLICY IF EXISTS dlf_update                          ON design_language_files;
DROP POLICY IF EXISTS "workspace member dlf access"       ON design_language_files;
DROP POLICY IF EXISTS dlf_workspace_select                ON design_language_files;
DROP POLICY IF EXISTS dlf_workspace_write                 ON design_language_files;

-- team_members
DROP POLICY IF EXISTS team_members_select                 ON team_members;
DROP POLICY IF EXISTS team_members_insert                 ON team_members;
DROP POLICY IF EXISTS team_members_delete                 ON team_members;

-- design_languages (migration 014)
DROP POLICY IF EXISTS dl_workspace_member_select          ON design_languages;
DROP POLICY IF EXISTS dl_workspace_member_write           ON design_languages;
DROP POLICY IF EXISTS "design_languages_workspace_member_select" ON design_languages;
DROP POLICY IF EXISTS "design_languages_workspace_member_insert" ON design_languages;
DROP POLICY IF EXISTS "design_languages_workspace_member_update" ON design_languages;

-- design_language_versions (migration 014)
DROP POLICY IF EXISTS dlv_workspace_member_select         ON design_language_versions;
DROP POLICY IF EXISTS "design_language_versions_workspace_member_select" ON design_language_versions;
DROP POLICY IF EXISTS "design_language_versions_workspace_member_insert" ON design_language_versions;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Update the is_workspace_member helper (migration 003)
-- ══════════════════════════════════════════════════════════════════════════════

-- Recreate with team_members.email and auth.jwt() ->> 'email'.
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE workspace_id = ws_id
      AND email = auth.jwt() ->> 'email'
  );
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Recreate all RLS policies with email-based identity
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Identity predicate throughout: auth.jwt() ->> 'email'
-- This reads the `email` claim from the Clerk Supabase JWT template.
--
-- For workspace owners the check is: workspaces.owner_email = auth.jwt() ->> 'email'
-- For general membership: team_members.email = auth.jwt() ->> 'email'

-- ── workspaces ────────────────────────────────────────────────────────────────

CREATE POLICY workspaces_select ON workspaces
  FOR SELECT
  USING (is_workspace_member(id));

CREATE POLICY workspaces_insert ON workspaces
  FOR INSERT
  WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY workspaces_update ON workspaces
  FOR UPDATE
  USING (owner_email = auth.jwt() ->> 'email');

-- ── artboards ─────────────────────────────────────────────────────────────────

CREATE POLICY artboards_select ON artboards
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY artboards_insert ON artboards
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY artboards_update ON artboards
  FOR UPDATE USING (is_workspace_member(workspace_id));

CREATE POLICY artboards_delete ON artboards
  FOR DELETE USING (is_workspace_member(workspace_id));

-- ── origins ───────────────────────────────────────────────────────────────────
-- Accepts both FK directions (spec: origins.artboard_id; legacy: artboards.origin_id).

CREATE POLICY "workspace member origin access" ON origins
  FOR ALL
  USING (
    -- spec-compliant: origins.artboard_id set to the artboard's uuid
    artboard_id IN (
      SELECT id FROM artboards
      WHERE is_workspace_member(workspace_id)
    )
    OR
    -- legacy: artboards.origin_id points at this origin row
    id IN (
      SELECT origin_id FROM artboards
      WHERE is_workspace_member(workspace_id)
        AND origin_id IS NOT NULL
    )
  );

-- ── intent_diffs ──────────────────────────────────────────────────────────────

CREATE POLICY intent_diffs_select ON intent_diffs
  FOR SELECT
  USING (is_workspace_member(
    (SELECT workspace_id FROM artboards WHERE id = artboard_id)
  ));

CREATE POLICY intent_diffs_insert ON intent_diffs
  FOR INSERT
  WITH CHECK (is_workspace_member(
    (SELECT workspace_id FROM artboards WHERE id = artboard_id)
  ));

CREATE POLICY intent_diffs_update ON intent_diffs
  FOR UPDATE
  USING (is_workspace_member(
    (SELECT workspace_id FROM artboards WHERE id = artboard_id)
  ));

-- ── agent_sessions ────────────────────────────────────────────────────────────

CREATE POLICY agent_sessions_select ON agent_sessions
  FOR SELECT
  USING (is_workspace_member(
    (SELECT workspace_id FROM artboards WHERE id = artboard_id)
  ));

CREATE POLICY agent_sessions_insert ON agent_sessions
  FOR INSERT
  WITH CHECK (is_workspace_member(
    (SELECT workspace_id FROM artboards WHERE id = artboard_id)
  ));

CREATE POLICY agent_sessions_update ON agent_sessions
  FOR UPDATE
  USING (is_workspace_member(
    (SELECT workspace_id FROM artboards WHERE id = artboard_id)
  ));

-- ── design_language_files ─────────────────────────────────────────────────────

CREATE POLICY dlf_workspace_select ON design_language_files
  FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY dlf_workspace_write ON design_language_files
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM team_members
      WHERE email = auth.jwt() ->> 'email'
        AND role IN ('OWNER', 'DESIGNER')
    )
  );

-- ── team_members ──────────────────────────────────────────────────────────────

CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (is_workspace_member(workspace_id));

-- Only workspace owners can add members.
CREATE POLICY team_members_insert ON team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id
        AND owner_email = auth.jwt() ->> 'email'
    )
  );

-- Owners can remove anyone; members can remove themselves.
CREATE POLICY team_members_delete ON team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id
        AND owner_email = auth.jwt() ->> 'email'
    )
    OR email = auth.jwt() ->> 'email'
  );

-- ── design_languages ──────────────────────────────────────────────────────────

CREATE POLICY dl_workspace_member_select ON design_languages
  FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY dl_workspace_member_write ON design_languages
  FOR ALL
  USING (is_workspace_member(workspace_id));

-- ── design_language_versions ──────────────────────────────────────────────────

CREATE POLICY dlv_workspace_member_select ON design_language_versions
  FOR SELECT
  USING (
    design_language_id IN (
      SELECT dl.id FROM design_languages dl
      WHERE is_workspace_member(dl.workspace_id)
    )
  );
