'use client';

/**
 * /settings/design-language — Phase 6
 *
 * Design Language Settings page.  Allows workspace admins to:
 *   1. Upload a token file (Style Dictionary / W3C DTCG / flat CSS vars)
 *   2. Fetch a token file from an HTTPS URL (via the SSRF-guarded proxy)
 *   3. Validate the parsed token set before activating
 *   4. Activate the tokens workspace-wide (stored in Supabase + canvas store)
 *   5. View version history of previously uploaded token files + restore any version
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.5
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useCanvas } from '@/store/canvas';
import type { DesignToken } from '@/store/canvas.types';
import type { DesignLanguageFile } from '@originmain/origin-graph';

// ── Upload & validation states ─────────────────────────────────────────────────

type ParseState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'parsed'; tokens: DesignToken[]; filename: string; rawJson: string }
  | { status: 'error'; message: string };

type ActivateState = 'idle' | 'activating' | 'done' | 'error';
type FetchUrlState = 'idle' | 'fetching' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function parseTokenFileClient(jsonText: string): Promise<DesignToken[]> {
  const { parseTokenFileJson } = await import('@originmain/design-language');
  return parseTokenFileJson(jsonText) as DesignToken[];
}

function groupByCategory(tokens: DesignToken[]): Record<string, DesignToken[]> {
  const groups: Record<string, DesignToken[]> = {};
  for (const t of tokens) {
    const g = t.group;
    (groups[g] ??= []).push(t);
  }
  return groups;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DesignLanguagePage() {
  const { designLanguageTokens, setDesignLanguageTokens, workspaceId } = useCanvas();
  const [parseState,    setParseState]    = useState<ParseState>({ status: 'idle' });
  const [activateState, setActivateState] = useState<ActivateState>('idle');
  const [dragOver,      setDragOver]      = useState(false);
  const [fetchUrl,      setFetchUrl]      = useState('');
  const [fetchUrlState, setFetchUrlState] = useState<FetchUrlState>('idle');
  const [fetchUrlError, setFetchUrlError] = useState('');
  const [history,       setHistory]       = useState<DesignLanguageFile[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load version history ────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    if (!workspaceId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/design-language?workspaceId=${workspaceId}&all=1`);
      if (res.ok) {
        const data = await res.json() as DesignLanguageFile[];
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch { /* non-fatal */ }
    finally { setHistoryLoading(false); }
  }, [workspaceId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // ── File handling ───────────────────────────────────────────────────────────

  const processJsonText = useCallback(async (text: string, filename: string) => {
    setParseState({ status: 'parsing' });
    try {
      const tokens = await parseTokenFileClient(text);
      if (tokens.length === 0) {
        setParseState({ status: 'error', message: 'No tokens found. Check the file format.' });
        return;
      }
      setParseState({ status: 'parsed', tokens, filename, rawJson: text });
      setActivateState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseState({ status: 'error', message: `Parse failed: ${msg}` });
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setParseState({ status: 'error', message: 'Only .json token files are supported.' });
      return;
    }
    const text = await file.text();
    await processJsonText(text, file.name);
  }, [processJsonText]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }, [processFile]);

  // ── Fetch from URL ──────────────────────────────────────────────────────────

  const handleFetchUrl = useCallback(async () => {
    const url = fetchUrl.trim();
    if (!url) return;
    if (!url.startsWith('https://')) {
      setFetchUrlState('error');
      setFetchUrlError('Only https:// URLs are supported.');
      return;
    }
    setFetchUrlState('fetching');
    setFetchUrlError('');
    try {
      const res = await fetch('/api/design-language/fetch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { json } = await res.json() as { json: string };
      const filename = url.split('/').pop() ?? 'tokens.json';
      await processJsonText(json, filename);
      setFetchUrlState('idle');
    } catch (err) {
      setFetchUrlState('error');
      setFetchUrlError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchUrl, processJsonText]);

  // ── Activation ──────────────────────────────────────────────────────────────

  const activate = useCallback(async () => {
    if (parseState.status !== 'parsed') return;
    if (!workspaceId) {
      setActivateState('error');
      return;
    }
    setActivateState('activating');
    try {
      // 1. Parse the raw JSON to a schema_jsonb object for Supabase.
      const schemaObj = JSON.parse(parseState.rawJson) as Record<string, unknown>;

      // 2. Persist to Supabase — this triggers the Realtime subscription in
      //    AppChrome so all other sessions update their token store too.
      const res = await fetch('/api/design-language', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          workspace_id: workspaceId,
          name:         parseState.filename,
          schema_jsonb: schemaObj,
          is_active:    true,
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      // 3. Update local canvas store immediately (don't wait for Realtime).
      setDesignLanguageTokens(parseState.tokens);
      setActivateState('done');

      // 4. Refresh version history.
      void loadHistory();
    } catch (err) {
      console.error('[DLF] Activation failed:', err);
      setActivateState('error');
    }
  }, [parseState, workspaceId, setDesignLanguageTokens, loadHistory]);

  const deactivate = useCallback(() => {
    setDesignLanguageTokens(null);
    setParseState({ status: 'idle' });
    setActivateState('idle');
  }, [setDesignLanguageTokens]);

  // ── Restore a historical version ────────────────────────────────────────────

  const restoreVersion = useCallback(async (row: DesignLanguageFile) => {
    if (!workspaceId) return;
    try {
      const { parseTokenFile } = await import('@originmain/design-language');
      const tokens = parseTokenFile(row.schema_jsonb as Record<string, unknown>) as DesignToken[];

      const res = await fetch('/api/design-language', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          workspace_id: workspaceId,
          name:         row.name,
          schema_jsonb: row.schema_jsonb,
          is_active:    true,
        }),
      });
      if (!res.ok) throw new Error('Restore failed');
      setDesignLanguageTokens(tokens);
      void loadHistory();
    } catch (err) {
      console.error('[DLF] Restore failed:', err);
    }
  }, [workspaceId, setDesignLanguageTokens, loadHistory]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1117',
      color: 'rgba(255,255,255,0.85)',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '48px 40px',
      maxWidth: 800,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'white',
          margin: 0,
          marginBottom: 8,
          letterSpacing: '-0.03em',
        }}>
          Design Language
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
          Upload a design token file to enable token-aware inputs and constraint checking across all artboards.
          Supports Style Dictionary, W3C DTCG, and flat CSS variable formats.
        </p>
        {!workspaceId && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,186,0,0.08)', border: '1px solid rgba(255,186,0,0.25)', borderRadius: 8, fontSize: '0.75rem', color: '#FFBA7B' }}>
            ⚠ Open a workspace in the canvas first to enable saving token files.
          </div>
        )}
      </div>

      {/* Active token set status */}
      {designLanguageTokens && (
        <ActiveTokenBanner tokens={designLanguageTokens} onDeactivate={deactivate} />
      )}

      {/* Upload area */}
      <UploadZone
        dragOver={dragOver}
        onDragOver={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Fetch from URL */}
      <FetchFromUrl
        value={fetchUrl}
        onChange={setFetchUrl}
        state={fetchUrlState}
        error={fetchUrlError}
        onFetch={() => void handleFetchUrl()}
      />

      {/* Parse state feedback */}
      {parseState.status === 'parsing' && (
        <StatusCard>
          <Spinner />
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Parsing token file…</span>
        </StatusCard>
      )}

      {parseState.status === 'error' && (
        <StatusCard color="rgba(255,80,80,0.08)" border="rgba(255,80,80,0.3)">
          <span style={{ fontSize: '0.8125rem', color: '#FF8080' }}>⚠ {parseState.message}</span>
        </StatusCard>
      )}

      {parseState.status === 'parsed' && (
        <TokenPreview
          tokens={parseState.tokens}
          filename={parseState.filename}
          activateState={activateState}
          workspaceId={workspaceId}
          onActivate={() => void activate()}
        />
      )}

      {/* Version history */}
      {(history.length > 0 || historyLoading) && (
        <VersionHistory
          rows={history}
          loading={historyLoading}
          onRestore={(row) => void restoreVersion(row)}
        />
      )}

      {/* Format reference */}
      <FormatReference />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActiveTokenBanner({ tokens, onDeactivate }: { tokens: DesignToken[]; onDeactivate: () => void }) {
  const groups = groupByCategory(tokens);
  return (
    <div style={{
      padding: '14px 18px',
      background: 'rgba(125,211,168,0.06)',
      border: '1px solid rgba(125,211,168,0.25)',
      borderRadius: 10,
      marginBottom: 28,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7DD3A8', flexShrink: 0, boxShadow: '0 0 8px rgba(125,211,168,0.6)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: '#7DD3A8', fontWeight: 600, marginBottom: 3 }}>
          {tokens.length} tokens active
        </div>
        <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}>
          {Object.entries(groups).map(([g, ts]) => `${g}:${ts.length}`).join('  ·  ')}
        </div>
      </div>
      <button
        onClick={onDeactivate}
        style={{
          background: 'none', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 6,
          color: '#FF8080', padding: '5px 12px', cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem',
          letterSpacing: '0.04em', transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        Deactivate
      </button>
    </div>
  );
}

function UploadZone({
  dragOver, onDragOver, onDragLeave, onDrop, onClick,
}: {
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragOver ? '#3385FF' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 12,
        padding: '36px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragOver ? 'rgba(51,133,255,0.06)' : 'rgba(255,255,255,0.02)',
        transition: 'border-color 0.15s, background 0.15s',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: '1.5rem', marginBottom: 10, opacity: 0.4 }}>📂</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
        Drop token file here or click to browse
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)' }}>
        .json — Style Dictionary · W3C DTCG · Flat CSS vars
      </div>
    </div>
  );
}

