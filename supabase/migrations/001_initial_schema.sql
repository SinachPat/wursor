-- ═══════════════════════════════════════════════════════════════════════════
-- Originmain — Initial Schema
-- Run: supabase db push   (or paste into Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums (CHECK constraints on text columns) ─────────────────────────────
-- Using text + CHECK rather than postgres enums so adding values is a
-- non-destructive ALTER rather than a DROP/RE-CREATE cycle.

-- ── Tables ───────────────────────────────────────────────────────────────────

-- workspaces
create table if not exists workspaces (
  id              uuid primary key default uuid_generate_v4(),
  name            text        not null,
  owner_id        text        not null,           -- Clerk user ID
  plan            text        not null default 'FREE'
                  check (plan in ('FREE','TEAM','ENTERPRISE')),
  settings_jsonb  jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on workspaces (owner_id);

-- origins
create table if not exists origins (
  id                    uuid primary key default uuid_generate_v4(),
  type                  text        not null
                        check (type in ('GIT_COMMIT','LINEAR_ISSUE','SLACK_MESSAGE','URL','FORK')),
  source_ref            text        not null,
  source_metadata_jsonb jsonb       not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- artboards
create table if not exists artboards (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid        not null references workspaces (id) on delete cascade,
  name                text        not null,
  origin_id           uuid        references origins (id) on delete set null,
  parent_artboard_id  uuid        references artboards (id) on delete set null,
  -- metadata_jsonb stores canvas position/size and optional renderUrl:
  --   { x, y, width, height, renderUrl? }
  metadata_jsonb      jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists artboards_workspace_id_idx       on artboards (workspace_id);
create index if not exists artboards_parent_artboard_id_idx on artboards (parent_artboard_id);
create index if not exists artboards_created_at_idx         on artboards (created_at desc);

-- intent_diffs
create table if not exists intent_diffs (
  id            uuid primary key default uuid_generate_v4(),
  artboard_id   uuid        not null references artboards (id) on delete cascade,
  author_id     text        not null,    -- Clerk user ID
  changes_jsonb jsonb       not null default '{}',
  summary       text        not null default '',
  status        text        not null default 'DRAFT'
                check (status in ('DRAFT','EXPORTED','IMPLEMENTED','BLOCKED')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists intent_diffs_artboard_id_idx  on intent_diffs (artboard_id);
create index if not exists intent_diffs_status_idx       on intent_diffs (status);
create index if not exists intent_diffs_created_at_idx   on intent_diffs (created_at desc);

-- agent_sessions
create table if not exists agent_sessions (
  id            uuid primary key default uuid_generate_v4(),
  artboard_id   uuid        not null references artboards (id) on delete cascade,
  diff_id       uuid        references intent_diffs (id) on delete set null,
  agent_type    text        not null
                check (agent_type in ('CURSOR','CLAUDE_CODE','GENERIC')),
  messages_jsonb jsonb      not null default '[]',
  status        text        not null default 'ACTIVE'
                check (status in ('ACTIVE','COMPLETED','FAILED')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists agent_sessions_artboard_id_idx on agent_sessions (artboard_id);
create index if not exists agent_sessions_diff_id_idx     on agent_sessions (diff_id);

-- design_language_files
create table if not exists design_language_files (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid       not null references workspaces (id) on delete cascade,
  name        text        not null,
  schema_jsonb jsonb      not null default '{}',
  version     integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists design_language_files_workspace_id_idx on design_language_files (workspace_id);
create index if not exists design_language_files_version_idx      on design_language_files (workspace_id, version desc);

-- team_members
create table if not exists team_members (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid        not null references workspaces (id) on delete cascade,
  user_id      text        not null,    -- Clerk user ID
  role         text        not null default 'VIEWER'
               check (role in ('OWNER','DESIGNER','ENGINEER','PM','VIEWER')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists team_members_workspace_id_idx on team_members (workspace_id);
create index if not exists team_members_user_id_idx      on team_members (user_id);

-- ── Artboard ancestry (closure table) ────────────────────────────────────────
-- Maintained by triggers below. Stores every ancestor at any depth so hierarchy
-- queries are O(1) lookups rather than recursive CTEs.
create table if not exists artboard_ancestry (
  artboard_id  uuid not null references artboards (id) on delete cascade,
  ancestor_id  uuid not null references artboards (id) on delete cascade,
  depth        integer not null,
  primary key (artboard_id, ancestor_id)
);

create index if not exists artboard_ancestry_ancestor_idx on artboard_ancestry (ancestor_id);

-- ── Triggers: updated_at ─────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger workspaces_updated_at
  before update on workspaces
  for each row execute function set_updated_at();

create or replace trigger artboards_updated_at
  before update on artboards
  for each row execute function set_updated_at();

create or replace trigger intent_diffs_updated_at
  before update on intent_diffs
  for each row execute function set_updated_at();

create or replace trigger agent_sessions_updated_at
  before update on agent_sessions
  for each row execute function set_updated_at();

create or replace trigger design_language_files_updated_at
  before update on design_language_files
  for each row execute function set_updated_at();

create or replace trigger team_members_updated_at
  before update on team_members
  for each row execute function set_updated_at();

-- ── Trigger: artboard ancestry maintenance ────────────────────────────────────

create or replace function maintain_artboard_ancestry()
returns trigger language plpgsql as $$
begin
  -- Self-row (depth 0)
  insert into artboard_ancestry (artboard_id, ancestor_id, depth)
  values (new.id, new.id, 0)
  on conflict do nothing;

  -- Inherit all ancestors of the parent
  if new.parent_artboard_id is not null then
    insert into artboard_ancestry (artboard_id, ancestor_id, depth)
    select new.id, ancestor_id, depth + 1
    from   artboard_ancestry
    where  artboard_id = new.parent_artboard_id
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace trigger artboards_ancestry_insert
  after insert on artboards
  for each row execute function maintain_artboard_ancestry();

-- ── RPC: get_diffs_by_status ──────────────────────────────────────────────────
-- Used by getDiffsByStatus() in origin-graph/queries.ts.
-- Joins intent_diffs → artboards to scope by workspace_id.

create or replace function get_diffs_by_status(p_workspace_id uuid, p_status text)
returns setof intent_diffs
language sql stable as $$
  select d.*
  from   intent_diffs d
  join   artboards a on a.id = d.artboard_id
  where  a.workspace_id = p_workspace_id
    and  d.status = p_status
  order  by d.created_at desc;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- API routes use the service-role key (bypasses RLS). Policies below apply
-- when the anon/browser key is used for direct-to-Supabase reads.
-- All tables are locked down; only authenticated Postgres users may read.

alter table workspaces          enable row level security;
alter table origins             enable row level security;
alter table artboards           enable row level security;
alter table intent_diffs        enable row level security;
alter table agent_sessions      enable row level security;
alter table design_language_files enable row level security;
alter table team_members        enable row level security;
alter table artboard_ancestry   enable row level security;

-- Service role bypasses RLS automatically. For completeness, deny all anon.
-- Add permissive policies when you add Supabase Auth integration.
create policy "No anon access — workspaces"           on workspaces           for all to anon using (false);
create policy "No anon access — origins"              on origins              for all to anon using (false);
create policy "No anon access — artboards"            on artboards            for all to anon using (false);
create policy "No anon access — intent_diffs"         on intent_diffs         for all to anon using (false);
create policy "No anon access — agent_sessions"       on agent_sessions       for all to anon using (false);
create policy "No anon access — design_language_files" on design_language_files for all to anon using (false);
create policy "No anon access — team_members"         on team_members         for all to anon using (false);
create policy "No anon access — artboard_ancestry"    on artboard_ancestry    for all to anon using (false);
