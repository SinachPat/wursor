'use client';

import { useState } from 'react';
import { useCanvas } from '@/store/canvas';

const PROPS = [
  { key: 'title',   val: '"Revenue Overview"', type: 's' },
  { key: 'value',   val: '"$12,450"',           type: 's' },
  { key: 'delta',   val: '+2.4',                type: 'n' },
  { key: 'period',  val: '"monthly"',           type: 's' },
  { key: 'loading', val: 'false',               type: 'b' },
];

const DIFF = [
  { op: 'del', text: '− borderRadius: 8px' },
  { op: 'add', text: '+ borderRadius: 12px' },
  { op: 'del', text: '− accentColor: #2A6CD4' },
  { op: 'add', text: '+ accentColor: #0066FF' },
  { op: 'del', text: '− padding: 16' },
  { op: 'add', text: '+ padding: 20' },
];

const TYPE_COLORS: Record<string, string> = {
  s: '#7DD3A8',
  n: '#7EB8FF',
  b: '#FFBA7B',
};

type TabId = 'props' | 'diff' | 'graph';

// Dark panel tokens
const T = {
  bg:      '#111115',
  border:  'rgba(255,255,255,0.055)',
  sep:     'rgba(255,255,255,0.04)',
  label:   'rgba(255,255,255,0.22)',
  key:     'rgba(255,255,255,0.32)',
  dim:     'rgba(255,255,255,0.18)',
  accent:  '#3385FF',
  tabFg:   'rgba(255,255,255,0.28)',
  tabOn:   'rgba(255,255,255,0.88)',
};

export function Inspector() {
  const { selectedArtboardId } = useCanvas();
  const [tab, setTab] = useState<TabId>('props');

  return (
    <div
      style={{
        gridColumn: 3,
        gridRow: 2,
        background: T.bg,
        borderLeft: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}
      >
        {(['props', 'diff', 'graph'] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '11px 0',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '0.5875rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: tab === t ? T.tabOn : T.tabFg,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${T.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.12s',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!selectedArtboardId ? (
          <div
            style={{
              padding: '32px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '1.25rem', opacity: 0.3 }}>⬜</span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: '0.625rem',
                color: 'rgba(255,255,255,0.22)',
                letterSpacing: '0.06em',
              }}
            >
              Select an artboard
            </span>
          </div>
        ) : tab === 'props' ? (
          <>
            <Section label="Component Props">
              {PROPS.map(({ key, val, type }) => (
                <PropRow key={key} label={key} value={val} color={TYPE_COLORS[type] ?? T.key} />
              ))}
            </Section>
            <HSep />
            <Section label="Render Target">
              <PropRow label="file"   value="dashboard.tsx:42" color="#7EB8FF" />
              <PropRow label="status" value="connected"        color="#7DD3A8" />
              <PropRow label="agent"  value="claude-code"      color="#7DD3A8" />
            </Section>
          </>
        ) : tab === 'diff' ? (
          <Section label="Intent Diff">
            <div
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: '0.5875rem',
                color: 'rgba(255,255,255,0.28)',
                marginBottom: 10,
                letterSpacing: '-0.01em',
              }}
            >
              DashboardCard.tsx · 3 hunks
            </div>
            {DIFF.map((d, i) => (
              <div
                key={i}
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: '0.625rem',
                  padding: '4px 8px',
                  borderRadius: 4,
                  marginBottom: 3,
                  lineHeight: 1.55,
                  background: d.op === 'del' ? 'rgba(255,70,70,0.08)' : 'rgba(70,220,120,0.08)',
                  color:      d.op === 'del' ? '#FF8080' : '#7DDBA0',
                  borderLeft: `2px solid ${d.op === 'del' ? 'rgba(255,80,80,0.3)' : 'rgba(70,220,120,0.3)'}`,
                }}
              >
                {d.text}
              </div>
            ))}
          </Section>
        ) : (
          <Section label="Origin Graph">
            <GraphNode label="DashboardCard" depth={0} isRoot />
            <GraphNode label="StatsCard" depth={1} />
            <GraphNode label="ProgressBar" depth={2} />
            <GraphNode label="ValueDisplay" depth={2} />
            <GraphNode label="CardBase" depth={1} />
            <GraphNode label="Elevation" depth={2} />
            <HSep />
            <div style={{ padding: '4px 0 8px' }}>
              <PropRow label="nodes" value="284" color="#7EB8FF" />
              <PropRow label="depth" value="4" color="#7EB8FF" />
              <PropRow label="tokens used" value="12" color="#FFBA7B" />
            </div>
          </Section>
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          height: 27,
          background: '#0D0D11',
          borderTop: `1px solid ${T.sep}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.45)' }}>
          Live render connected
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.5625rem', color: 'rgba(255,255,255,0.22)' }}>
          284 nodes
        </span>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px' }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.5rem',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: T.label,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
        gap: 8,
      }}
    >
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.625rem', color: T.key, flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.625rem',
          color,
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '60%',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function GraphNode({ label, depth, isRoot }: { label: string; depth: number; isRoot?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: depth * 14,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isRoot ? T.accent : 'rgba(255,255,255,0.18)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.625rem',
          color: isRoot ? T.accent : 'rgba(255,255,255,0.5)',
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function HSep() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />;
}
