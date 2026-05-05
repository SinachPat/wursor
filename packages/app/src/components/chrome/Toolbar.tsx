'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Tooltip,
} from '@fluentui/react-components';
import {
  CursorClickRegular,
  HandLeftRegular,
  SquareRegular,
  SelectObjectRegular,
  DataTrendingRegular,
  CircleHintHalfVerticalRegular,
  ZoomInRegular,
  ZoomOutRegular,
} from '@fluentui/react-icons';
import { useCanvas, type Tool } from '@/store/canvas';
import { useViewport } from '@/store/viewport';
import { useCanvasTheme } from '@/store/canvasTheme';

// ── Device presets (spec Phase 0 §3.4) ───────────────────────────────────────
export const DEVICE_PRESETS = [
  { key: 'desktop-hd',         label: 'Desktop HD',              width: 1440, height: 900  },
  { key: 'desktop-lg',         label: 'Desktop Large',           width: 1280, height: 800  },
  { key: 'laptop',             label: 'Laptop',                  width: 1024, height: 768  },
  { key: 'tablet-landscape',   label: 'Tablet Landscape',        width: 1366, height: 1024 },
  { key: 'tablet-portrait',    label: 'Tablet Portrait',         width: 768,  height: 1024 },
  { key: 'mobile-iphone-14',   label: 'iPhone 14',               width: 390,  height: 844  },
  { key: 'mobile-iphone-se',   label: 'iPhone SE',               width: 375,  height: 667  },
  { key: 'mobile-android',     label: 'Android',                 width: 360,  height: 800  },
] as const;

function matchPreset(w: number | null, h: number | null) {
  if (w == null || h == null) return null;
  return DEVICE_PRESETS.find(p => p.width === w && p.height === h) ?? null;
}

