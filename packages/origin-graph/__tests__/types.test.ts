import { describe, it, expect } from 'vitest';
import {
  WorkspaceSchema,
  ArtboardSchema,
  OriginSchema,
  IntentDiffSchema,
  TeamMemberSchema,
  ProjectSchema,
  AgentSessionSchema,
  OriginTypeSchema,
  DiffStatusSchema,
  TeamRoleSchema,
  AgentTypeSchema,
  WorkspacePlanSchema,
} from '../src/types.js';

// ── Timestamp helpers ──────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const UUID = '550e8400-e29b-41d4-a716-446655440000';

// ── Enum schemas ───────────────────────────────────────────────────────────────

describe('OriginTypeSchema', () => {
  it.each(['GIT_COMMIT', 'LINEAR_ISSUE', 'SLACK_MESSAGE', 'URL', 'FORK'] as const)(
    'accepts "%s"',
    (v) => expect(OriginTypeSchema.parse(v)).toBe(v),
  );
  it('rejects unknown type', () => {
    expect(() => OriginTypeSchema.parse('JIRA_ISSUE')).toThrow();
  });
});

describe('DiffStatusSchema', () => {
  it.each(['DRAFT', 'EXPORTED', 'IMPLEMENTED', 'BLOCKED'] as const)(
    'accepts "%s"',
    (v) => expect(DiffStatusSchema.parse(v)).toBe(v),
  );
  it('rejects unknown status', () => {
    expect(() => DiffStatusSchema.parse('PENDING')).toThrow();
  });
});

describe('TeamRoleSchema', () => {
  it.each(['OWNER', 'DESIGNER', 'ENGINEER', 'PM', 'VIEWER'] as const)(
    'accepts "%s"',
    (v) => expect(TeamRoleSchema.parse(v)).toBe(v),
  );
});

describe('AgentTypeSchema', () => {
  it.each(['CURSOR', 'CLAUDE_CODE', 'GENERIC'] as const)(
    'accepts "%s"',
    (v) => expect(AgentTypeSchema.parse(v)).toBe(v),
  );
});

describe('WorkspacePlanSchema', () => {
  it.each(['FREE', 'TEAM', 'ENTERPRISE'] as const)(
    'accepts "%s"',
    (v) => expect(WorkspacePlanSchema.parse(v)).toBe(v),
  );
});

// ── Row schemas ────────────────────────────────────────────────────────────────

describe('WorkspaceSchema', () => {
  const valid = {
    id: UUID,
    name: 'Acme Corp',
    owner_id: 'user_abc123',
    plan: 'FREE',
    settings_jsonb: {},
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid workspace', () => {
    const ws = WorkspaceSchema.parse(valid);
    expect(ws.name).toBe('Acme Corp');
    expect(ws.plan).toBe('FREE');
  });

  it('rejects missing required field', () => {
    const { name: _, ...noName } = valid;
    expect(() => WorkspaceSchema.parse(noName)).toThrow();
  });

  it('rejects invalid UUID for id', () => {
    expect(() => WorkspaceSchema.parse({ ...valid, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects invalid plan', () => {
    expect(() => WorkspaceSchema.parse({ ...valid, plan: 'STARTUP' })).toThrow();
  });

  it('rejects invalid datetime format', () => {
    expect(() => WorkspaceSchema.parse({ ...valid, created_at: '2024/01/01' })).toThrow();
  });
});

describe('ArtboardSchema', () => {
  const valid = {
    id: UUID,
    workspace_id: UUID,
    project_id: UUID,
    name: 'Dashboard.tsx',
    origin_id: UUID,
    parent_artboard_id: null,
    metadata_jsonb: { x: 100, y: 200, width: 360, height: 240 },
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid artboard', () => {
    const ab = ArtboardSchema.parse(valid);
    expect(ab.name).toBe('Dashboard.tsx');
    expect(ab.parent_artboard_id).toBeNull();
  });

  it('accepts null project_id', () => {
    const ab = ArtboardSchema.parse({ ...valid, project_id: null });
    expect(ab.project_id).toBeNull();
  });

  it('accepts null origin_id', () => {
    const ab = ArtboardSchema.parse({ ...valid, origin_id: null });
    expect(ab.origin_id).toBeNull();
  });

  it('accepts nested metadata_jsonb values', () => {
    const meta = { x: 0, y: 0, width: 800, height: 600, renderUrl: 'http://localhost:3000' };
    const ab = ArtboardSchema.parse({ ...valid, metadata_jsonb: meta });
    expect(ab.metadata_jsonb['renderUrl']).toBe('http://localhost:3000');
  });
});

describe('OriginSchema', () => {
  const valid = {
    id: UUID,
    type: 'GIT_COMMIT',
    source_ref: 'abc123def456',
    source_metadata_jsonb: { repo: 'originmain/app', branch: 'main' },
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid origin', () => {
    const o = OriginSchema.parse(valid);
    expect(o.type).toBe('GIT_COMMIT');
  });

  it('rejects unknown origin type', () => {
    expect(() => OriginSchema.parse({ ...valid, type: 'NOTION_PAGE' })).toThrow();
  });
});

