'use client';

import { TabList, Tab, Divider } from '@fluentui/react-components';
import { useCanvas } from '@/store/canvas';

const PROPS = [
  { key: 'title',   val: '"Revenue Overview"', type: 's' },
  { key: 'value',   val: '"$12,450"',          type: 's' },
  { key: 'delta',   val: '+2.4',               type: 'n' },
  { key: 'period',  val: '"monthly"',          type: 's' },
  { key: 'loading', val: 'false',              type: 'b' },
];

const DIFF = [
  { op: 'del', text: '− borderRadius: 8px' },
  { op: 'add', text: '+ borderRadius: 12px' },
  { op: 'del', text: '− accentColor: #2A6CD4' },
  { op: 'add', text: '+ accentColor: #0F52BA' },
];

const TYPE_COLORS: Record<string, string> = {
  s: '#16a34a',
  n: '#2563eb',
  b: '#d97706',
};

export function Inspector() {
  const { selectedArtboardId } = useCanvas();

  return (
    <div
      style={{
        gridColumn: 3,
        gridRow: 2,
        background: '#fafafa',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      <TabList defaultSelectedValue="props" size="small" style={{ padding: '0 8px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Tab value="props">Props</Tab>
        <Tab value="diff">Diff</Tab>
        <Tab value="graph">Graph</Tab>
      </TabList>

      {selectedArtboardId ? (
        <>
          <Section label="Component Props">
            {PROPS.map(({ key, val, type }) => (
              <PropRow key={key} label={key} value={val} color={TYPE_COLORS[type] ?? '#555'} />
            ))}
          </Section>

          <Divider style={{ margin: 0 }} />

          <Section label="Intent Diff">
            {DIFF.map((d, i) => (
              <div
                key={i}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 3,
                  marginBottom: 3,
                  background: d.op === 'del' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                  color:      d.op === 'del' ? '#dc2626' : '#16a34a',
                }}
              >
                {d.text}
              </div>
            ))}
          </Section>

          <Divider style={{ margin: 0 }} />

          <Section label="Render Target">
            <PropRow label="file"   value="dashboard.tsx:42" color="#2563eb" />
            <PropRow label="status" value="connected"        color="#16a34a" />
            <PropRow label="agent"  value="claude-code"      color="#16a34a" />
          </Section>
        </>
      ) : (
        <div style={{ padding: 24, color: 'rgba(0,0,0,0.3)', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}>
          Select an artboard
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color }}>{value}</span>
    </div>
  );
}
