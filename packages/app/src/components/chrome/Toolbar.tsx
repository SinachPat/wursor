'use client';

import {
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
import { useCanvasTheme } from '@/store/canvasTheme';

export function Toolbar() {
  const T = useCanvasTheme();
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

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tooltip content="Zoom out" relationship="label">
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

        <Tooltip content="Zoom in" relationship="label">
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
