-- ── Migration 010: Fix origins RLS policy ────────────────────────────────────
--
-- Problem (introduced in migration 008):
--   The "workspace member origin access" policy only checks the OLD FK direction
--   (artboards.origin_id → origins.id). Migration 008 added the SPEC-required FK
--   column origins.artboard_id, but the policy was not updated. Any origin created
--   via spec-compliant code (setting origins.artboard_id) is therefore invisible
--   to authenticated users — the SELECT returns zero rows even though the insert
--   succeeds.
--
-- Fix:
--   Rewrite the policy to accept either FK direction:
--     1. NEW (spec): origins.artboard_id is in the user's accessible artboard set.
--     2. OLD (legacy): origins.id appears in artboards.origin_id for accessible boards.
--   The OR allows both legacy data and spec-compliant data to be readable without
--   requiring a destructive data migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper CTE: IDs of all artboards accessible to the calling user.
-- Referenced by both branches of the OR below.
drop policy if exists "workspace member origin access" on origins;

create policy "workspace member origin access" on origins
  for all
  using (
    -- ── Branch 1: spec-compliant origins (origins.artboard_id FK) ───────────
    -- New origins set origins.artboard_id = <artboard uuid>; the origin is
    -- accessible iff that artboard is in the user's workspace.
    artboard_id in (
      select id from artboards
      where workspace_id in (
        select id from workspaces where owner_id = auth.uid()::text
        union
        select workspace_id from team_members where user_id = auth.uid()::text
      )
    )

    or

    -- ── Branch 2: legacy origins (artboards.origin_id FK) ───────────────────
    -- Old origins are referenced from artboards via artboards.origin_id.
    -- Still need to work so existing data stays accessible while backfill
    -- populates origins.artboard_id (migration 008 best-effort backfill).
    id in (
      select origin_id from artboards
      where workspace_id in (
        select id from workspaces where owner_id = auth.uid()::text
        union
        select workspace_id from team_members where user_id = auth.uid()::text
      )
      and origin_id is not null
    )
  );