function FetchFromUrl({
  value, onChange, state, error, onFetch,
}: {
  value: string;
  onChange: (v: string) => void;
  state: FetchUrlState;
  error: string;
  onFetch: () => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        <input
          type="url"
          placeholder="Import from URL  https://cdn.example.com/tokens.json"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onFetch(); e.stopPropagation(); }}
          style={{
            flex: 1,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6875rem',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${state === 'error' ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 8,
            color: 'rgba(255,255,255,0.75)',
            padding: '9px 14px',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#3385FF')}
          onBlur={e => (e.target.style.borderColor = state === 'error' ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.12)')}
        />
        <button
          onClick={onFetch}
          disabled={state === 'fetching' || !value.trim()}
          style={{
            padding: '9px 18px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.75rem',
            cursor: state === 'fetching' || !value.trim() ? 'not-allowed' : 'pointer',
            opacity: state === 'fetching' || !value.trim() ? 0.5 : 1,
            whiteSpace: 'nowrap',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (state !== 'fetching') e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          {state === 'fetching' ? 'Fetching…' : 'Fetch'}
        </button>
      </div>
      {state === 'error' && error && (
        <div style={{ marginTop: 6, fontSize: '0.6875rem', color: '#FF8080', fontFamily: "'Inter', sans-serif" }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

function StatusCard({ children, color, border }: { children: React.ReactNode; color?: string; border?: string }) {
  return (
    <div style={{
      padding: '14px 18px',
      background: color ?? 'rgba(255,255,255,0.04)',
      border: `1px solid ${border ?? 'rgba(255,255,255,0.12)'}`,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 24,
    }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.15)',
      borderTopColor: '#3385FF',
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  );
}

function TokenPreview({
  tokens, filename, activateState, workspaceId, onActivate,
}: {
  tokens: DesignToken[];
  filename: string;
  activateState: ActivateState;
  workspaceId: string | null;
  onActivate: () => void;
}) {
  const groups = groupByCategory(tokens);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 24,
    }}>
      {/* Preview header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: '#7DD3A8' }}>✓ Parsed</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.7)', flex: 1 }}>{filename}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.35)' }}>
          {tokens.length} tokens · {Object.keys(groups).length} groups
        </span>
      </div>

      {/* Group list */}
      {Object.entries(groups).map(([group, groupTokens]) => (
        <div key={group} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setExpanded(expanded === group ? null : group)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)' }}>{expanded === group ? '▼' : '▶'}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', flex: 1, textTransform: 'capitalize' }}>{group}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)' }}>{groupTokens.length}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {groupTokens.filter(t => t.type === 'color').slice(0, 6).map(t => (
                <div key={t.key} style={{ width: 12, height: 12, borderRadius: 2, background: t.rawValue, border: '1px solid rgba(255,255,255,0.1)' }} />
              ))}
            </div>
          </button>
          {expanded === group && (
            <div style={{ paddingBottom: 8 }}>
              {groupTokens.map(token => (
                <div key={token.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px 5px 36px' }}>
                  {token.type === 'color' && (
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: token.rawValue, flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }} />
                  )}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: '#3385FF', flex: 1, letterSpacing: '-0.01em' }}>{token.key}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.01em' }}>{token.rawValue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Activate button */}
      <div style={{ padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={onActivate}
          disabled={activateState === 'activating' || activateState === 'done' || !workspaceId}
          title={!workspaceId ? 'Open a workspace in the canvas first' : undefined}
          style={{
            padding: '9px 20px',
            background: activateState === 'done' ? 'rgba(125,211,168,0.15)' : '#3385FF',
            border: `1px solid ${activateState === 'done' ? 'rgba(125,211,168,0.4)' : 'transparent'}`,
            borderRadius: 7,
            color: activateState === 'done' ? '#7DD3A8' : 'white',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '0.75rem',
            cursor: (activateState === 'activating' || activateState === 'done' || !workspaceId) ? 'not-allowed' : 'pointer',
            opacity: (activateState === 'activating' || !workspaceId) ? 0.6 : 1,
            transition: 'background 0.15s, opacity 0.15s',
          }}
        >
          {activateState === 'activating' ? 'Saving…' :
           activateState === 'done'       ? '✓ Tokens saved & activated' :
           `Activate ${tokens.length} tokens`}
        </button>
        {activateState === 'error' && (
          <span style={{ fontSize: '0.625rem', color: '#FF8080', fontFamily: "'Inter', sans-serif" }}>
            Save failed — check console for details
          </span>
        )}
      </div>
    </div>
  );
}

function VersionHistory({
  rows, loading, onRestore,
}: {
  rows: DesignLanguageFile[];
  loading: boolean;
  onRestore: (row: DesignLanguageFile) => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionTitle>Version History</SectionTitle>
        <StatusCard><Spinner /><span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Loading…</span></StatusCard>
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <SectionTitle>Version History</SectionTitle>
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        {rows.map((row, i) => (
          <div
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: row.is_active ? 'rgba(125,211,168,0.04)' : 'transparent',
            }}
          >
            {/* Version badge */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.5625rem',
              color: row.is_active ? '#7DD3A8' : 'rgba(255,255,255,0.3)',
              background: row.is_active ? 'rgba(125,211,168,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${row.is_active ? 'rgba(125,211,168,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 4,
              padding: '2px 7px',
              flexShrink: 0,
              minWidth: 36,
              textAlign: 'center',
            }}>
              v{row.version}
            </div>

            {/* File name */}
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.6875rem',
              color: row.is_active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.name}
            </span>

            {/* Timestamp */}
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.5875rem', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
              {relativeTime(row.created_at)}
            </span>

            {/* Active indicator OR restore button */}
            {row.is_active ? (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: '#7DD3A8', letterSpacing: '0.06em' }}>ACTIVE</span>
            ) : (
              <button
                onClick={() => onRestore(row)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 5,
                  color: 'rgba(255,255,255,0.45)',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.5875rem',
                  transition: 'border-color 0.1s, color 0.1s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3385FF';
                  e.currentTarget.style.color = '#3385FF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                }}
              >
                Restore
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.5875rem',
      color: 'rgba(255,255,255,0.3)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function FormatReference() {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        color: 'rgba(255,255,255,0.3)',
        cursor: 'pointer',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        userSelect: 'none',
        listStyle: 'none',
      }}>
        Supported formats ↓
      </summary>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'W3C DTCG', desc: '$value / $type fields', example: '{\n  "color": {\n    "primary": { "$value": "#0066FF", "$type": "color" }\n  }\n}' },
          { label: 'Style Dictionary', desc: 'Nested with value field', example: '{\n  "color": {\n    "primary": { "value": "#0066FF" }\n  }\n}' },
          { label: 'Flat CSS Variables', desc: 'All keys start with --', example: '{\n  "--color-primary": "#0066FF",\n  "--spacing-md": "16px"\n}' },
        ].map(({ label, desc, example }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 6px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.5875rem', color: 'rgba(255,255,255,0.3)' }}>{desc}</span>
            </div>
            <pre style={{ margin: 0, padding: '8px 14px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: '#7EB8FF', background: 'rgba(0,0,0,0.2)', overflow: 'auto', lineHeight: 1.65 }}>
              {example}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}
