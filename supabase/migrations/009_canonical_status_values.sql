-- migration 009 — Add spec-canonical lowercase status values to intent_diffs CHECK
-- Spec Layer 4: canonical status values are lowercase:
--   'draft', 'exported', 'acknowledged', 'implemented', 'rejected'
-- The current CHECK (from migration 007) only allows uppercase values.
-- New code (Inspector.tsx, CompletionZone.tsx) inserts lowercase 'draft'.
-- This migration expands the CHECK to accept both cases so both old and new
-- code work without a breaking schema change.

ALTER TABLE intent_diffs
  DROP CONSTRAINT IF EXISTS intent_diffs_status_check;

ALTER TABLE intent_diffs
  ADD CONSTRAINT intent_diffs_status_check
    CHECK (status IN (
      -- Spec-canonical lowercase (Layer 4)
      'draft', 'exported', 'acknowledged', 'implemented', 'rejected',
      -- Legacy uppercase (migration 001, migration 007) — kept for compat
      'DRAFT', 'EXPORTED', 'IMPLEMENTED', 'BLOCKED',
      'ACKNOWLEDGED', 'REJECTED',
      -- UI-driven additions (Inspector STATUS_COLOR map)
      'REVIEWED', 'APPLIED'
    ));