export function Toolbar() {
  const T = useCanvasTheme();
  const { activeTool, setActiveTool,
          selectedArtboardId, selectedArtboardW, selectedArtboardH,
          dispatchArtboardResize } = useCanvas();
  const zoom    = useViewport((s) => s.zoom);
  const setZoom = useViewport((s) => s.setZoom);
  const reset   = useViewport((s) => s.reset);

  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!presetOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!presetRef.current?.contains(e.target as Node)) setPresetOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [presetOpen]);

  const activePreset = matchPreset(selectedArtboardW, selectedArtboardH);
  const sizeLabel = selectedArtboardW != null && selectedArtboardH != null
    ? `${selectedArtboardW} × ${selectedArtboardH}`
    : null;

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        gridRow: 1,
        display: 'flex',
        alignItems: 'center',
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        paddingInline: 12,
        gap: 2,
        height: 44,
        userSelect: 'none',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: '0.875rem',
          letterSpacing: '-0.04em',
          color: T.fg,
          padding: '0 10px 0 4px',
          marginRight: 2,
          flexShrink: 0,
          transition: 'color 0.2s',
        }}
      >
        Om<span style={{ color: T.accent }}>•</span>
      </span>

      <Sep T={T} />

      {/* Selection tools */}
      <ToolGroup>
        <Tooltip content="Select  V" relationship="label">
          <TBtn T={T} active={activeTool === 'select'} onClick={() => setActiveTool('select')}>
            <CursorClickRegular />
          </TBtn>
        </Tooltip>
        <Tooltip content="Pan  H" relationship="label">
          <TBtn T={T} active={activeTool === 'pan'} onClick={() => setActiveTool('pan')}>
            <HandLeftRegular />
          </TBtn>
        </Tooltip>
      </ToolGroup>

      <Sep T={T} />

      {/* Create tools */}
      <ToolGroup>
        <Tooltip content="New Artboard  A" relationship="label">
          <TBtn T={T} active={activeTool === 'artboard'} onClick={() => setActiveTool('artboard')}>
            <SquareRegular />
          </TBtn>
        </Tooltip>
        <Tooltip content="Completion Zone  Z" relationship="label">
          <TBtn T={T} active={activeTool === 'zone'} onClick={() => setActiveTool('zone')}>
            <SelectObjectRegular />
          </TBtn>
        </Tooltip>
      </ToolGroup>

      <Sep T={T} />

      {/* View tools */}
      <ToolGroup>
        <Tooltip content="Intent Diff" relationship="label">
          <TBtn T={T} active={false} onClick={() => {}}>
            <DataTrendingRegular />
          </TBtn>
        </Tooltip>
        <Tooltip content="Origin Graph" relationship="label">
          <TBtn T={T} active={false} onClick={() => {}}>
            <CircleHintHalfVerticalRegular />
          </TBtn>
        </Tooltip>
      </ToolGroup>

      {/* Device preset picker — only visible when an artboard is selected */}
      {selectedArtboardId && sizeLabel && (
        <>
          <Sep T={T} />
          <div ref={presetRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPresetOpen(o => !o)}
              title="Device preset"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: presetOpen ? T.accentBg : T.activeBg,
                border: `1px solid ${presetOpen ? T.accent + '66' : T.sep}`,
                borderRadius: 5, padding: '3px 8px',
                fontSize: '0.625rem',
                fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
                color: presetOpen ? T.accent : T.fgMuted,
                cursor: 'pointer', letterSpacing: '-0.01em',
                transition: 'background 0.1s, color 0.1s, border-color 0.1s',
              }}
            >
              {/* Device icon */}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                {selectedArtboardH != null && selectedArtboardW != null && selectedArtboardH > selectedArtboardW ? (
                  /* Portrait — phone */
                  <rect x="3" y="0.5" width="6" height="11" rx="1.5" stroke="currentColor" strokeWidth="1"/>
                ) : (
                  /* Landscape — desktop/tablet */
                  <rect x="0.5" y="2" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1"/>
                )}
              </svg>
              <span>{activePreset ? activePreset.label : sizeLabel}</span>
              <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                <path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {presetOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 7, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                minWidth: 200, zIndex: 100, overflow: 'hidden',
              }}>
                {DEVICE_PRESETS.map(preset => {
                  const isActive = activePreset?.key === preset.key;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => {
                        if (selectedArtboardId) {
                          dispatchArtboardResize(selectedArtboardId, preset.width, preset.height);
                        }
                        setPresetOpen(false);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '7px 12px',
                        background: isActive ? T.accentBg : 'transparent',
                        border: 'none', cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontSize: '0.6rem', letterSpacing: '-0.01em',
                        color: isActive ? T.accent : T.item,
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget).style.background = T.hoverBg; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget).style.background = 'transparent'; }}
                    >
                      <span>{preset.label}</span>
                      <span style={{ color: T.dim, fontVariantNumeric: 'tabular-nums' }}>
                        {preset.width} × {preset.height}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tooltip content="Zoom out  Cmd−" relationship="label">
          <TBtn T={T} active={false} onClick={() => setZoom(zoom * 0.8)}>
            <ZoomOutRegular />
          </TBtn>
        </Tooltip>

        <button
          onClick={reset}
          style={{
            background: T.activeBg,
            border: `1px solid ${T.sep}`,
            borderRadius: 5,
            padding: '3px 9px',
            fontSize: '0.6875rem',
            fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
            color: T.fgMuted,
            cursor: 'pointer',
            minWidth: 48,
            textAlign: 'center',
            transition: 'background 0.12s, color 0.12s',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = T.hoverBg;
            (e.currentTarget as HTMLButtonElement).style.color = T.fg;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = T.activeBg;
            (e.currentTarget as HTMLButtonElement).style.color = T.fgMuted;
          }}
        >
          {Math.round(zoom * 100)}%
        </button>

        <Tooltip content="Zoom in  Cmd+" relationship="label">
          <TBtn T={T} active={false} onClick={() => setZoom(zoom * 1.25)}>
            <ZoomInRegular />
          </TBtn>
        </Tooltip>

        <Sep T={T} />

        {/* Live status pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 6,
            background: T.liveBg,
            border: `1px solid ${T.liveBorder}`,
            marginLeft: 2,
            marginRight: 4,
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.live, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '0.625rem',
              color: T.live,
              fontWeight: 500,
            }}
          >
            Live
          </span>
        </div>
      </div>
    </div>
  );
}

import type { CanvasTokens } from '@/store/canvasTheme';

function Sep({ T }: { T: CanvasTokens }) {
  return (
    <div
      style={{
        width: 1, height: 20,
        background: T.sep,
        margin: '0 5px',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    />
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>{children}</div>;
}

function TBtn({
  T,
  active,
  onClick,
  children,
}: {
  T: CanvasTokens;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32,
        borderRadius: 6,
        border: 'none',
        background: active ? T.accentBg : 'transparent',
        color: active ? T.accent : T.item,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
        fontSize: '1rem',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = T.activeBg;
          (e.currentTarget as HTMLButtonElement).style.color = T.itemHov;
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = T.item;
        }
      }}
    >
      {children}
    </button>
  );
}
