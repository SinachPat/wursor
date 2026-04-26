-- Migration: 005 — projects
-- A Project groups artboards for a specific application inside a workspace.
-- Users connect their running app to a project (via app_url) and work
-- on its artboards in the canvas.

CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  app_url      TEXT,          -- e.g. https://localhost:3000 or https://staging.myapp.com
  framework    TEXT,          -- e.g. 'react', 'next', 'vue', 'svelte'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX projects_workspace_idx ON projects(workspace_id);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add optional project_id to artboards so artboards can be scoped to a project.
-- Nullable: existing artboards without a project remain workspace-level.
ALTER TABLE artboards ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS artboards_project_idx ON artboards(project_id);
