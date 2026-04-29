-- Origin Graph — Initial Schema
-- Migration: 001
-- All tables use UUIDs as primary keys and include created_at / updated_at.
-- Enable pgcrypto for gen_random_uuid() if not already enabled.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ────────────────────────────────────────────────────────────────

CREATE TYPE origin_type AS ENUM (
  'GIT_COMMIT',
  'LINEAR_ISSUE',
  'SLACK_MESSAGE',
  'URL',
  'FORK'
);

CREATE TYPE diff_status AS ENUM (
  'DRAFT',
  'EXPORTED',
  'IMPLEMENTED',
  'BLOCKED'
);

CREATE TYPE team_role AS ENUM (
  'OWNER',
  'DESIGNER',
  'ENGINEER',
  'PM',
  'VIEWER'
);

CREATE TYPE agent_type AS ENUM (
  'CURSOR',
  'CLAUDE_CODE',
  'GENERIC'
);

CREATE TYPE workspace_plan AS ENUM (
  'FREE',
  'TEAM',
  'ENTERPRISE'
);

CREATE TYPE agent_session_status AS ENUM (
  'ACTIVE',
  'COMPLETED',
  'FAILED'
);

-- ── workspaces ────────────────────────────────────────────────────────────────

CREATE TABLE workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  owner_id      TEXT NOT NULL,  -- Clerk user ID
  plan          workspace_plan NOT NULL DEFAULT 'FREE',
  settings_jsonb JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── origins ───────────────────────────────────────────────────────────────────

CREATE TABLE origins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  origin_type NOT NULL,
  source_ref            TEXT NOT NULL,
  source_metadata_jsonb JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── artboards ─────────────────────────────────────────────────────────────────

CREATE TABLE artboards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  origin_id          UUID REFERENCES origins(id) ON DELETE SET NULL,
  parent_artboard_id UUID REFERENCES artboards(id) ON DELETE SET NULL,
  metadata_jsonb     JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX artboards_workspace_idx ON artboards(workspace_id);
CREATE INDEX artboards_parent_idx ON artboards(parent_artboard_id);

-- ── intent_diffs ──────────────────────────────────────────────────────────────

CREATE TABLE intent_diffs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artboard_id  UUID NOT NULL REFERENCES artboards(id) ON DELETE CASCADE,
  author_id    TEXT NOT NULL,  -- Clerk user ID
  changes_jsonb JSONB NOT NULL DEFAULT '{}',
  summary      TEXT NOT NULL DEFAULT '',
  status       diff_status NOT NULL DEFAULT 'DRAFT',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX intent_diffs_artboard_idx ON intent_diffs(artboard_id);
CREATE INDEX intent_diffs_status_idx ON intent_diffs(status);

-- ── agent_sessions ────────────────────────────────────────────────────────────

CREATE TABLE agent_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artboard_id   UUID NOT NULL REFERENCES artboards(id) ON DELETE CASCADE,
  diff_id       UUID REFERENCES intent_diffs(id) ON DELETE SET NULL,
  agent_type    agent_type NOT NULL,
  messages_jsonb JSONB NOT NULL DEFAULT '[]',
  status        agent_session_status NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agent_sessions_artboard_idx ON agent_sessions(artboard_id);
CREATE INDEX agent_sessions_diff_idx ON agent_sessions(diff_id);

-- ── design_language_files ─────────────────────────────────────────────────────

CREATE TABLE design_language_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  schema_jsonb JSONB NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dlf_workspace_idx ON design_language_files(workspace_id);

-- ── team_members ──────────────────────────────────────────────────────────────

CREATE TABLE team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,  -- Clerk user ID
  role         team_role NOT NULL DEFAULT 'VIEWER',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX team_members_workspace_idx ON team_members(workspace_id);
CREATE INDEX team_members_user_idx ON team_members(user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces','origins','artboards','intent_diffs',
                            'agent_sessions','design_language_files','team_members']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── RPC: get_diffs_by_status ──────────────────────────────────────────────────
-- Used by getDiffsByStatus() in queries.ts.
-- Joins intent_diffs → artboards to scope results by workspace_id.

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
