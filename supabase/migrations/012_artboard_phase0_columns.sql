-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012: Phase 0 artboard schema additions
-- Adds first-class typed columns for canvas position, device preset, artboard
-- type, isolation metadata, drag-positioning flag, and thumbnail storage URL.
--
-- Spec reference: SOURCE-AWARE-CANVAS §3.7 (schema additions for Phase 0)
-- All changes use IF NOT EXISTS / DO $$ guards for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── artboards: Phase 0 spatial + type columns ─────────────────────────────────
-- Promote canvas position from metadata_jsonb to proper typed columns so they
-- can be indexed and compared without casting. Existing artboards keep their
-- metadata_jsonb values; new columns default to common presets.

ALTER TABLE artboards ADD COLUMN IF NOT EXISTS canvas_x float8 DEFAULT 0;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS canvas_y float8 DEFAULT 0;

-- Backfill canvas_x/canvas_y from metadata_jsonb for existing artboards.
UPDATE artboards
SET
  canvas_x = (metadata_jsonb->>'x')::float8,
  canvas_y = (metadata_jsonb->>'y')::float8
WHERE
  canvas_x = 0 AND canvas_y = 0
  AND (metadata_jsonb ? 'x' OR metadata_jsonb ? 'y');

-- Device preset: which physical screen size preset the artboard was sized for.
-- Possible values: 'desktop-hd' | 'desktop-4k' | 'laptop' | 'tablet' | 'mobile'
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS device_preset text DEFAULT 'desktop-hd';

-- Artboard type controls which content renderer is used.
-- 'route'     → LiveArtboard iframe pointing at a dev-server route
-- 'isolation' → Isolation artboard wrapping a single component (Phase 3)
-- 'static'    → Plain static HTML / no React detected
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artboards' AND column_name = 'artboard_type'
  ) THEN
    ALTER TABLE artboards ADD COLUMN artboard_type text NOT NULL DEFAULT 'route'
      CHECK (artboard_type IN ('route', 'isolation', 'static'));
  END IF;
END $$;

-- Isolation artboard metadata (populated when artboard_type = 'isolation').
-- isolation_component: exported symbol name, e.g. "Button"
-- isolation_file:      workspace-relative path, e.g. "src/components/Button.tsx"
-- isolation_props:     JSON props object fed to window.__OM_ISO_PROPS__
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS isolation_component text;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS isolation_file      text;
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS isolation_props     jsonb DEFAULT '{}';

-- Drag-positioning flag: true once the user has manually moved this artboard
-- by ≥10 world-space pixels. Prevents the auto-arrange algorithm from
-- overwriting user-chosen positions.
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS manually_positioned boolean NOT NULL DEFAULT false;

-- Thumbnail URL: Supabase Storage public URL for the JPEG thumbnail captured
-- when the artboard transitions to 'far' viewport state.
-- The data URI itself is NEVER written here — only the Storage public URL.
-- Null until the first thumbnail is successfully uploaded.
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Index: quickly find all isolation artboards within a workspace
CREATE INDEX IF NOT EXISTS artboards_isolation_idx
  ON artboards (workspace_id, artboard_type)
  WHERE artboard_type = 'isolation';

-- ── intent_diffs: Phase 5 blocked_reason column ───────────────────────────────
-- Stores the agent-supplied reason when status = 'BLOCKED' (e.g. "merge conflict
-- in src/components/Button.tsx — please resolve manually before retrying").
-- Written by update_diff_status when status = 'BLOCKED'; null otherwise.
ALTER TABLE intent_diffs ADD COLUMN IF NOT EXISTS blocked_reason text;
