-- ── Migration 004: Add notes column to intent_diffs ──────────────────────────
-- Allows the coding agent to record why a diff was blocked or any implementation
-- notes when updating status via the Agent Bridge MCP tool.

ALTER TABLE intent_diffs
  ADD COLUMN IF NOT EXISTS notes TEXT;
