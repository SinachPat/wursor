-- ── Migration 006: Full-Text Search ──────────────────────────────────────────
-- Adds tsvector generated columns and GIN indexes to artboards and origins so
-- the natural-language cross-artboard query feature (Layer 10 / Phase 3) can do
-- weighted full-text search without re-scanning jsonb at query time.
--
-- search_artboards(query, workspace_id) is the primary search entry point.
-- It returns artboard rows ranked by text relevance using ts_rank_cd.

-- ── 1. Generated tsvector column on artboards ─────────────────────────────────
-- Covers: artboard name (weight A), route / renderUrl from metadata (weight B),
-- and the raw metadata_jsonb text (weight C).

ALTER TABLE artboards
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(metadata_jsonb::text, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS artboards_search_vector_idx
  ON artboards USING GIN (search_vector);

-- ── 2. Generated tsvector column on origins ───────────────────────────────────
-- Covers: source_ref (weight A), source_metadata_jsonb text (weight B).

ALTER TABLE origins
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(source_ref, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(source_metadata_jsonb::text, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS origins_search_vector_idx
  ON origins USING GIN (search_vector);

-- ── 3. Generated tsvector on intent_diffs ────────────────────────────────────
-- Covers: summary (weight A), changes_jsonb text (weight C).
-- Allows searching "show me every diff about the navigation bar" style queries.

ALTER TABLE intent_diffs
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(changes_jsonb::text, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS intent_diffs_search_vector_idx
  ON intent_diffs USING GIN (search_vector);

-- ── 4. search_artboards RPC ───────────────────────────────────────────────────
-- Parameters:
--   p_workspace_id  — scope results to a single workspace
--   p_query         — plain-text search string (converted to tsquery internally)
--   p_limit         — max rows to return (default 20)
--
-- Returns artboards ranked by text relevance. Joins to origins and intent_diffs
-- to boost matches found in provenance or diff history.
--
-- Plain-to-tsquery converts arbitrary user text into a safe tsquery, allowing
-- partial words and multi-word phrases without syntax errors.

CREATE OR REPLACE FUNCTION search_artboards(
  p_workspace_id  UUID,
  p_query         TEXT,
  p_limit         INTEGER DEFAULT 20
)
RETURNS TABLE (
  id              UUID,
  workspace_id    UUID,
  project_id      UUID,
  name            TEXT,
  origin_id       UUID,
  parent_artboard_id UUID,
  metadata_jsonb  JSONB,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  rank            FLOAT4
)
LANGUAGE SQL STABLE AS $$
  WITH q AS (
    SELECT plainto_tsquery('english', p_query) AS tsq
  )
  SELECT
    a.id,
    a.workspace_id,
    a.project_id,
    a.name,
    a.origin_id,
    a.parent_artboard_id,
    a.metadata_jsonb,
    a.created_at,
    a.updated_at,
    -- Combine artboard rank with a bonus for matching origins or diffs
    (
      ts_rank_cd(a.search_vector, q.tsq, 32) * 1.5 +
      coalesce((
        SELECT max(ts_rank_cd(d.search_vector, q.tsq, 32))
        FROM   intent_diffs d
        WHERE  d.artboard_id = a.id
          AND  d.search_vector @@ q.tsq
      ), 0) +
      coalesce((
        SELECT ts_rank_cd(o.search_vector, q.tsq, 32)
        FROM   origins o
        WHERE  o.id = a.origin_id
          AND  o.search_vector @@ q.tsq
      ), 0)
    ) AS rank
  FROM artboards a, q
  WHERE
    a.workspace_id = p_workspace_id
    AND (
      a.search_vector @@ q.tsq
      OR EXISTS (
        SELECT 1 FROM intent_diffs d
        WHERE  d.artboard_id   = a.id
          AND  d.search_vector @@ q.tsq
      )
      OR EXISTS (
        SELECT 1 FROM origins o
        WHERE  o.id             = a.origin_id
          AND  o.search_vector @@ q.tsq
      )
    )
  ORDER BY rank DESC, a.updated_at DESC
  LIMIT p_limit;
$$;
