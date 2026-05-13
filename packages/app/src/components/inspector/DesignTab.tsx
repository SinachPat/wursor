'use client';

// ── Design Tab (Phase 2) ──────────────────────────────────────────────────────
// The main inspector Design panel: component identity header, DLF violation
// banner, and all design-property section components. Extracted from
// Inspector.tsx as per spec SOURCE-AWARE-CANVAS.md Phase 2.

import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@fluentui/react-components';
import { useCanvas } from '@/store/canvas';
import { useCanvasTheme } from '@/store/canvasTheme';
import { useHistory } from '@/store/history';
import { useDlf } from '@/hooks/useDlf';
import { checkComponentConstraints } from '@originmain/design-language';
import type { Violation } from '@originmain/design-language';
import type { FiberNode } from '@originmain/renderer';
import { FrameSection }       from './sections/FrameSection';
import { LayoutSection }      from './sections/LayoutSection';
import { FillSection }        from './sections/FillSection';
import { StrokeSection }      from './sections/StrokeSection';
import { EffectsSection }     from './sections/EffectsSection';
import { TypographySection }  from './sections/TypographySection';
import { BoxModelSection }    from './sections/BoxModelSection';
import { ConstraintsSection } from './sections/ConstraintsSection';

// ── DLF violation banner ───────────────────────────────────────────────────────

