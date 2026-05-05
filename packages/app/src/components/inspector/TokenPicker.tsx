'use client';

/**
 * TokenPicker — Phase 6
 *
 * Dropdown panel listing the closest token matches for the current CSS value.
 * Opened by TokenAwareInput when the user clicks the token badge.
 * Clicking a row patches the value and closes the picker.
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.4
 */

import { useState, useEffect, useRef } from 'react';
import { useCanvasTheme } from '@/store/canvasTheme';
import type { DesignToken, TokenMatch } from '@/store/canvas.types';

async function resolveTokens(
  cssValue: string,
  tokens: DesignToken[],
  rootFontSizePx: number,
): Promise<TokenMatch[]> {
  try {
    const { resolveValueToTokens } = await import('@originmain/design-language');
    return (resolveValueToTokens(cssValue, tokens, rootFontSizePx, 8) as TokenMatch[]);
  } catch {
    return [];
  }
}

interface TokenPickerProps {
  cssValue: string;
  propKey: string;
  tokens: DesignToken[];
  rootFontSizePx: number;
  onSelect: (token: DesignToken) => void;
  onClose: () => void;
}

export function TokenPicker({
  cssValue,
  propKey,
  tokens,
  rootFontSizePx,
  onSelect,
  onClose,
}: TokenPickerProps) {
  const T = useCanvasTheme();
  const [candidates, setCandidates] = useState<TokenMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Load candidates
  useEffect(() => {
    setLoading(true);
    void resolveTokens(cssValue, tokens, rootFontSizePx).then((matches) => {
      setCandidates(matches);
      setLoading(false);
    });
  }, [cssValue, tokens, rootFontSizePx]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Filter by search term
  const filtered = search
    ? candidates.filter(
        (m) =>
          m.token.name.toLowerCase().includes(search.toLowerCase()) ||
          m.token.key.toLowerCase().includes(search.toLowerCase()),
      )
    : candidates;

  // Also show browseable tokens filtered by prop category when no close matches found
  const browseable: TokenMatch[] = filtered.length === 0 && search
    ? tokens
        .filter(
          (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.key.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 8)
        .map((token) => ({ token, exact: false, distance: Infinity }))
    : [];

  const rows = [...filtered, ...browseable];

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 220,
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 7,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        zIndex: 200,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '7px 10px 5px',
        borderBottom: `1px solid ${T.sep}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.5rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.dim,
        }}>
          Token Picker · {propKey.replace(/^--/, '')}
        </span>

        {/* Search */}
        <input
          autoFocus
          placeholder="Search tokens…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5875rem',
            background: T.bgDeep,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            color: T.fg,
            padding: '3px 7px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Candidates list */}
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {loading ? (
          <div style={{
            padding: '12px 10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5625rem',
            color: T.dim,
            textAlign: 'center',
          }}>
            Resolving…
          </div>
        ) : rows.length === 0 ? (
          <div style={{
            padding: '12px 10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5625rem',
            color: T.dim,
            textAlign: 'center',
          }}>
            No matching tokens
          </div>
        ) : (
          rows.map((m) => (
            <TokenRow
              key={m.token.key}
              match={m}
              onSelect={() => onSelect(m.token)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TokenRow({
  match,
  onSelect,
}: {
  match: TokenMatch;
  onSelect: () => void;
}) {
  const T = useCanvasTheme();
  const [hov, setHov] = useState(false);
  const { token, exact, distance } = match;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: '100%',
        padding: '6px 10px',
        background: hov ? T.hoverBg : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      {/* Swatch for colors, or a type icon for others */}
      {token.type === 'color' ? (
        <div style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: token.rawValue,
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: exact ? `0 0 0 2px ${T.accent}55` : 'none',
        }} />
      ) : (
        <div style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: T.bgDeep,
          border: `1px solid ${T.sep}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.45rem', color: T.dim,
        }}>
          {token.type === 'spacing' ? 'sp' :
           token.type === 'fontSize' ? 'f' :
           token.type === 'fontWeight' ? 'fw' : '·'}
        </div>
      )}

      {/* Token name + key */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.5625rem',
          color: exact ? T.accent : T.fg,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {token.name}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.475rem',
          color: T.dim,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {token.rawValue}
        </div>
      </div>

      {/* Match indicator */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {exact ? (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.45rem',
            color: T.accent,
            background: T.accentBg,
            border: `1px solid ${T.accent}33`,
            borderRadius: 3,
            padding: '1px 3px',
          }}>
            exact
          </span>
        ) : distance !== Infinity ? (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.45rem',
            color: T.dim,
          }}>
            Δ{distance.toFixed(1)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
