'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface WorkspaceSettingsFormProps {
  workspaceId: string;
  workspaceName: string;
  memberRole: string;
}

const SECTION: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 14,
  padding: '24px 28px',
  marginBottom: 20,
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#0A0A0A',
  marginBottom: 6,
};

const INPUT: React.CSSProperties = {
  width: '100%',
  fontSize: '0.875rem',
  padding: '9px 12px',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 9,
  fontFamily: "'Inter', -apple-system, sans-serif",
  color: '#0A0A0A',
  background: '#FAFAFA',
  boxSizing: 'border-box',
};

const BTN_PRIMARY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: '#0A0A0A', color: '#FFFFFF',
  fontSize: '0.875rem', fontWeight: 600,
  padding: '9px 20px', borderRadius: 9,
  border: 'none', cursor: 'pointer', letterSpacing: '-0.01em',
};

// Matches TeamRoleSchema in @originmain/origin-graph — keep in sync.
type TeamRole = 'OWNER' | 'DESIGNER' | 'ENGINEER' | 'PM' | 'VIEWER';

function TeamInviteForm({ workspaceId }: { workspaceId: string }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<TeamRole>('DESIGNER');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'conflict' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear any pending reset timers on unmount to avoid setState-after-unmount.
  useEffect(() => { return () => { clearTimeout(resetTimer.current); }; }, []);

  const submit = useCallback(async () => {
    const trimmed = userId.trim();
    if (!trimmed) return;
    clearTimeout(resetTimer.current);
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trimmed, role }),
      });
      if (res.status === 409) { setStatus('conflict'); return; }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setStatus('done');
      setUserId('');
      resetTimer.current = setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Invite failed');
      setStatus('error');
      resetTimer.current = setTimeout(() => setStatus('idle'), 4000);
    }
  }, [userId, role, workspaceId]);

  const roles: TeamRole[] = ['DESIGNER', 'ENGINEER', 'PM', 'VIEWER', 'OWNER'];

  return (
    <div>
      {/* Role picker */}
      <label style={LABEL}>Role</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            style={{
              fontSize: '0.75rem', fontWeight: 600, padding: '5px 13px', borderRadius: 8,
              border: `1px solid ${role === r ? '#0066FF' : 'rgba(0,0,0,0.12)'}`,
              background: role === r ? 'rgba(0,102,255,0.08)' : '#FFFFFF',
              color: role === r ? '#0066FF' : '#52525B',
              cursor: 'pointer',
            }}
          >
            {r.charAt(0) + r.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* User ID input + submit */}
      <label style={LABEL} htmlFor="invite-uid">Clerk user ID</label>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          id="invite-uid"
          style={INPUT}
          placeholder="user_2abc…"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          disabled={status === 'loading'}
        />
        <button
          onClick={() => void submit()}
          disabled={status === 'loading' || !userId.trim()}
          style={{
            ...BTN_PRIMARY,
            flexShrink: 0,
            opacity: (status === 'loading' || !userId.trim()) ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {status === 'loading' ? 'Inviting…' : 'Invite'}
        </button>
      </div>

      {/* Feedback */}
      {status === 'done' && (
        <p style={{ fontSize: '0.8125rem', color: '#10B981', marginTop: 8 }}>✓ Member added successfully</p>
      )}
      {status === 'conflict' && (
        <p style={{ fontSize: '0.8125rem', color: '#F59E0B', marginTop: 8 }}>User is already a member of this workspace</p>
      )}
      {status === 'error' && (
        <p style={{ fontSize: '0.8125rem', color: '#EF4444', marginTop: 8 }}>{errorMsg || 'Invite failed — try again'}</p>
      )}
    </div>
  );
}

export function WorkspaceSettingsForm({ workspaceId, workspaceName, memberRole }: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const isOwner = memberRole === 'OWNER';

  /* ── Rename ── */
  const [name, setName] = useState(workspaceName);
  const [renameStatus, setRenameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const renameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { return () => { clearTimeout(renameTimer.current); }; }, []);

  async function saveName() {
    if (!name.trim() || name.trim() === workspaceName) return;
    clearTimeout(renameTimer.current);
    setRenameStatus('saving');
    try {
      const res = await fetch(`/api/workspace/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error('Rename failed');
      setRenameStatus('saved');
      router.refresh();
      renameTimer.current = setTimeout(() => setRenameStatus('idle'), 2000);
    } catch {
      setRenameStatus('error');
      renameTimer.current = setTimeout(() => setRenameStatus('idle'), 3000);
    }
  }

  /* ── IDE Token ── */
  const [agentType, setAgentType] = useState<'CURSOR' | 'CLAUDE_CODE' | 'GENERIC'>('CLAUDE_CODE');
  const [tokenResult, setTokenResult] = useState<{
    token: string;
    cursorConfig: { cursorrules: string; settings: unknown };
    claudeCodeConfig: { claudeMd: string; settings: unknown };
  } | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  async function issueToken() {
    setTokenLoading(true);
    setTokenError('');
    setTokenResult(null);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, workspaceName }),
      });
      if (!res.ok) throw new Error('Token issuance failed');
      const data = await res.json() as typeof tokenResult;
      setTokenResult(data);
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : 'Failed to issue token');
    } finally {
      setTokenLoading(false);
    }
  }

  function copyToken() {
    if (!tokenResult) return;
    void navigator.clipboard.writeText(tokenResult.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  const configText = tokenResult
    ? agentType === 'CURSOR'
      ? tokenResult.cursorConfig.cursorrules
      : tokenResult.claudeCodeConfig.claudeMd
    : '';

  return (
    <>
      {/* General */}
      <div style={SECTION}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0A0A0A', margin: '0 0 20px' }}>
          General
        </h2>
        <label style={LABEL} htmlFor="ws-name">Workspace name</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <input
            id="ws-name"
            style={INPUT}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void saveName(); }}
            disabled={!isOwner}
          />
          <button
            onClick={() => void saveName()}
            disabled={!isOwner || renameStatus === 'saving' || name.trim() === workspaceName}
            style={{
              ...BTN_PRIMARY,
              opacity: (!isOwner || name.trim() === workspaceName) ? 0.4 : 1,
              flexShrink: 0,
            }}
          >
            {renameStatus === 'saving' ? 'Saving…' : renameStatus === 'saved' ? '✓ Saved' : 'Rename'}
          </button>
        </div>
        {renameStatus === 'error' && (
          <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Rename failed — try again</span>
        )}
        {!isOwner && (
          <span style={{ fontSize: '0.75rem', color: '#71717A' }}>Only workspace owners can rename.</span>
        )}
      </div>

      {/* IDE Integration */}
      <div style={SECTION}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0A0A0A', margin: '0 0 6px' }}>
          IDE Integration
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#71717A', margin: '0 0 20px', lineHeight: 1.6 }}>
          Issue a signed workspace token and copy the config snippet into your editor. Tokens expire after 30 days.
        </p>

        <label style={LABEL}>Agent type</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['CLAUDE_CODE', 'CURSOR', 'GENERIC'] as const).map(t => (
            <button
              key={t}
              onClick={() => setAgentType(t)}
              style={{
                fontSize: '0.75rem', fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${agentType === t ? '#0066FF' : 'rgba(0,0,0,0.12)'}`,
                background: agentType === t ? 'rgba(0,102,255,0.08)' : '#FFFFFF',
                color: agentType === t ? '#0066FF' : '#52525B',
                cursor: 'pointer',
              }}
            >
              {t === 'CLAUDE_CODE' ? 'Claude Code' : t === 'CURSOR' ? 'Cursor' : 'Generic'}
            </button>
          ))}
        </div>

        <button
          onClick={() => void issueToken()}
          disabled={tokenLoading}
          style={{ ...BTN_PRIMARY, opacity: tokenLoading ? 0.6 : 1, marginBottom: tokenResult ? 16 : 0 }}
        >
          {tokenLoading ? 'Generating…' : 'Generate token'}
        </button>

        {tokenError && (
          <p style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: 8 }}>{tokenError}</p>
        )}

        {tokenResult && (
          <div style={{ marginTop: 16 }}>
            {/* Token display */}
            <label style={{ ...LABEL, marginBottom: 6 }}>Workspace token</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                readOnly
                value={tokenResult.token}
                style={{ ...INPUT, fontFamily: 'monospace', fontSize: '0.75rem', color: '#0066FF' }}
              />
              <button
                onClick={copyToken}
                style={{
                  ...BTN_PRIMARY, background: copiedToken ? '#10B981' : '#0066FF', flexShrink: 0,
                  transition: 'background 0.2s',
                }}
              >
                {copiedToken ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            {/* Config snippet */}
            <label style={{ ...LABEL, marginBottom: 6 }}>
              {agentType === 'CURSOR' ? '.cursorrules snippet' : 'CLAUDE.md snippet'}
            </label>
            <pre style={{
              background: '#0A0A0A', color: 'rgba(255,255,255,0.75)',
              borderRadius: 10, padding: '14px 16px', fontSize: '0.625rem',
              fontFamily: 'monospace', overflowX: 'auto', lineHeight: 1.7,
              margin: 0, maxHeight: 260, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {configText}
            </pre>
            <p style={{ fontSize: '0.75rem', color: '#71717A', marginTop: 8, lineHeight: 1.5 }}>
              Paste this into your{' '}
              {agentType === 'CURSOR' ? (
                <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>.cursorrules</code>
              ) : (
                <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>CLAUDE.md</code>
              )}{' '}
              file to enable the Originmain MCP server in your editor.
            </p>
          </div>
        )}
      </div>

      {/* Team */}
      {isOwner && (
        <div style={SECTION}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0A0A0A', margin: '0 0 6px' }}>
            Team
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', margin: '0 0 20px', lineHeight: 1.6 }}>
            Add a team member using their Clerk user ID. You can find this in the Clerk dashboard under Users.
          </p>

          <TeamInviteForm workspaceId={workspaceId} />
        </div>
      )}

      {/* Danger zone */}
      {isOwner && (
        <div style={{ ...SECTION, borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#EF4444', margin: '0 0 8px' }}>
            Danger zone
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', margin: '0 0 16px', lineHeight: 1.6 }}>
            Deleting this workspace is permanent and cannot be undone. All projects and artboards will be lost.
          </p>
          <button
            style={{
              fontSize: '0.875rem', fontWeight: 600, padding: '9px 20px', borderRadius: 9,
              border: '1px solid rgba(239,68,68,0.35)', background: 'transparent',
              color: '#EF4444', cursor: 'pointer',
            }}
            onClick={() => {
              if (window.confirm(`Delete workspace "${workspaceName}"? This cannot be undone.`)) {
                // TODO: call DELETE /api/workspace/:id when implemented
                window.alert('Delete endpoint not yet implemented — coming soon.');
              }
            }}
          >
            Delete workspace
          </button>
        </div>
      )}
    </>
  );
}
