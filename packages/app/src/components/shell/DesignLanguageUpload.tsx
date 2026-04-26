'use client';

import { useState, useRef } from 'react';
import type { DesignLanguageFile } from '@originmain/origin-graph';

interface Props {
  workspaceId: string;
  current: DesignLanguageFile | null;
}

export function DesignLanguageUpload({ workspaceId, current }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus('uploading');
    setErrorMsg('');
    try {
      const text = await file.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error('File must be valid JSON.');
      }

      const res = await fetch('/api/design-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: file.name.replace(/\.[^/.]+$/, ''),
          schema_jsonb: parsed,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Upload failed: ${res.status}`);
      }
      setStatus('success');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E4E4E7',
        borderRadius: 12,
        padding: '24px 28px',
        marginTop: 32,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0A0A0A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Design Language
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#71717A', margin: 0, lineHeight: 1.6 }}>
            Upload a JSON schema describing your workspace&rsquo;s design tokens and component rules.
          </p>
        </div>

        {/* Upload button */}
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading'}
          style={{
            flexShrink: 0,
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: '0.8125rem',
            fontWeight: 600,
            background: status === 'uploading' ? '#E4E4E7' : '#0A0A0A',
            color: status === 'uploading' ? '#71717A' : '#FFFFFF',
            border: 'none',
            cursor: status === 'uploading' ? 'default' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.12s',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'uploading' ? 'Uploading…' : current ? 'Update' : 'Upload JSON'}
        </button>
      </div>

      {/* Current file info */}
      {current && status !== 'success' && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: '#F4F4F5',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: '#3F3F46', fontWeight: 500 }}>
            {current.name}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '2px 7px',
              background: '#E4E4E7',
              borderRadius: 4,
              color: '#71717A',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            v{current.version}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#A1A1AA' }}>
            Active
          </span>
        </div>
      )}

      {/* Success state */}
      {status === 'success' && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 8,
            fontSize: '0.8125rem',
            color: '#059669',
            fontWeight: 500,
          }}
        >
          ✓ Design language uploaded successfully.{' '}
          <button
            onClick={() => setStatus('idle')}
            style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'rgba(220,38,38,0.05)',
            border: '1px solid rgba(220,38,38,0.15)',
            borderRadius: 8,
            fontSize: '0.8125rem',
            color: '#DC2626',
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
