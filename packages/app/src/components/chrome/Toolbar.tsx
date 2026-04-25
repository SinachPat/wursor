'use client';

import {
  ToolbarButton,
  ToolbarDivider,
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

// Design tokens — Fluent dark surface
const T = {
  bg:        '#141418',
  border:    'rgba(255,255,255,0.06)',
  sep:       'rgba(255,255,255,0.07)',
  fg:        'rgba(255,255,255,0.88)',
  fgMuted:   'rgba(255,255,255,0.38)',
  fgDim:     'rgba(255,255,255,0.22)',
  accent:    '#3385FF',
  accentBg:  'rgba(51,133,255,0.14)',
  activeBg:  'rgba(255,255,255,0.07)',
  live:      '#10B981',
  liveBg:    'rgba(16,185,129,0.1)',
  liveBorder:'rgba(16,185,129,0.2)',
};

export function Toolbar() {
  const { activeTool, setActiveTool } = useCanvas();
  const zoom    = useViewport((s) => s.zoom);
  const setZoom = useViewport((s) => s.setZoom);
  const reset   = useViewport((s) => s.reset);

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
        }}
      >
        Om<span style={{ color: T.accent }}>•</span>
      </span>

      <Sep />

      {/* Selection tools */}
      <ToolGroup>
        <Tooltip content="Select  V" relationship="label">
          <TBtn active={activeTool === 'select'} onClick={() => setActiveTool('select')}>
            <CursorClickRegular />
          </TBtn>
        </Tooltip>
        <Tooltip content="Pan  H" relationship="label">
          <TBtn active={activeTool === 'pan'} onClick={() => setActiveTool('pan')}>
            <HandLeftRegular />
          </TBtn>
        </Tooltip>
      </ToolGroup>

      <Sep />

      {/* Create tools */}
      <ToolGroup>
        <Tooltip content="New Artboard  A" relationship="label">
          <TBtn active={activeTool === 'artboard'} onClick={() => setActiveTool('artboard')}>
            <SquareRegular />
          </TBtn>
        </Tooltip>
        <Tooltip content="Completion Zone  Z" relationship="label">
          <TBtn active={activeTool === 'zone'} onClick={() => setActiveTool('zone')}>
            <SelectObjectRegular />
          </TBtn>
        </Tooltip>
      </ToolGroup>

      <Sep />

      {/* View tools */}
      <ToolGroup>
        <Tooltip content="Intent Diff" relationship="label">
          <TBtn active={false} onClick={() => {}}>
            <DataTrendingRegular />
          </TBtn>
        </Tooltip>
        <Tooltip content="Origin Graph" relationship="label">
          <TBtn active={false} onClick={() => {}}>
            <CircleHintHalfVerticalRegular />
          </TBtn>
        </Tooltip>
      </ToolGroup>

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tooltip content="Zoom out" relationship="label">
          <TBtn active={false} onClick={() => setZoom(zoom * 0.8)}>
            <ZoomOutRegular />
          </TBtn>
        </Tooltip>

        <button
          onClick={reset}
          style={{
            background: 'rgba(255,255,255,0.05)',
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
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
            (e.currentTarget as HTMLButtonElement).style.color = T.fg;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.color = T.fgMuted;
          }}
        >
          {Math.round(zoom * 100)}%
        </button>

        <Tooltip content="Zoom in" relationship="label">
          <TBtn active={false} onClick={() => setZoom(zoom * 1.25)}>
            <ZoomInRegular />
          </TBtn>
        </Tooltip>

        <Sep />

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
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.live,
              flexShrink: 0,
            }}
          />
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

function Sep() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.07)',
        margin: '0 5px',
        flexShrink: 0,
      }}
    />
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {children}
    </div>
  );
}

function TBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        border: 'none',
        background: active ? 'rgba(51,133,255,0.15)' : 'transparent',
        color: active ? '#3385FF' : 'rgba(255,255,255,0.42)',
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
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.42)';
        }
      }}
    >
      {children}
    </button>
  );
}