describe('IntentDiffSchema', () => {
  const valid = {
    id: UUID,
    artboard_id: UUID,
    author_id: 'user_xyz',
    changes_jsonb: { propChanges: [], styleChanges: [] },
    summary: 'Updated button variant',
    status: 'DRAFT',
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid diff', () => {
    const d = IntentDiffSchema.parse(valid);
    expect(d.status).toBe('DRAFT');
    expect(d.notes).toBeUndefined();
  });

  it('accepts optional notes field', () => {
    const d = IntentDiffSchema.parse({ ...valid, notes: 'Blocked by missing token' });
    expect(d.notes).toBe('Blocked by missing token');
  });

  it('rejects invalid status', () => {
    expect(() => IntentDiffSchema.parse({ ...valid, status: 'PENDING' })).toThrow();
  });
});

describe('TeamMemberSchema', () => {
  const valid = {
    id: UUID,
    workspace_id: UUID,
    user_id: 'user_abc',
    role: 'DESIGNER',
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid team member', () => {
    const m = TeamMemberSchema.parse(valid);
    expect(m.role).toBe('DESIGNER');
  });

  it('rejects invalid role', () => {
    expect(() => TeamMemberSchema.parse({ ...valid, role: 'INTERN' })).toThrow();
  });
});

describe('ProjectSchema', () => {
  const valid = {
    id: UUID,
    workspace_id: UUID,
    name: 'Design System',
    description: 'Core component library',
    app_url: 'https://ds.example.com',
    framework: 'Next.js',
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid project', () => {
    const p = ProjectSchema.parse(valid);
    expect(p.name).toBe('Design System');
    expect(p.framework).toBe('Next.js');
  });

  it('accepts null nullable fields', () => {
    const p = ProjectSchema.parse({ ...valid, description: null, app_url: null, framework: null });
    expect(p.description).toBeNull();
    expect(p.app_url).toBeNull();
    expect(p.framework).toBeNull();
  });

  it('rejects missing name', () => {
    const { name: _, ...noName } = valid;
    expect(() => ProjectSchema.parse(noName)).toThrow();
  });
});

describe('AgentSessionSchema', () => {
  const valid = {
    id: UUID,
    artboard_id: UUID,
    diff_id: UUID,
    agent_type: 'CLAUDE_CODE',
    messages_jsonb: [{ role: 'user', content: 'hello' }],
    status: 'ACTIVE',
    created_at: NOW,
    updated_at: NOW,
  };

  it('parses a valid session', () => {
    const s = AgentSessionSchema.parse(valid);
    expect(s.agent_type).toBe('CLAUDE_CODE');
    expect(s.status).toBe('ACTIVE');
  });

  it('accepts null diff_id', () => {
    const s = AgentSessionSchema.parse({ ...valid, diff_id: null });
    expect(s.diff_id).toBeNull();
  });

  it('rejects invalid agent type', () => {
    expect(() => AgentSessionSchema.parse({ ...valid, agent_type: 'COPILOT' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => AgentSessionSchema.parse({ ...valid, status: 'PENDING' })).toThrow();
  });
});
