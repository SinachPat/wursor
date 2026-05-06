-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013: Phase 6 — Design Language Files table
--
-- Creates the `design_language_files` table used by the DLF token system.
-- Each row is one uploaded version of a workspace's token/constraint file.
-- Only one row per workspace is "active" at a time (enforced by partial index).
--
-- Spec reference: SOURCE-AWARE-CANVAS Phase 6 §9.2
-- All changes use IF NOT EXISTS / DO $$ guards for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS design_language_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  -- Full parsed token + constraint document stored as JSONB.
  -- Schema validated in-app before insert via DesignLanguageFileBodySchema.
  schema_jsonb jsonb       NOT NULL,
  version      integer     NOT NULL DEFAULT 1,
  -- Only one row per workspace should be active. The partial unique index below
  -- enforces this at the DB level. Use the deactivation step in the POST route
  -- to set this to false on all prior rows before inserting a new active one.
  is_active    boolean     NOT NULL DEFAULT false,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Fast lookup of the latest active file for a workspace.
CREATE INDEX IF NOT EXISTS design_language_files_workspace_version_idx
  ON design_language_files (workspace_id, version DESC);

-- Enforce at most one active row per workspace.
-- Partial unique index: only rows where is_active = true are checked.
CREATE UNIQUE INDEX IF NOT EXISTS design_language_files_one_active_per_workspace_idx
  ON design_language_files (workspace_id)
  WHERE (is_active = true);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_design_language_files_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_design_language_files_updated_at ON design_language_files;
CREATE TRIGGER trg_design_language_files_updated_at
  BEFORE UPDATE ON design_language_files
  FOR EACH ROW EXECUTE FUNCTION update_design_language_files_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Service-role key (used by API routes) bypasses RLS entirely.
-- Browser clients (anon or authenticated) are restricted to their workspace.

ALTER TABLE design_language_files ENABLE ROW LEVEL SECURITY;

-- Workspace members may read design language files for their workspace.
-- Relies on the `team_members` table introduced in migration 001.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_language_files' AND policyname = 'dlf_workspace_select'
  ) THEN
    CREATE POLICY dlf_workspace_select ON design_language_files
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT workspace_id FROM team_members
          WHERE user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- Only workspace owners / designers may insert / update.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'design_language_files' AND policyname = 'dlf_workspace_write'
  ) THEN
    CREATE POLICY dlf_workspace_write ON design_language_files
      FOR ALL
      USING (
        workspace_id IN (
          SELECT workspace_id FROM team_members
          WHERE user_id = auth.uid()::text
            AND role IN ('OWNER', 'DESIGNER')
        )
      );
  END IF;
END $$;
