'use client';

import {
  ToolbarButton,
  ToolbarDivider,
  Tooltip,
  Badge,
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

export function Toolbar() {
  const { activeTool, setActiveTool } = useCanvas();
  const zoom = useViewport((s) => s.zoom);
  const setZoom = useViewport((s) => s.setZoom);
  const reset  = useViewport((s) => s.reset);

  const ap = (id: Tool): 'primary' | 'subtle' => activeTool === id ? 'primary' : 'subtle';

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        gridRow: 1,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: '#fff',
        paddingInline: 8,
        gap: 2,
        height: 40,
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 800,
          fontSize: '0.9375rem',
          color: '#0F52BA',
          letterSpacing: '-0.04em',
          padding: '0 8px',
          marginRight: 4,
          userSelect: 'none',
        }}
      >
        Om
      </span>

      <ToolbarDivider />

      {/* Select */}
      <Tooltip content="Select  V" relationship="label">
        <ToolbarButton appearance={ap('select')} icon={<CursorClickRegular />} onClick={() => setActiveTool('select')} />
      </Tooltip>
      {/* Pan */}
      <Tooltip content="Pan  H" relationship="label">
        <ToolbarButton appearance={ap('pan')} icon={<HandLeftRegular />} onClick={() => setActiveTool('pan')} />
      </Tooltip>
      {/* Artboard */}
      <Tooltip content="New Artboard  A" relationship="label">
        <ToolbarButton appearance={ap('artboard')} icon={<SquareRegular />} onClick={() => setActiveTool('artboard')} />
      </Tooltip>
      {/* Zone */}
      <Tooltip content="Completion Zone  Z" relationship="label">
        <ToolbarButton appearance={ap('zone')} icon={<SelectObjectRegular />} onClick={() => setActiveTool('zone')} />
      </Tooltip>

      <ToolbarDivider />

      {/* View tools */}
      <Tooltip content="Intent Diff" relationship="label">
        <ToolbarButton appearance="subtle" icon={<DataTrendingRegular />} />
      </Tooltip>
      <Tooltip content="Origin Graph" relationship="label">
        <ToolbarButton appearance="subtle" icon={<CircleHintHalfVerticalRegular />} />
      </Tooltip>

      {/* Right — zoom + live status */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, paddingInline: 4 }}>
        <Tooltip content="Zoom out" relationship="label">
          <ToolbarButton appearance="subtle" icon={<ZoomOutRegular />} onClick={() => setZoom(zoom * 0.8)} />
        </Tooltip>
        <button
          onClick={reset}
          style={{
            background: 'none',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: '0.6875rem',
            fontFamily: 'monospace',
            color: 'rgba(0,0,0,0.5)',
            cursor: 'pointer',
            minWidth: 46,
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <Tooltip content="Zoom in" relationship="label">
          <ToolbarButton appearance="subtle" icon={<ZoomInRegular />} onClick={() => setZoom(zoom * 1.25)} />
        </Tooltip>

        <ToolbarDivider />

        <Badge color="success" size="extra-small" />
        <span style={{ fontSize: '0.6875rem', fontFamily: 'monospace', color: 'rgba(0,0,0,0.4)', paddingRight: 4 }}>
          Live
        </span>
      </div>
    </div>
  );
}
