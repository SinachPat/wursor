-- ── Migration 002: Artboard Ancestry Guard ───────────────────────────────────
-- The artboard_ancestry closure table and its maintenance trigger are already
-- created in migration 001 (initial schema). This migration is a safe, idempotent
-- guard that ensures the trigger function and trigger exist as expected.
--
-- IMPORTANT: An earlier draft of this file attempted to create a MATERIALIZED
-- VIEW named artboard_ancestry, which would conflict with the table created in
-- 001. That approach has been superseded: the trigger-based closure table from
-- 001 is maintained incrementally (O(depth) per INSERT) which is far cheaper
-- than a full REFRESH MATERIALIZED VIEW CONCURRENTLY on every artboard insert.
-- Do NOT re-introduce the materialized view approach.

-- ── Ensure the ancestry maintenance trigger function exists ───────────────────
-- Uses CREATE OR REPLACE so the migration is idempotent; safe to re-run.

CREATE OR REPLACE FUNCTION maintain_artboard_ancestry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Self-row: every artboard is its own ancestor at depth 0.
  INSERT INTO artboard_ancestry (artboard_id, ancestor_id, depth)
  VALUES (NEW.id, NEW.id, 0)
  ON CONFLICT DO NOTHING;

  -- Inherit all ancestors of the parent at depth + 1.
  IF NEW.parent_artboard_id IS NOT NULL THEN
    INSERT INTO artboard_ancestry (artboard_id, ancestor_id, depth)
    SELECT NEW.id, ancestor_id, depth + 1
    FROM   artboard_ancestry
    WHERE  artboard_id = NEW.parent_artboard_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Ensure the trigger is attached ───────────────────────────────────────────
-- DROP + recreate is the idempotent way to ensure the trigger is attached
-- exactly once; IF NOT EXISTS for triggers requires PG 17+ so use this pattern.

DROP TRIGGER IF EXISTS artboards_ancestry_insert ON artboards;

CREATE TRIGGER artboards_ancestry_insert
  AFTER INSERT ON artboards
  FOR EACH ROW EXECUTE FUNCTION maintain_artboard_ancestry();

-- ── RPC helper: get all descendants of an artboard ───────────────────────────
-- Complements getArtboardAncestors() in origin-graph/queries.ts.
-- Returns direct + transitive descendants, ordered nearest-first.

CREATE OR REPLACE FUNCTION get_artboard_descendants(p_artboard_id UUID)
RETURNS TABLE (artboard_id UUID, depth INTEGER)
LANGUAGE SQL STABLE AS $$
  SELECT artboard_id, depth
  FROM   artboard_ancestry
  WHERE  ancestor_id  = p_artboard_id
    AND  artboard_id <> p_artboard_id   -- exclude self
  ORDER  BY depth, artboard_id;
$$;
