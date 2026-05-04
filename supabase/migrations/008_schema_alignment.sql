-- ── Migration 008: Spec schema alignment ──────────────────────────────────────
-- Aligns the database schema with the Layer 4 spec requirements.
-- All changes are additive or rename-only; no data is destroyed.
--
-- Changes:
--  1. artboards.width / height — add NOT NULL DEFAULT per spec (1440 / 900)
--  2. artboards.parent_id     — spec names this column parent_id (not parent_artboard_id);
--                               add parent_id as a generated column alias
--  3. origins.artboard_id     — spec requires the FK to live on origins (not artboards)
--  4. intent_diffs: rename summary → aggregate_summary  +  rename changes_jsonb → changes
--  5. intent_diffs.session_id — make NOT NULL per spec (was nullable in migration 007)
--  6. agent_sessions.agent_type — add lowercase check values per spec
--  7. RLS: add permissive workspace-membership allow policies

-- ── 1. artboards width/height defaults ───────────────────────────────────────
-- Backfill nulls introduced by migration 007, then add NOT NULL + DEFAULT.

update artboards set width  = 1440 where width  is null;
update artboards set height = 900  where height is null;

alter table artboards
  alter column width  set not null,
  alter column width  set default 1440,
  alter column height set not null,
  alter column height set default 900;

-- created_by: spec says NOT NULL; backfill with '' then constrain
update artboards set created_by = '' where created_by is null;
alter table artboards alter column created_by set not null;
alter table artboards alter column created_by set default '';

-- ── 2. artboards.parent_id alias ─────────────────────────────────────────────
-- Spec uses parent_id; existing code uses parent_artboard_id. Add parent_id as
-- a nullable FK that mirrors parent_artboard_id for spec-compliant consumers.
-- Both columns will co-exist during the transition.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'artboards' and column_name = 'parent_id'
  ) then
    alter table artboards add column parent_id uuid references artboards(id);
    -- Backfill from the existing column
    update artboards set parent_id = parent_artboard_id where parent_artboard_id is not null;
  end if;
end $$;

-- ── 3. origins.artboard_id (spec FK direction) ───────────────────────────────
-- Spec: origins.artboard_id uuid not null references artboards(id) on delete cascade
-- Existing: artboards.origin_id (reverse FK).
-- We add the spec-required column as nullable (existing origin rows have no artboard_id
-- until they are re-linked). New origins created via spec-compliant code must set it.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'origins' and column_name = 'artboard_id'
  ) then
    alter table origins add column artboard_id uuid references artboards(id) on delete cascade;
    -- Best-effort backfill: find artboards pointing to each origin
    update origins o
    set    artboard_id = a.id
    from   artboards a
    where  a.origin_id = o.id;
  end if;
end $$;

-- ── 4. intent_diffs: rename columns to spec names ────────────────────────────

-- Rename changes_jsonb → changes (spec column name)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'intent_diffs' and column_name = 'changes_jsonb'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'intent_diffs' and column_name = 'changes'
  ) then
    alter table intent_diffs rename column changes_jsonb to changes;
  end if;
end $$;

-- Rename summary → aggregate_summary (spec column name)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'intent_diffs' and column_name = 'summary'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'intent_diffs' and column_name = 'aggregate_summary'
  ) then
    alter table intent_diffs rename column summary to aggregate_summary;
  end if;
end $$;

-- ── 5. intent_diffs.session_id NOT NULL ──────────────────────────────────────
-- Spec: session_id text not null. Backfill existing nulls, then constrain.
update intent_diffs set session_id = '' where session_id is null;
alter table intent_diffs alter column session_id set not null;
alter table intent_diffs alter column session_id set default '';

-- Also: author_id was NOT NULL in the spec from migration 001 — ensure created_by
-- exists on design_language_files as NOT NULL (backfill then constrain)
update design_language_files set created_by = '' where created_by is null;
alter table design_language_files alter column created_by set not null;
alter table design_language_files alter column created_by set default '';

-- ── 6. agent_sessions: expand agent_type to include spec lowercase values ─────
-- Spec: 'cursor', 'claude-code', 'generic' (lowercase, hyphenated)
-- Existing: uppercase 'CURSOR', 'CLAUDE_CODE', 'GENERIC' + original set
-- Drop and re-create the check constraint to include both sets.
alter table agent_sessions drop constraint if exists agent_sessions_agent_type_check;
alter table agent_sessions add constraint agent_sessions_agent_type_check
  check (agent_type in (
    'cursor', 'claude-code', 'generic',       -- spec lowercase
    'CURSOR', 'CLAUDE_CODE', 'GENERIC'        -- existing uppercase
  ));

-- ── 7. RLS workspace-membership allow policies ────────────────────────────────
-- Spec: "workspace members can access" via auth.uid()::text = owner_id
-- These are the permissive policies required by Layer 4. The deny-all-anon
-- policies from migration 003 remain and complement these.

-- workspaces: owner can access their own workspace
drop policy if exists "workspace owner access" on workspaces;
create policy "workspace owner access" on workspaces
  for all
  using (owner_id = auth.uid()::text);

-- artboards: members of the workspace can access
drop policy if exists "workspace member artboard access" on artboards;
create policy "workspace member artboard access" on artboards
  for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()::text
    )
    or workspace_id in (
      select workspace_id from team_members where user_id = auth.uid()::text
    )
  );

-- origins: accessible when the linked artboard is accessible
drop policy if exists "workspace member origin access" on origins;
create policy "workspace member origin access" on origins
  for all
  using (
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

-- intent_diffs: accessible when the linked artboard is accessible
drop policy if exists "workspace member diff access" on intent_diffs;
create policy "workspace member diff access" on intent_diffs
  for all
  using (
    artboard_id in (
      select id from artboards
      where workspace_id in (
        select id from workspaces where owner_id = auth.uid()::text
        union
        select workspace_id from team_members where user_id = auth.uid()::text
      )
    )
  );

-- design_language_files: accessible within the workspace
drop policy if exists "workspace member dlf access" on design_language_files;
create policy "workspace member dlf access" on design_language_files
  for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()::text
      union
      select workspace_id from team_members where user_id = auth.uid()::text
    )
  );

-- agent_sessions: accessible when the linked artboard is accessible
drop policy if exists "workspace member session access" on agent_sessions;
create policy "workspace member session access" on agent_sessions
  for all
  using (
    artboard_id in (
      select id from artboards
      where workspace_id in (
        select id from workspaces where owner_id = auth.uid()::text
        union
        select workspace_id from team_members where user_id = auth.uid()::text
      )
    )
  );
