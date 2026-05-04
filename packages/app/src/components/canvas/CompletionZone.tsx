'use client';

// ── CompletionZone ────────────────────────────────────────────────────────────
// Floating prompt overlay shown after a user draws an AI completion zone on the
// canvas. Handles the full AI → result → IntentDiff flow.
//
// Spec Layer 6: AI calls go through the tRPC server-side router (ai.fillCompletionZone)
// so they are authenticated and workspace-attributed before reaching the AI layer.
// Spec Layer 6.4: completion zone fills are recorded as DRAFT IntentDiffs with
// changeType 'insertion' so the diff engine can classify them correctly.

import { useState, useCallback } from 'react';
import { Button, Textarea } from '@fluentui/react-components';
import { trpc } from '@/lib/trpc';
import { useCanvas } from '@/store/canvas';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZoneBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CompletionZoneProps {
  bounds: ZoneBounds;
  artboardId: string | null;
  /** Canvas pan/zoom — used to convert artboard coords to screen position */
  panX: number;
  panY: number;
  zoom: number;
  onClose: () => void;
  /**
   * Fires when the AI returns a result — Canvas uses this to render a
   * preview overlay at the zone bounds in artboard coordinate space.
   * (spec Layer 6: "A preview overlay showing the AI-generated completion")
   */
  onResult?: (result: string, bounds: ZoneBounds) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompletionZone({
  bounds, artboardId, panX, panY, zoom, onClose, onResult,
}: CompletionZoneProps) {
  const [prompt, setPrompt]         = useState('');
  const [status, setStatus]         = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult]         = useState('');
  const [diffStatus, setDiffStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const workspaceId          = useCanvas(s => s.workspaceId);
  const activeAgentSessionId = useCanvas(s => s.activeAgentSessionId);
  const fillZone             = trpc.ai.fillCompletionZone.useMutation();

  // Convert artboard → screen coordinates (relative to canvas container).
  // Position the popover 10px below the drawn zone.
  const screenX = bounds.x * zoom + panX;
  const screenY = (bounds.y + bounds.h) * zoom + panY + 10;

  // ── Submit: call completion-zone via tRPC (spec Layer 6) ─────────────────

  const submit = useCallback(async () => {
    if (!prompt.trim() || !artboardId || !workspaceId) return;
    setStatus('loading');
    setDiffStatus('idle');
    try {
      const data = await fillZone.mutateAsync({
        artboardId,
        workspaceId,
        intent: prompt.trim(),
        bounds: { x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h },
      });
      setResult(data.completion);
      setStatus('done');
      // Notify canvas to render the preview overlay at the zone bounds
      onResult?.(data.completion, bounds);
    } catch (e) {
      console.error('[CompletionZone]', e);
      setStatus('error');
    }
  }, [prompt, artboardId, workspaceId, bounds, fillZone, onResult]);

  // ── Accept: save as DRAFT IntentDiff (spec Layer 6.4) ────────────────────
  // Uses ComponentChange with changeType 'insertion' so validateChange() and
  // the diff overlay can classify this as a new element being added.

  const acceptCompletion = useCallback(async () => {
    if (!artboardId || !result || diffStatus !== 'idle') return;
    setDiffStatus('saving');
    try {
      const zoneContext = { x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h };
      // Synthetic componentId derived from zone position — ensures multiple fills
      // on the same artboard produce distinct diff records.
      const componentChange = {
        componentId:  `zone-${bounds.x}-${bounds.y}-${bounds.w}x${bounds.h}`,
        displayName:  'AICompletionZone',
        changeType:   'insertion' as const,
        before:       {},
        after:        { description: result, zoneContext },
        humanSummary: result,
      };
      const res = await fetch('/api/diffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artboard_id:       artboardId,
          aggregate_summary: result,
          changes:           { changes: [componentChange] },
          status:            'draft',
          // Links diff to active agent session (if any) for Agent Bridge sync.
          // Empty string when no session is running — matches DB DEFAULT ''.
          session_id:        activeAgentSessionId ?? '',
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setDiffStatus('saved');
    } catch (e) {
      console.error('[CompletionZone] accept diff failed', e);
      setDiffStatus('error');
    }
  }, [artboardId, result, diffStatus, bounds, activeAgentSessionId]);

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Render ─────────────────────────────────────────────────────────────────
  // Positioned in screen space (outside the canvas transform layer) so the
  // input controls render at normal scale regardless of canvas zoom.
  // Spec Layer 6.4: uses Fluent 2 Textarea + Button per spec requirement.

  return (
    <div
      style={{
        position:     'absolute',
        left:         Math.max(8, screenX),
        top:          Math.max(8, screenY),
        zIndex:       50,
        width:        300,
        background:   '#1A1A20',
        border:       '1px solid rgba(51,133,255,0.35)',
        borderRadius: 10,
        boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
        padding:      '12px 14px',
        fontFamily:   "'Inter', -apple-system, sans-serif",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'rgba(51,133,255,0.9)', letterSpacing: '-0.01em' }}>
          ⚡ Completion zone · {bounds.w}×{bounds.h}
        </span>
        <Button
          appearance="subtle"
          size="small"
          onClick={onClose}
          style={{ minWidth: 0, padding: '0 4px', color: 'rgba(255,255,255,0.35)' }}
        >
          ✕
        </Button>
      </div>

      {status === 'done' ? (
        <>
          {/* AI result preview */}
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 10 }}>
            {result}
          </div>

          {/* Accept (spec: "Accept" commits to IntentDiff) / Reject (spec) */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              appearance="primary"
              size="small"
              disabled={diffStatus !== 'idle'}
              onClick={() => void acceptCompletion()}
              title="Save this completion as a draft intent diff"
              style={{ flex: 1 }}
            >
              {diffStatus === 'saving' ? 'Saving…' : diffStatus === 'saved' ? '✓ Saved' : diffStatus === 'error' ? 'Save failed' : '✓ Accept'}
            </Button>
            <Button
              appearance="subtle"
              size="small"
              onClick={onClose}
            >
              Reject
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Fluent 2 Textarea for intent input (spec Layer 6.4) */}
          <Textarea
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={prompt}
            onChange={(_, d) => setPrompt(d.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
              if (e.key === 'Escape') onClose();
              e.stopPropagation();
            }}
            placeholder="Describe what to generate in this zone…"
            rows={3}
            resize="none"
            style={{ width: '100%', marginBottom: 8 }}
          />
          {status === 'error' && (
            <p style={{ fontSize: '0.625rem', color: 'var(--colorPaletteRedForeground1)', margin: '0 0 6px' }}>
              Request failed — try again
            </p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              appearance="primary"
              size="small"
              disabled={status === 'loading' || !prompt.trim() || !artboardId}
              onClick={() => void submit()}
              style={{ flex: 1 }}
            >
              {status === 'loading' ? 'Generating…' : 'Generate ⌘↵'}
            </Button>
            <Button
              appearance="subtle"
              size="small"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
