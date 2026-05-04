-- ── Migration 011: Add route column to artboards FTS tsvector ────────────────
--
-- Problem:
--   Migration 006 created artboards.search_vector with only:
--     name (weight A) || metadata_jsonb::text (weight C)
--   The comment in 006 says route should be at weight B, but route didn't exist
--   until migration 007. Generated column expressions cannot be altered in-place
--   (pre-PG17) — the column must be dropped and re-added.
--
-- Fix:
--   Drop and recreate artboards.search_vector to include:
--     name    (weight A) — exact component/screen name matches rank highest
--     route   (weight B) — URL route matches rank highly (added by migration 007)
--     metadata_jsonb (weight C) — catch-all metadata text
--
--   Drop/re-add regenerates values for all existing rows automatically since
--   the column is GENERATED ALWAYS AS (stored computed column).
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing generated column (and its GIN index, which depends on it)
DROP INDEX IF EXISTS artboards_search_vector_idx;

ALTER TABLE artboards
  DROP COLUMN IF EXISTS search_vector;

-- Re-add with route at weight B
ALTER TABLE artboards
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(route, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(metadata_jsonb::text, '')), 'C')
  ) STORED;

-- Rebuild the GIN index on the updated column
CREATE INDEX artboards_search_vector_idx
  ON artboards USING GIN (search_vector);
