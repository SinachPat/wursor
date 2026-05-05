'use client';

/**
 * TokenAwareInput — Phase 6
 *
 * A numeric/text CSS input that watches the loaded design tokens and shows a
 * token-match badge when the current value maps to a known token. Clicking the
 * badge opens a TokenPicker dropdown to swap to a different token value.
 *
 * Used in all Design tab section inputs (FrameSection, FillSection, etc.).
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 6 §9.4 "Token-aware inputs"
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvas } from '@/store/canvas';
import { useCanvasTheme } from '@/store/canvasTheme';
import { TokenPicker } from './TokenPicker';
import type { DesignToken, TokenMatch } from '@/store/canvas.types';

// Lazily import the resolver from the design-language package at runtime.
// This avoids a hard dependency at module load time while still getting full
// type safety via the import type pattern.
async function resolveToken(
  cssValue: string,
  tokens: DesignToken[],
  rootFontSizePx: number,
): Promise<TokenMatch | null> {
  try {
    const { resolveValueToToken } = await import('@originmain/design-language');
    return resolveValueToToken(cssValue, tokens, rootFontSizePx) as TokenMatch | null;
  } catch {
    return null;
  }
}

interface TokenAwareInputProps {
  /** Current CSS value string (e.g. "16px", "rgb(0,102,255)"). */
  value: string;
  /** CSS property name — used to filter token candidates by type. */
  propKey: string;
  /** Called when the user commits a new value (keyboard Enter / blur / token pick). */
  onPatch: (prop: string, val: string) => void;
  /** Width of the input in px. Default: 60. */
  inputWidth?: number;
  /** If true, renders a full-width input. Overrides inputWidth. */
  fullWidth?: boolean;
  /** If true, renders a color picker swatch alongside the input. */
  isColor?: boolean;
}

export function TokenAwareInput({
  value,
  propKey,
  onPatch,
  inputWidth = 60,
  fullWidth = false,
  isColor = false,
}: TokenAwareInputProps) {
  const T = useCanvasTheme();
  const { designLanguageTokens, artboardRootFontSize, selectedArtboardId } = useCanvas();
  const rootFontSizePx = selectedArtboardId ? (artboardRootFontSize[selectedArtboardId] ?? 16) : 16;

  const [draft, setDraft] = useState(value);
  const [match, setMatch] = useState<TokenMatch | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const prevValueRef = useRef(value);

  // Sync draft when external value changes
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setDraft(value);
  }

  // Resolve token whenever value or token library changes
  useEffect(() => {
    if (!designLanguageTokens || designLanguageTokens.length === 0) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    void resolveToken(value, designLanguageTokens, rootFontSizePx).then((m) => {
      if (!cancelled) setMatch(m);
    });
    return () => { cancelled = true; };
  }, [value, designLanguageTokens, rootFontSizePx]);

  const commit = useCallback((v: string) => {
    onPatch(propKey, v);
  }, [onPatch, propKey]);

  const handleTokenSelect = useCallback((token: DesignToken) => {
    setDraft(token.rawValue);
    commit(token.rawValue);
    setPickerOpen(false);
  }, [commit]);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Main input */}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={e => {
          if (e.key === 'Enter') { commit(draft); e.currentTarget.blur(); }
          if (e.key === 'Escape') setDraft(value);
          e.stopPropagation();
        }}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5875rem',
          background: T.bgDeep,
          border: `1px solid ${match?.exact ? T.accent + '55' : T.border}`,
          borderRadius: 4,
          color: T.fg,
          padding: '3px 6px',
          width: fullWidth ? '100%' : inputWidth,
          outline: 'none',
          textAlign: 'right',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
      />

      {/* Token match badge */}
      {match && designLanguageTokens && (
        <button
          title={`Token: ${match.token.name}\n${match.token.key}\n${match.exact ? 'Exact match' : `Distance: ${match.distance.toFixed(1)}`}`}
          onClick={() => setPickerOpen((o) => !o)}
          style={{
            background: match.exact ? T.accentBg : 'rgba(255,186,123,0.12)',
            border: `1px solid ${match.exact ? T.accent + '44' : 'rgba(255,186,123,0.3)'}`,
            borderRadius: 3,
            padding: '2px 4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
          }}
        >
          {/* Colour swatch for colour tokens */}
          {match.token.type === 'color' && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: match.token.rawValue,
              border: '1px solid rgba(255,255,255,0.2)',
            }} />
          )}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.4rem',
            color: match.exact ? T.accent : '#FFBA7B',
            letterSpacing: '-0.01em',
            maxWidth: 48,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>
            {match.token.key.replace(/^--/, '')}
          </span>
        </button>
      )}

      {/* TokenPicker dropdown */}
      {pickerOpen && designLanguageTokens && (
        <TokenPicker
          cssValue={value}
          propKey={propKey}
          tokens={designLanguageTokens}
          rootFontSizePx={rootFontSizePx}
          onSelect={handleTokenSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
