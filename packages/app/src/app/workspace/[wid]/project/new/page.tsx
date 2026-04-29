'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/shell/AppHeader';

const FRAMEWORKS = ['React', 'Next.js', 'Vue', 'Nuxt', 'Svelte', 'SvelteKit', 'Angular', 'Remix', 'Astro', 'Other'];

export default function NewProjectPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = use(params);
  const router = useRouter();

  const [name, setName]           = useState('');
  const [appUrl, setAppUrl]       = useState('');
  const [description, setDesc]    = useState('');
  const [framework, setFramework] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch(`/api/workspace/${wid}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        app_url: appUrl.trim() || null,
        description: description.trim() || null,
        framework: framework || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    const project = await res.json();
    router.push(`/workspace/${wid}/project/${project.id}`);
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '10px 12px', fontSize: '0.9375rem',
    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
    color: '#0A0A0A', background: '#FFFFFF',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block' as const,
    fontSize: '0.8125rem', fontWeight: 600 as const,
    color: '#3F3F46', marginBottom: 6,
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppHeader breadcrumbs={[
        { label: 'Workspaces', href: '/workspaces' },
        { label: 'Workspace', href: `/workspace/${wid}` },
        { label: 'New project' },
      ]} />

      <main style={{ maxWidth: 540, margin: '64px auto', padding: '0 24px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '36px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0A0A0A', margin: '0 0 6px' }}>
            New project
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#71717A', margin: '0 0 28px', lineHeight: 1.5 }}>
            A project connects to your running app so you can inspect components live, create artboards, and ship intent diffs.
          </p>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Project name */}
            <div>
              <label style={labelStyle}>Project name <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Dashboard App"
                autoFocus style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            {/* App URL */}
            <div>
              <label style={labelStyle}>App URL</label>
              <input
                type="url" value={appUrl} onChange={e => setAppUrl(e.target.value)}
                placeholder="http://localhost:3000 or https://staging.myapp.com"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
              <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#A1A1AA' }}>
                The address where your app is running — local or remote.
              </p>
            </div>

            {/* Framework */}
            <div>
              <label style={labelStyle}>Framework</label>
              <select
                value={framework} onChange={e => setFramework(e.target.value)}
                style={{ ...inputStyle, color: framework ? '#0A0A0A' : '#A1A1AA', cursor: 'pointer' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              >
                <option value="">Select framework (optional)</option>
                {FRAMEWORKS.map(f => <option key={f} value={f.toLowerCase().replace('.', '')}>{f}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description <span style={{ color: '#A1A1AA', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={description} onChange={e => setDesc(e.target.value)}
                placeholder="Short description of what this project is…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                onFocus={e => (e.currentTarget.style.borderColor = '#0066FF')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#DC2626' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Link href={`/workspace/${wid}`} style={{
                flex: 1, textAlign: 'center', padding: '10px', borderRadius: 8,
                fontSize: '0.875rem', fontWeight: 600, color: '#3F3F46',
                background: '#F4F4F5', textDecoration: 'none',
              }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8,
                  fontSize: '0.875rem', fontWeight: 600,
                  background: name.trim() && !loading ? '#0A0A0A' : '#D4D4D8',
                  color: '#FFFFFF', border: 'none',
                  cursor: name.trim() && !loading ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                }}
              >
                {loading ? 'Creating…' : 'Create project & open canvas →'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
