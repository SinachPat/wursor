-- ── Migration 007: Spec Compliance ───────────────────────────────────────────
-- Adds the columns and constraint values that were specified in the Layer 4-5
-- design but omitted from migration 001. All additions are additive (nullable
-- columns, expanded CHECK constraint value sets) so existing rows remain valid.
--
-- Tables touched:
--   origins              — source_id, source_url, screenshot_url
--   intent_diffs         — session_id, before_screenshot, after_screenshot,
--                          exported_code + expanded status CHECK
--   design_language_files — is_active, created_by
--   artboards            — route, remote_url, width, height, created_by
--                          + expanded origin type CHECK via origins table

-- ── 1. origins — provenance fields ───────────────────────────────────────────
-- The spec required source_id (e.g. Linear issue ID, Git SHA, Slack message TS),
-- a canonical source_url, and a screenshot_url for the origin artifact.
-- All nullable — not every origin type has all three fields.

ALTER TABLE origins
  ADD COLUMN IF NOT EXISTS source_id     text,
  ADD COLUMN IF NOT EXISTS source_url    text,
  ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Expand the origin type CHECK to include the spec's lowercase values alongside
-- the existing uppercase ones. PostgreSQL CHECK is re-evaluated on INSERT/UPDATE
-- only, so existing rows are unaffected.
ALTER TABLE origins
  DROP CONSTRAINT IF EXISTS origins_type_check;

ALTER TABLE origins
  ADD CONSTRAINT origins_type_check
    CHECK (type IN (
      -- Original uppercase set
      'GIT_COMMIT', 'LINEAR_ISSUE', 'SLACK_MESSAGE', 'URL', 'FORK',
      -- Spec Layer 4 lowercase set
      'route', 'linear', 'git', 'slack', 'feedback', 'fork', 'manual',
      -- Canonical aliases
      'ROUTE', 'FEEDBACK', 'MANUAL'
    ));

-- ── 2. intent_diffs — lifecycle fields ───────────────────────────────────────
-- session_id links a diff back to the agent session that produced it.
-- before/after screenshots enable the visual diff view in the export panel.
-- exported_code stores the generated TypeScript/JSX expressing the changes.

ALTER TABLE intent_diffs
  ADD COLUMN IF NOT EXISTS session_id        text,
  ADD COLUMN IF NOT EXISTS before_screenshot text,
  ADD COLUMN IF NOT EXISTS after_screenshot  text,
  ADD COLUMN IF NOT EXISTS exported_code     text;

-- Expand the status CHECK to include all values used by the spec and the UI.
-- Original:  DRAFT, EXPORTED, IMPLEMENTED, BLOCKED
-- Spec adds: acknowledged, rejected  (lowercase in spec, uppercase in app)
-- App uses:  REVIEWED, APPLIED (from Inspector STATUS_COLOR map)
ALTER TABLE intent_diffs
  DROP CONSTRAINT IF EXISTS intent_diffs_status_check;

ALTER TABLE intent_diffs
  ADD CONSTRAINT intent_diffs_status_check
    CHECK (status IN (
      'DRAFT', 'EXPORTED', 'IMPLEMENTED', 'BLOCKED',
      'ACKNOWLEDGED', 'REJECTED',
      'REVIEWED', 'APPLIED'
    ));

-- Update the get_diffs_by_status RPC to accept the full value set.
-- The function body is unchanged; only the type comment is refreshed.
CREATE OR REPLACE FUNCTION get_diffs_by_status(p_workspace_id uuid, p_status text)
RETURNS SETOF intent_diffs
LANGUAGE SQL STABLE AS $$
  SELECT d.*
  FROM   intent_diffs d
  JOIN   artboards    a ON a.id = d.artboard_id
  WHERE  a.workspace_id = p_workspace_id
    AND  d.status       = p_status
  ORDER  BY d.created_at DESC;
$$;

-- ── 3. design_language_files — activation + ownership ────────────────────────
-- is_active provides the spec's boolean gate for "is this DLF in effect?"
-- The existing schema uses version + max(version) query for the active file;
-- is_active supplements that pattern and also enables instant deactivation
-- without incrementing the version.
-- created_by stores the Clerk user ID of the uploader (audit trail).

ALTER TABLE design_language_files
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by text;

-- Index for the "get active DLF for workspace" query pattern.
CREATE INDEX IF NOT EXISTS design_language_files_is_active_idx
  ON design_language_files (workspace_id, is_active, version DESC);

-- ── 4. artboards — explicit dimensional + provenance columns ─────────────────
-- The spec modelled these as first-class columns. The existing schema stores
-- them in metadata_jsonb instead. Adding as nullable explicit columns lets both
-- patterns coexist: old rows keep metadata_jsonb, new rows can set either/both.
-- No NOT NULL constraints so zero migration cost for existing rows.

ALTER TABLE artboards
  ADD COLUMN IF NOT EXISTS route      text,
  ADD COLUMN IF NOT EXISTS remote_url text,
  ADD COLUMN IF NOT EXISTS width      integer,
  ADD COLUMN IF NOT EXISTS height     integer,
  ADD COLUMN IF NOT EXISTS created_by text;

-- Partial index: quickly find all artboards with an explicit route set.
CREATE INDEX IF NOT EXISTS artboards_route_idx
  ON artboards (workspace_id, route)
  WHERE route IS NOT NULL;
