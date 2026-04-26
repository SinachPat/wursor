-- Origin Graph — Artboard Ancestry Materialized View
-- Migration: 002
-- Pre-computes all ancestor/descendant relationships so the app never needs
-- recursive CTEs at query time. Updated automatically on artboards INSERT.

CREATE MATERIALIZED VIEW artboard_ancestry AS
WITH RECURSIVE ancestry(artboard_id, ancestor_id, depth) AS (
  -- Base: each artboard is at depth 0 relative to itself
  SELECT id AS artboard_id, id AS ancestor_id, 0 AS depth
  FROM artboards

  UNION ALL

  -- Recurse: walk up the parent chain
  SELECT a.id AS artboard_id, anc.ancestor_id, anc.depth + 1
  FROM artboards a
  JOIN ancestry anc ON a.parent_artboard_id = anc.artboard_id
)
SELECT artboard_id, ancestor_id, depth
FROM ancestry
WHERE artboard_id <> ancestor_id  -- exclude self-reference
ORDER BY artboard_id, depth;

CREATE UNIQUE INDEX artboard_ancestry_pk
  ON artboard_ancestry(artboard_id, ancestor_id);

CREATE INDEX artboard_ancestry_ancestor_idx
  ON artboard_ancestry(ancestor_id);

-- ── Refresh trigger ───────────────────────────────────────────────────────────
-- Refreshes the materialized view concurrently whenever an artboard is
-- inserted. CONCURRENTLY requires the unique index above — it allows reads
-- to continue during refresh.

CREATE OR REPLACE FUNCTION refresh_artboard_ancestry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY artboard_ancestry;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_artboard_ancestry_refresh
  AFTER INSERT OR UPDATE OF parent_artboard_id ON artboards
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_artboard_ancestry();
