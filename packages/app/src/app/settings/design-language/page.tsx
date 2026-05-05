'use client';

/**
 * /settings/design-language — Phase 6
 *
 * Design Language Settings page.  Allows workspace admins to:
 *   1. Upload a token file (Style Dictionary / W3C DTCG / flat CSS vars)
 *   2. Validate the parsed token set before activating
 *   3. Activate the tokens workspace-wide (stored in Supabase + canvas store)
 *   4. View version history of previously uploaded token files
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.5
 */

import { useState, useCallback, useRef } from 'react';
import { useCanvas } from '@/store/canvas';
import type { DesignToken } from '@/store/canvas.types';

// ── Upload & validation states ─────────────────────────────────────────────────

type ParseState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'parsed'; tokens: DesignToken[]; filename: string }
  | { status: 'error'; message: string };

type ActivateState = 'idle' | 'activating' | 'done' | 'error';

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DesignLanguagePage() {
  const { designLanguageTokens, setDesignLanguageTokens } = useCanvas();
  const [parseState, setParseState] = useState<ParseState>({ status: 'idle' });
  const [activateState, setActivateState] = useState<ActivateState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ───────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setParseState({ status: 'error', message: 'Only .json token files are supported.' });
      return;
    }

    setParseState({ status: 'parsing' });
    try {
      const text = await file.text();
      const tokens = await parseTokenFileClient(text);
      if (tokens.length === 0) {
        setParseState({ status: 'error', message: 'No tokens found. Check the file format.' });
        return;
      }
      setParseState({ status: 'parsed', tokens, filename: file.name });
      setActivateState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseState({ status: 'error', message: `Parse failed: ${msg}` });
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    // Reset so the same file can be re-uploaded
    e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }, [processFile]);

  // ── Activation ──────────────────────────────────────────────────────────────

  const activate = useCallback(() => {
    if (parseState.status !== 'parsed') return;
    setActivateState('activating');
    try {
      setDesignLanguageTokens(parseState.tokens);
      setActivateState('done');
    } catch {
      setActivateState('error');
    }
  }, [parseState, setDesignLanguageTokens]);

  const deactivate = useCallback(() => {
    setDesignLanguageTokens(null);
    setParseState({ status: 'idle' });
    setActivateState('idle');
  }, [setDesignLanguageTokens]);

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

      {/* Parse state */}
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
          onActivate={activate}
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
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
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
        marginBottom: 24,
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
  tokens,
  filename,
  activateState,
  onActivate,
}: {
  tokens: DesignToken[];
  filename: string;
  activateState: ActivateState;
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
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: '#7DD3A8' }}>
          ✓ Parsed
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.7)', flex: 1 }}>
          {filename}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.35)' }}>
          {tokens.length} tokens · {Object.keys(groups).length} groups
        </span>
      </div>

      {/* Group list */}
      {Object.entries(groups).map(([group, groupTokens]) => (
        <div key={group} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setExpanded(expanded === group ? null : group)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)' }}>
              {expanded === group ? '▼' : '▶'}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', flex: 1, textTransform: 'capitalize' }}>
              {group}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)' }}>
              {groupTokens.length}
            </span>
            {/* Color swatches preview */}
            <div style={{ display: 'flex', gap: 3 }}>
              {groupTokens
                .filter(t => t.type === 'color')
                .slice(0, 6)
                .map(t => (
                  <div key={t.key} style={{ width: 12, height: 12, borderRadius: 2, background: t.rawValue, border: '1px solid rgba(255,255,255,0.1)' }} />
                ))}
            </div>
          </button>

          {expanded === group && (
            <div style={{ paddingBottom: 8 }}>
              {groupTokens.map(token => (
                <div key={token.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '5px 18px 5px 36px',
                }}>
                  {token.type === 'color' && (
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: token.rawValue, flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }} />
                  )}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: '#3385FF', flex: 1, letterSpacing: '-0.01em' }}>
                    {token.key}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.01em' }}>
                    {token.rawValue}
                  </span>
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
          disabled={activateState === 'activating' || activateState === 'done'}
          style={{
            padding: '9px 20px',
            background: activateState === 'done' ? 'rgba(125,211,168,0.15)' : '#3385FF',
            border: `1px solid ${activateState === 'done' ? 'rgba(125,211,168,0.4)' : 'transparent'}`,
            borderRadius: 7,
            color: activateState === 'done' ? '#7DD3A8' : 'white',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '0.75rem',
            cursor: activateState === 'activating' || activateState === 'done' ? 'not-allowed' : 'pointer',
            opacity: activateState === 'activating' ? 0.6 : 1,
            transition: 'background 0.15s, opacity 0.15s',
          }}
        >
          {activateState === 'activating' ? 'Activating…' :
           activateState === 'done' ? '✓ Tokens activated' :
           `Activate ${tokens.length} tokens`}
        </button>

        {activateState === 'error' && (
          <span style={{ fontSize: '0.625rem', color: '#FF8080', fontFamily: "'Inter', sans-serif" }}>
            Activation failed — try again
          </span>
        )}
      </div>
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
          {
            label: 'W3C DTCG',
            desc: '$value / $type fields',
            example: `{\n  "color": {\n    "primary": { "$value": "#0066FF", "$type": "color" }\n  }\n}`,
          },
          {
            label: 'Style Dictionary',
            desc: 'Nested with value field',
            example: `{\n  "color": {\n    "primary": { "value": "#0066FF" }\n  }\n}`,
          },
          {
            label: 'Flat CSS Variables',
            desc: 'All keys start with --',
            example: `{\n  "--color-primary": "#0066FF",\n  "--spacing-md": "16px"\n}`,
          },
        ].map(({ label, desc, example }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px 6px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.5875rem', color: 'rgba(255,255,255,0.3)' }}>{desc}</span>
            </div>
            <pre style={{
              margin: 0, padding: '8px 14px 12px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.5625rem',
              color: '#7EB8FF',
              background: 'rgba(0,0,0,0.2)',
              overflow: 'auto',
              lineHeight: 1.65,
            }}>
              {example}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}
