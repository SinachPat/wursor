-- ── Migration 014: design_languages & design_language_versions ────────────────
-- spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.10 "DB Schema"
--
-- Stores the active Design Language (token file) for each workspace and
-- maintains a versioned history so designers can roll back to any prior upload.
--
-- Tables:
--   design_languages          — one row per workspace (current active version)
--   design_language_versions  — append-only version history (last 10 kept by trigger)
--
-- Identity note:
--   team_members.email is the authoritative user identifier (migration 015
--   renames user_id → email). RLS policies here use auth.jwt() ->> 'email'
--   to match the Clerk JWT template that injects the user's primary email as
--   the `email` claim.
--
-- Security:
--   RLS enabled on both tables; users can only access their own workspace rows.
--   The prune trigger runs as the table owner (SECURITY DEFINER) so it can
--   delete old version rows regardless of the invoking user's RLS policies.

-- ── design_languages ─────────────────────────────────────────────────────────
-- One row per workspace — UPSERT on every upload to keep this table small.

CREATE TABLE IF NOT EXISTS design_languages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL UNIQUE,
  name          text        NOT NULL DEFAULT 'Design Language',
  -- Full raw token file JSON as uploaded (before normalisation).
  raw_json      jsonb       NOT NULL,
  -- Normalised DesignToken[] flat array (produced by the Phase 6 parser).
  normalized    jsonb       NOT NULL,
  -- Detected source format: 'dtcg' | 'style-dictionary' | 'flat-css-vars'
  source_format text        NOT NULL,
  -- Number of tokens in the normalised array (for quick display).
  token_count   integer     NOT NULL DEFAULT 0,
  -- Monotonically increasing version counter — starts at 1.
  version       integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Enforce allowed source_format values.
ALTER TABLE design_languages
  ADD CONSTRAINT design_languages_source_format_check
  CHECK (source_format IN ('dtcg', 'style-dictionary', 'flat-css-vars'));

-- Index for workspace lookups (already implicit from UNIQUE constraint, but
-- explicit for clarity in query plans).
CREATE INDEX IF NOT EXISTS design_languages_workspace_id_idx
  ON design_languages (workspace_id);

-- ── design_language_versions ──────────────────────────────────────────────────
-- Append-only history; pruned to last 10 entries per design_language by trigger.

CREATE TABLE IF NOT EXISTS design_language_versions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  design_language_id  uuid        NOT NULL REFERENCES design_languages(id) ON DELETE CASCADE,
  version             integer     NOT NULL,
  raw_json            jsonb       NOT NULL,
  normalized          jsonb       NOT NULL,
  source_format       text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_language_id, version)
);

ALTER TABLE design_language_versions
  ADD CONSTRAINT design_language_versions_source_format_check
  CHECK (source_format IN ('dtcg', 'style-dictionary', 'flat-css-vars'));

CREATE INDEX IF NOT EXISTS design_language_versions_dl_id_idx
  ON design_language_versions (design_language_id);

-- ── Prune trigger ─────────────────────────────────────────────────────────────
-- After every INSERT into design_language_versions, delete all rows for the
-- same design_language_id except the 10 most-recent (by version DESC).
-- Keeps storage bounded without requiring a separate cron job.
-- Runs as SECURITY DEFINER so it can bypass RLS on the versions table.

CREATE OR REPLACE FUNCTION prune_design_language_versions()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  DELETE FROM design_language_versions
  WHERE design_language_id = NEW.design_language_id
    AND id NOT IN (
      SELECT id
      FROM design_language_versions
      WHERE design_language_id = NEW.design_language_id
      ORDER BY version DESC
      LIMIT 10
    );
  RETURN NULL; -- AFTER trigger; return value is ignored
END;
$$;

CREATE TRIGGER prune_design_language_versions_trigger
  AFTER INSERT ON design_language_versions
  FOR EACH ROW
  EXECUTE FUNCTION prune_design_language_versions();

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'design_languages_set_updated_at'
      AND tgrelid = 'design_languages'::regclass
  ) THEN
    CREATE TRIGGER design_languages_set_updated_at
      BEFORE UPDATE ON design_languages
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- API routes use the service-role key (bypasses RLS entirely).
-- These policies guard direct browser / anon-key access.
--
-- User identity: auth.jwt() ->> 'email' — set by the Clerk Supabase JWT
-- template which injects the user's verified primary email as the `email` claim.
-- This matches team_members.email (the authoritative identity column after
-- migration 015 renames user_id → email).
--
-- NOTE: these policies reference team_members.email. Migration 015 performs
-- that rename; if run before 015, team_members.user_id must be substituted
-- below. In practice migrations run in order so 014 always precedes 015.
-- The policies are dropped and recreated by migration 015 once the column
-- exists under its final name.

ALTER TABLE design_languages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_language_versions  ENABLE ROW LEVEL SECURITY;

-- Deny all anon access (belt-and-suspenders with the service-role default).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_languages' AND policyname = 'dl_no_anon'
  ) THEN
    CREATE POLICY dl_no_anon ON design_languages FOR ALL TO anon USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_language_versions' AND policyname = 'dlv_no_anon'
  ) THEN
    CREATE POLICY dlv_no_anon ON design_language_versions FOR ALL TO anon USING (false);
  END IF;
END $$;

-- design_languages: workspace members may read / write their workspace row.
-- (Migration 015 drops and recreates these after renaming user_id → email.)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_languages'
      AND policyname = 'dl_workspace_member_select'
  ) THEN
    CREATE POLICY dl_workspace_member_select ON design_languages
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT workspace_id FROM team_members
          WHERE user_id = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_languages'
      AND policyname = 'dl_workspace_member_write'
  ) THEN
    CREATE POLICY dl_workspace_member_write ON design_languages
      FOR ALL
      USING (
        workspace_id IN (
          SELECT workspace_id FROM team_members
          WHERE user_id = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;

-- design_language_versions: workspace members may read; inserts go via the
-- application layer (service role), deletes via the prune trigger.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_language_versions'
      AND policyname = 'dlv_workspace_member_select'
  ) THEN
    CREATE POLICY dlv_workspace_member_select ON design_language_versions
      FOR SELECT
      USING (
        design_language_id IN (
          SELECT dl.id FROM design_languages dl
          JOIN team_members tm ON tm.workspace_id = dl.workspace_id
          WHERE tm.user_id = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;
