'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectSettingsFormProps {
  workspaceId: string;
  projectId: string;
  initialName: string;
  initialDescription: string;
  initialAppUrl: string;
  initialFramework: string;
  memberRole: string;
}

const SECTION: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 14,
  padding: '24px 28px',
  marginBottom: 20,
  transition: 'background 0.2s, border-color 0.2s',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--card-text)',
  marginBottom: 6,
};

const INPUT: React.CSSProperties = {
  width: '100%',
  fontSize: '0.875rem',
  padding: '9px 12px',
  border: '1px solid var(--input-border)',
  borderRadius: 9,
  fontFamily: "'Inter', -apple-system, sans-serif",
  color: 'var(--input-text)',
  background: 'var(--input-bg)',
  boxSizing: 'border-box',
};

const BTN_PRIMARY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'var(--btn-bg)', color: 'var(--btn-fg)',
  fontSize: '0.875rem', fontWeight: 600,
  padding: '9px 20px', borderRadius: 9,
  border: 'none', cursor: 'pointer', letterSpacing: '-0.01em',
};

const FRAMEWORKS = ['', 'Next.js', 'Vite + React', 'Remix', 'SvelteKit', 'Nuxt', 'Other'] as const;

export function ProjectSettingsForm({
  workspaceId,
  projectId,
  initialName,
  initialDescription,
  initialAppUrl,
  initialFramework,
  memberRole,
}: ProjectSettingsFormProps) {
  const router = useRouter();
  const isOwnerOrDev = memberRole === 'OWNER' || memberRole === 'DEVELOPER' || memberRole === 'DESIGNER';

  /* ── Form state ── */
  const [name, setName]               = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [appUrl, setAppUrl]           = useState(initialAppUrl);
  const [framework, setFramework]     = useState(initialFramework);
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { return () => { clearTimeout(saveTimer.current); }; }, []);

  const isDirty =
    name.trim() !== initialName ||
    description !== initialDescription ||
    appUrl !== initialAppUrl ||
    framework !== initialFramework;

  const save = useCallback(async () => {
    if (!isDirty || !name.trim()) return;
    clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description || null,
          app_url: appUrl || null,
          framework: framework || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      router.refresh();
      saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      saveTimer.current = setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [isDirty, name, description, appUrl, framework, workspaceId, projectId, router]);

  /* ── Delete ── */
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Guard against deleting an unsaved name: always compare against the persisted name.
  const deleteProject = useCallback(async () => {
    if (deleteConfirm.trim() !== initialName.trim()) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push(`/workspace/${workspaceId}`);
    } catch {
      setDeleting(false);
      window.alert('Delete failed — please try again.');
    }
  }, [deleteConfirm, initialName, workspaceId, projectId, router]);

  return (
    <>
      {/* General */}
      <div style={SECTION}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--card-text)', margin: '0 0 20px' }}>General</h2>

        <label style={LABEL} htmlFor="proj-name">Project name</label>
        <input
          id="proj-name"
          style={{ ...INPUT, marginBottom: 16 }}
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={!isOwnerOrDev}
        />

        <label style={LABEL} htmlFor="proj-desc">Description</label>
        <textarea
          id="proj-desc"
          rows={3}
          style={{ ...INPUT, marginBottom: 16, resize: 'vertical' } as React.CSSProperties}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this project do?"
          disabled={!isOwnerOrDev}
        />

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL} htmlFor="proj-url">App URL</label>
            <input
              id="proj-url"
              style={INPUT}
              value={appUrl}
              onChange={e => setAppUrl(e.target.value)}
              placeholder="https://your-app.vercel.app"
              disabled={!isOwnerOrDev}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL} htmlFor="proj-framework">Framework</label>
            <select
              id="proj-framework"
              style={{ ...INPUT }}
              value={framework}
              onChange={e => setFramework(e.target.value)}
              disabled={!isOwnerOrDev}
            >
              {FRAMEWORKS.map(f => (
                <option key={f} value={f}>{f || '— select —'}</option>
              ))}
            </select>
          </div>
        </div>

        {isOwnerOrDev && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => void save()}
              disabled={!isDirty || saveStatus === 'saving' || !name.trim()}
              style={{
                ...BTN_PRIMARY,
                opacity: (!isDirty || !name.trim() || saveStatus === 'saving') ? 0.4 : 1,
              }}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save changes'}
            </button>
            {saveStatus === 'error' && (
              <span style={{ fontSize: '0.8125rem', color: '#EF4444' }}>Save failed — try again</span>
            )}
          </div>
        )}

        {!isOwnerOrDev && (
          <span style={{ fontSize: '0.75rem', color: 'var(--card-muted)' }}>Only Designers, Developers, and Owners can edit project settings.</span>
        )}
      </div>

      {/* Danger zone — owners only */}
      {memberRole === 'OWNER' && (
        <div style={{ ...SECTION, borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#EF4444', margin: '0 0 8px' }}>
            Danger zone
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--card-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Deleting this project is permanent. All artboards, diffs, and origins will be removed. To confirm,
            type the project name below.
          </p>
          <label style={{ ...LABEL, color: '#EF4444' }} htmlFor="proj-delete-confirm">
            Type <strong>{initialName}</strong> to confirm
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              id="proj-delete-confirm"
              style={INPUT}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={initialName}
            />
            <button
              onClick={() => void deleteProject()}
              disabled={deleteConfirm.trim() !== initialName.trim() || deleting}
              style={{
                fontSize: '0.875rem', fontWeight: 600, padding: '9px 20px', borderRadius: 9,
                border: '1px solid rgba(239,68,68,0.35)', background: 'transparent',
                color: '#EF4444', cursor: deleteConfirm.trim() === initialName.trim() ? 'pointer' : 'not-allowed',
                flexShrink: 0,
                opacity: deleteConfirm.trim() !== name.trim() || deleting ? 0.4 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