function DlfViolationBanner({ violations }: { violations: Violation[] }) {
  const T        = useCanvasTheme();
  const hasError = violations.some(v => v.severity === 'error');

  return (
    <div
      style={{
        margin: '4px 10px 2px',
        padding: '8px 10px',
        background: hasError ? 'rgba(255,80,80,0.07)' : 'rgba(255,186,123,0.07)',
        border: `1px solid ${hasError ? 'rgba(255,80,80,0.4)' : 'rgba(255,186,123,0.4)'}`,
        borderRadius: 6,
      }}
    >
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: hasError ? '#FF8080' : '#FFBA7B', marginBottom: 6,
      }}>
        {hasError ? 'Design system violations' : 'Design system warnings'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {violations.map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
            <Badge
              appearance="filled"
              color={v.severity === 'error' ? 'danger' : 'warning'}
              size="small"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              {v.severity}
            </Badge>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem',
              color: T.fgMuted, lineHeight: 1.5,
            }}>
              {v.prop && <strong style={{ color: T.fg }}>{v.prop}: </strong>}
              {v.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main DesignTab component ───────────────────────────────────────────────────

interface DesignTabProps {
  artboardId:   string | null;
  componentId:  string | null;
  componentData: FiberNode | null;
  styles:        Record<string, string> | null;
  workspaceId:   string | null | undefined;
}

export function DesignTab({
  artboardId,
  componentId,
  componentData,
  styles,
  workspaceId,
}: DesignTabProps) {
  const T = useCanvasTheme();
  const {
    patchStyleEdit,
    patchChildrenStyleEdit,
    setComponentStyles,
    indexerStatus,
    selectedComponentHasDirectText,
    selectedComponentHasParagraphChildren,
    setActiveViolations,
  } = useCanvas();
  const { pushEdit } = useHistory();
  const { dlf } = useDlf(workspaceId);

  // Re-run constraint checks whenever selected component or active DLF changes.
  const dlfViolations = useMemo<Violation[]>(() => {
    if (!dlf || !componentData?.name) return [];
    return checkComponentConstraints({
      componentName: componentData.name,
      props: (componentData.props ?? {}) as Record<string, unknown>,
      dlf,
    });
  }, [dlf, componentData?.name, componentData?.props]);

  // Sync violations to canvas store so SelectionOverlay can render inline badges.
  useEffect(() => {
    setActiveViolations(dlfViolations);
    return () => { setActiveViolations([]); };
  }, [dlfViolations, setActiveViolations]);

  if (!artboardId) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
          Select an artboard
        </span>
      </div>
    );
  }

  if (!componentId) {
    return (
      <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.22 }}>
          <rect x="2" y="2" width="24" height="24" rx="4" stroke="white" strokeWidth="1.4" strokeDasharray="4 2"/>
          <circle cx="14" cy="14" r="4" stroke="white" strokeWidth="1.4"/>
        </svg>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5625rem', color: T.dim, letterSpacing: '0.04em', lineHeight: 1.6 }}>
          Click a component in the<br/>artboard to inspect &amp; edit
        </span>
      </div>
    );
  }

  if (!styles) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: T.dim }}>
          Fetching styles…
        </span>
      </div>
    );
  }

  // ── patch: design panel → live artboard + history + optimistic panel refresh ──
  // Three things happen on every edit:
  //   1. patchStyleEdit   → PATCH_ELEMENT_STYLE → SDK → inline style on DOM element
  //   2. setComponentStyles (optimistic) → panel inputs immediately show the new
  //      value without waiting for the next REQUEST_ELEMENT_STYLES round-trip
  //   3. pushEdit → history store → Diff tab tracks it → code export works
  const patch = (prop: string, val: string) => {
    if (!artboardId || !componentId) return;

    // 1. Send to iframe.
    patchStyleEdit(artboardId, componentId, prop, val);

    // 2. Optimistically reflect the change in the design panel immediately.
    if (styles) {
      setComponentStyles({ ...styles, [prop]: val });
    }

    // 3. Push to history so the Diff tab can generate a code patch.
    pushEdit(artboardId, {
      componentId,
      componentName: componentData?.name ?? componentId,
      changes: [{
        key:        prop,
        before:     styles?.[prop] ?? '',
        after:      val,
        changeType: 'modified',
      }],
      timestamp: Date.now(),
    });
  };

  const patchChildren = (selector: string, prop: string, val: string) => {
    if (!artboardId || !componentId) return;
    patchChildrenStyleEdit(artboardId, componentId, selector, prop, val);
  };

  // ── Call-site display ──────────────────────────────────────────────────────
  const callSite      = componentData?.callSite;
  const callSiteLabel = callSite
    ? (() => {
        const parts = callSite.fileName.replace(/\\/g, '/').split('/');
        return `${parts.slice(-2).join('/')}:${callSite.lineNumber}`;
      })()
    : null;

  // ── Indexer dot ────────────────────────────────────────────────────────────
  const indexerDot = {
    offline:  { color: T.dim,     title: 'CLI indexer offline' },
    indexing: { color: '#FFBA7B', title: 'Indexing…'           },
    ready:    { color: '#7DD3A8', title: 'Indexer ready'       },
  }[indexerStatus];

  return (
    <>
      {/* ── Component identity header ───────────────────────────────────── */}
      <div style={{
        padding: '10px 14px 8px', borderBottom: `1px solid ${T.sep}`,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem',
            fontWeight: 600, color: T.fg, letterSpacing: '-0.01em',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {componentData?.name ?? componentId}
          </span>
          <div
            title={indexerDot.title}
            style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: indexerDot.color,
              boxShadow: indexerStatus === 'ready' ? `0 0 5px ${indexerDot.color}` : 'none',
              transition: 'background 0.3s',
            }}
          />
        </div>
        {callSiteLabel && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem',
              color: T.dim, letterSpacing: '0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={`${callSite?.fileName}:${callSite?.lineNumber}`}
          >
            ↳ {callSiteLabel}
          </span>
        )}
      </div>

      {/* ── DLF violation banner ────────────────────────────────────────── */}
      {dlfViolations.length > 0 && <DlfViolationBanner violations={dlfViolations} />}

      {/* ── Section components ──────────────────────────────────────────── */}
      <FrameSection       styles={styles} onPatch={patch} />
      <ConstraintsSection styles={styles} onPatch={patch} />
      <LayoutSection      styles={styles} onPatch={patch} />
      <FillSection        styles={styles} onPatch={patch} />
      <StrokeSection      styles={styles} onPatch={patch} />
      <TypographySection
        styles={styles}
        hasDirectText={selectedComponentHasDirectText}
        hasParagraphChildren={selectedComponentHasParagraphChildren}
        onPatch={patch}
        onPatchChildren={patchChildren}
      />
      <EffectsSection   styles={styles} onPatch={patch} />
      <BoxModelSection  styles={styles} onPatch={patch} />
    </>
  );
}

// Re-export so Inspector can still do a single-line import
export { DlfViolationBanner };
