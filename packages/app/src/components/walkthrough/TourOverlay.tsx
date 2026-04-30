'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWalkthrough } from '@/store/walkthrough';
import { TOUR_STEPS } from './tourSteps';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rect { x: number; y: number; width: number; height: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 340;
const SPOTLIGHT_PAD = 8;  // px of padding around the spotlight target
const GAP           = 14; // px gap between spotlight and tooltip card

// ── Component ─────────────────────────────────────────────────────────────────

export function TourOverlay() {
  const { active, stepIndex, next, prev, dismiss } = useWalkthrough();
  const [mounted, setMounted]       = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [pathMismatch, setPathMismatch] = useState(false);

  // Only render portals after client hydration.
  useEffect(() => { setMounted(true); }, []);

  const step = TOUR_STEPS[stepIndex];

  // ── Measure the spotlight target element ─────────────────────────────────
  const measureTarget = useCallback(() => {
    if (!step) { setTargetRect(null); return; }

    const { targetSelector, requiredPathPart } = step;

    // Check we're on the right page for this step.
    const onCorrectPage = !requiredPathPart ||
      window.location.pathname.includes(requiredPathPart);
    setPathMismatch(!onCorrectPage);

    if (!targetSelector || !onCorrectPage) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(targetSelector);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    setTargetRect({ x: r.x, y: r.y, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    if (!active) { setTargetRect(null); return; }
    measureTarget();

    // Re-measure on resize and scroll so the spotlight stays aligned.
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [active, measureTarget]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { e.preventDefault(); dismiss(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(TOUR_STEPS.length); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, prev, dismiss]);

  // ── Compute tooltip position ──────────────────────────────────────────────
  const tooltipStyle = computeTooltipPosition(targetRect, step?.placement ?? 'auto');

  if (!mounted || !active || !step) return null;

  const isFirstStep = stepIndex === 0;
  const isLastStep  = stepIndex === TOUR_STEPS.length - 1;
  const progress    = ((stepIndex + 1) / TOUR_STEPS.length) * 100;

  // Spotlight rect with padding applied.
  const spotlight = targetRect ? {
    x:      targetRect.x      - SPOTLIGHT_PAD,
    y:      targetRect.y      - SPOTLIGHT_PAD,
    width:  targetRect.width  + SPOTLIGHT_PAD * 2,
    height: targetRect.height + SPOTLIGHT_PAD * 2,
  } : null;

  return createPortal(
    <>
      {/* ── Dim backdrop (click outside = dismiss) ─────────────────────── */}
      <div
        aria-hidden="true"
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 9990,
          // When there's a spotlight, the backdrop darkness is created by the
          // spotlight element's box-shadow, so we only need a backdrop when
          // the tour card is centered (no spotlight).
          background: spotlight ? 'transparent' : 'rgba(0,0,0,0.55)',
        }}
      />

      {/* ── Spotlight ring (box-shadow creates dark outside the rect) ────── */}
      {spotlight && (
        <div
          aria-hidden="true"
          style={{
            position:  'fixed',
            left:      spotlight.x,
            top:       spotlight.y,
            width:     spotlight.width,
            height:    spotlight.height,
            borderRadius: 8,
            // 9999px box-shadow fills the entire viewport outside this rect.
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border:    '2px solid rgba(51,133,255,0.7)',
            zIndex:    9991,
            pointerEvents: 'none',
            transition: 'all 0.12s ease',
          }}
        />
      )}

      {/* ── Tooltip card ──────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.id}
        style={{
          position: 'fixed',
          zIndex:   9999,
          width:    TOOLTIP_WIDTH,
          ...tooltipStyle,
          background:   'var(--card-bg)',
          border:       '1px solid var(--card-border)',
          borderRadius: 16,
          padding:      '22px 24px 20px',
          boxShadow:    '0 12px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
          fontFamily:   "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
        // Prevent click from propagating to the backdrop (which would dismiss)
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Progress bar ─────────────────────────────────────────────── */}
        <div style={{
          height: 2, borderRadius: 2,
          background: 'var(--card-border)',
          marginBottom: 18,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: '#3385FF',
            width: `${progress}%`,
            transition: 'width 0.25s ease',
          }} />
        </div>

        {/* ── Step counter ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#3385FF',
          }}>
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={dismiss}
            aria-label="Close tour"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--card-muted)', padding: '2px 4px',
              display: 'flex', alignItems: 'center', borderRadius: 4,
              lineHeight: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Title ────────────────────────────────────────────────────── */}
        <h3 style={{
          fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.025em',
          color: 'var(--card-text)', margin: '0 0 10px',
        }}>
          {step.title}
        </h3>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{
          fontSize: '0.8125rem', color: 'var(--card-muted)',
          lineHeight: 1.65, margin: '0 0 14px',
        }}>
          {step.body}
        </div>

        {/* ── Path mismatch hint ───────────────────────────────────────── */}
        {pathMismatch && step.requiredPathPart && (
          <div style={{
            padding: '8px 10px', borderRadius: 7, marginBottom: 14,
            background: 'rgba(51,133,255,0.08)',
            border: '1px solid rgba(51,133,255,0.2)',
            fontSize: '0.75rem', color: 'var(--card-muted)', lineHeight: 1.5,
          }}>
            💡 Navigate to the{' '}
            <strong style={{ color: 'var(--card-text)' }}>
              {step.requiredPathPart.includes('/project/') ? 'canvas' : 'workspace dashboard'}
            </strong>{' '}
            to follow this step interactively.
          </div>
        )}

        {/* ── CLI code block ───────────────────────────────────────────── */}
        {step.codeBlock && (
          <pre style={{
            background: 'var(--card-subtle)',
            border: '1px solid var(--card-border)',
            borderRadius: 8, padding: '10px 12px',
            fontSize: '0.6875rem', lineHeight: 1.7,
            fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
            color: 'var(--card-text)',
            margin: '0 0 14px',
            overflow: 'auto', whiteSpace: 'pre',
          }}>
            {step.codeBlock}
          </pre>
        )}

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          {/* Back button */}
          {!isFirstStep && (
            <button
              onClick={prev}
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--card-border)',
                background: 'var(--btn-idle-bg)',
                color: 'var(--btn-idle-fg)',
                fontSize: '0.8125rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          )}

          {/* Next / Finish button */}
          <button
            onClick={() => next(TOUR_STEPS.length)}
            style={{
              flex: 1,
              padding: '9px 16px', borderRadius: 8,
              border: 'none',
              background: isLastStep ? '#10B981' : '#3385FF',
              color: '#FFFFFF',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              transition: 'background 0.12s',
            }}
          >
            {isFirstStep
              ? "Let's go →"
              : isLastStep
                ? 'Start building ✓'
                : 'Next →'}
          </button>

          {/* Skip tour */}
          {!isLastStep && (
            <button
              onClick={dismiss}
              style={{
                padding: '8px 10px', background: 'none', border: 'none',
                color: 'var(--card-muted)', fontSize: '0.75rem',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* ── Spotlight arrow (pointer from tooltip toward the target) ────── */}
      {spotlight && <SpotlightArrow spotlight={spotlight} tooltipStyle={tooltipStyle} />}
    </>,
    document.body,
  );
}

// ── Spotlight arrow ───────────────────────────────────────────────────────────
// A small triangle that connects the tooltip card to the spotlit element.

function SpotlightArrow({
  spotlight,
  tooltipStyle,
}: {
  spotlight: Rect;
  tooltipStyle: React.CSSProperties;
}) {
  // Determine rough position of tooltip relative to spotlight centre to pick
  // the correct arrow direction.
  const slCX = spotlight.x + spotlight.width  / 2;
  const slCY = spotlight.y + spotlight.height / 2;

  // Resolve tooltip top-left from the style object (may use numbers or strings)
  const ttTop  = typeof tooltipStyle.top    === 'number' ? tooltipStyle.top    : 0;
  const ttLeft = typeof tooltipStyle.left   === 'number' ? tooltipStyle.left   : 0;
  const ttCX   = ttLeft + TOOLTIP_WIDTH / 2;

  // Arrow placed on the edge of the spotlight nearest the tooltip.
  const above = ttTop < slCY;  // tooltip is above spotlight

  const arrowX = Math.min(
    Math.max(ttCX, spotlight.x + 12),
    spotlight.x + spotlight.width - 12,
  );

  if (above) {
    // Arrow at bottom of tooltip (pointing down toward spotlight)
    return (
      <div aria-hidden="true" style={{
        position: 'fixed',
        left:    arrowX - 7,
        top:     Number(ttTop) + /* tooltip est. height */ 260,
        width: 14, height: 8,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 14, height: 14,
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          transform: 'rotate(45deg) translateY(-7px)',
        }} />
      </div>
    );
  }

  // Arrow at top of tooltip (pointing up toward spotlight — tooltip is below)
  const arrowTop = typeof tooltipStyle.top === 'number' ? tooltipStyle.top - 8 : 0;
  return (
    <div aria-hidden="true" style={{
      position: 'fixed',
      left:    arrowX - 7,
      top:     arrowTop,
      width: 14, height: 8,
      zIndex: 9999,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <div style={{
        width: 14, height: 14,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        transform: 'rotate(45deg) translateY(1px)',
      }} />
    </div>
  );
}

// ── Tooltip positioning ───────────────────────────────────────────────────────

function computeTooltipPosition(
  rect: Rect | null,
  placement: TourStep['placement'],
): React.CSSProperties {
  const vw  = typeof window !== 'undefined' ? window.innerWidth  : 1280;
  const vh  = typeof window !== 'undefined' ? window.innerHeight : 800;
  const pad = 16;

  if (!rect) {
    // Centered card
    return {
      left: Math.max(pad, (vw - TOOLTIP_WIDTH) / 2),
      top:  Math.max(pad, vh / 2 - 160),
    };
  }

  const sl = {
    x:      rect.x      - SPOTLIGHT_PAD,
    y:      rect.y      - SPOTLIGHT_PAD,
    width:  rect.width  + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
  };

  // Clamp a horizontal position to stay within viewport.
  const clampLeft = (l: number) =>
    Math.max(pad, Math.min(vw - TOOLTIP_WIDTH - pad, l));

  const centredLeft = clampLeft(sl.x + sl.width / 2 - TOOLTIP_WIDTH / 2);

  const spaceBelow = vh - (sl.y + sl.height);
  const spaceAbove = sl.y;
  const spaceRight = vw - (sl.x + sl.width);
  const spaceLeft  = sl.x;

  const effectivePlacement = placement === 'auto' || !placement
    ? spaceBelow >= 240 ? 'bottom'
    : spaceAbove >= 240 ? 'top'
    : spaceRight >= TOOLTIP_WIDTH + GAP ? 'right'
    : spaceLeft  >= TOOLTIP_WIDTH + GAP ? 'left'
    : 'bottom'
    : placement;

  switch (effectivePlacement) {
    case 'bottom':
      return { left: centredLeft, top: sl.y + sl.height + GAP };
    case 'top':
      return { left: centredLeft, top: Math.max(pad, sl.y - GAP - 280) };
    case 'right':
      return { left: sl.x + sl.width + GAP, top: Math.max(pad, sl.y) };
    case 'left':
      return { left: Math.max(pad, sl.x - TOOLTIP_WIDTH - GAP), top: Math.max(pad, sl.y) };
    default:
      return { left: centredLeft, top: sl.y + sl.height + GAP };
  }
}

// Imported only for the type — avoids a circular import.
import type { TourStep } from './tourSteps';
