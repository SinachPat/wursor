'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Toolbar } from './Toolbar';
import { ArtboardNavigator } from '../navigator/ArtboardNavigator';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';
import { useHistory } from '@/store/history';
import { useCanvas, type Tool } from '@/store/canvas';
import { useViewport } from '@/store/viewport';
import { useTheme } from '@/store/theme';
import { useCanvasTheme } from '@/store/canvasTheme';
import { useWalkthrough } from '@/store/walkthrough';
import { useIndexer } from '@/hooks/useIndexer';

interface AppChromeProps {
  workspaceId?: string;
  projectId?: string;
  workspaceName?: string;
  projectName?: string;
}

export function AppChrome({ workspaceId, projectId, workspaceName, projectName }: AppChromeProps) {
  const selectedArtboardId = useCanvas((s) => s.selectedArtboardId);
  const setContext         = useCanvas((s) => s.setContext);
  const setActiveTool      = useCanvas((s) => s.setActiveTool);
  const { mode: themeMode, toggle: toggleTheme } = useTheme();
  const CT = useCanvasTheme();
  const startTour = useWalkthrough((s) => s.start);

  // Connect to the CLI AST indexer (reads window.__OM_INDEX_URL__, no-op if absent)
  useIndexer();

  // Push workspace/project IDs into the store so Canvas and Navigator can read them.
  useEffect(() => {
    if (workspaceId && projectId) setContext(workspaceId, projectId);
  }, [workspaceId, projectId, setContext]);

  // Per-workspace viewport persistence: restore saved pan/zoom on mount,
  // save current state back to localStorage on unmount.
  useEffect(() => {
    if (!workspaceId) return;
    const key = `originmain:viewport:${workspaceId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as { panX: number; panY: number; zoom: number };
        useViewport.getState().restore(saved);
      }
    } catch { /* ignore parse errors */ }

    return () => {
      const { panX, panY, zoom } = useViewport.getState();
      localStorage.setItem(key, JSON.stringify({ panX, panY, zoom }));
    };
  }, [workspaceId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      if ((e.target as HTMLElement).matches('input, textarea, [contenteditable]')) return;

      // Tool shortcuts (no modifier)
      if (!e.metaKey && !e.ctrlKey) {
        const toolKeys: Record<string, Tool> = { v: 'select', h: 'pan', a: 'artboard', z: 'zone' };
        const mapped = toolKeys[e.key.toLowerCase()];
        if (mapped !== undefined) {
          e.preventDefault();
          setActiveTool(mapped);
          return;
        }
        // Escape cancels active tool back to select
        if (e.key === 'Escape') {
          setActiveTool('select');
          return;
        }
      }

      // Undo/Redo require a selected artboard
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!selectedArtboardId) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistory.getState().undo(selectedArtboardId);
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        useHistory.getState().redo(selectedArtboardId);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedArtboardId, setActiveTool]);

  const showBreadcrumb = Boolean(workspaceId && projectId);

  return (
    // Outer flex-column: breadcrumb on top (fixed height), inner grid fills the rest.
    // Breadcrumb lives OUTSIDE the grid so the Toolbar/panel gridRow placements
    // never shift regardless of whether the breadcrumb is visible.
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: CT.canvasBg,
        transition: 'background 0.2s',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Breadcrumb bar ─────────────────────────────────── */}
      {showBreadcrumb && (
        <div style={{
          height: 36,
          flexShrink: 0,
          background: CT.bgDeep,
          borderBottom: `1px solid ${CT.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 0,
          zIndex: 10,
          position: 'relative',
          transition: 'background 0.2s, border-color 0.2s',
        }}>
          {/* Logo */}
          <Link href="/workspaces" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', marginRight: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '-0.01em', color: CT.itemHov }}>
              Origin<span style={{ color: CT.accent }}>main</span>
            </span>
          </Link>

          <span style={{ color: CT.fgDim, margin: '0 6px', fontSize: '0.75rem' }}>/</span>

          <Link href="/workspaces" style={{ textDecoration: 'none', fontSize: '0.75rem', color: CT.item, fontWeight: 500 }}>
            Workspaces
          </Link>

          <span style={{ color: CT.fgDim, margin: '0 6px', fontSize: '0.75rem' }}>/</span>

          <Link href={`/workspace/${workspaceId}`} style={{ textDecoration: 'none', fontSize: '0.75rem', color: CT.item, fontWeight: 500 }}>
            {workspaceName ?? 'Workspace'}
          </Link>

          <span style={{ color: CT.fgDim, margin: '0 6px', fontSize: '0.75rem' }}>/</span>

          <span style={{ fontSize: '0.75rem', color: CT.fg, fontWeight: 600 }}>
            {projectName ?? 'Canvas'}
          </span>

          {/* Project settings link */}
          {workspaceId && projectId && (
            <Link
              href={`/workspace/${workspaceId}/project/${projectId}/settings`}
              title="Project settings"
              style={{
                marginLeft: 8,
                display: 'flex', alignItems: 'center',
                textDecoration: 'none',
                color: CT.dim,
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = CT.itemHov)}
              onMouseLeave={e => (e.currentTarget.style.color = CT.dim)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 7.5A1.5 1.5 0 1 0 6 4.5 1.5 1.5 0 0 0 6 7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <path d="M9.2 4.6l.4-1.4-1.2-.7-.9 1.1a3.5 3.5 0 0 0-3 0L3.6 2.5 2.4 3.2l.4 1.4A3.4 3.4 0 0 0 2 6c0 .5.1.9.3 1.4L1.9 8.7 3 9.5l1.1-1a3.5 3.5 0 0 0 3.8 0l1.1 1 1.2-.8-.4-1.3c.2-.5.3-1 .3-1.4a3.4 3.4 0 0 0-.9-2.4Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              </svg>
            </Link>
          )}

          <div style={{ flex: 1 }} />

          {/* Tour trigger */}
          <button
            onClick={startTour}
            title="Start product tour"
            aria-label="Start product tour"
            style={{
              background: 'none',
              border: `1px solid ${CT.border}`,
              cursor: 'pointer',
              color: CT.fgMuted,
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6875rem', fontWeight: 600, marginRight: 6,
              transition: 'color 0.12s, background 0.12s, border-color 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = CT.accent;
              e.currentTarget.style.borderColor = `${CT.accent}66`;
              e.currentTarget.style.background = `${CT.accent}14`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = CT.fgMuted;
              e.currentTarget.style.borderColor = CT.border;
              e.currentTarget.style.background = 'none';
            }}
          >
            ?
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: CT.fgMuted, padding: '4px 6px',
              display: 'flex', alignItems: 'center',
              transition: 'color 0.12s',
              fontSize: 13,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = CT.itemHov)}
            onMouseLeave={e => (e.currentTarget.style.color = CT.fgMuted)}
          >
            {themeMode === 'dark' ? (
              /* Sun icon */
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M12 8.5A5.5 5.5 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          <div style={{ transform: 'scale(0.8)', transformOrigin: 'right center' }}>
            <UserButton />
          </div>
        </div>
      )}

      {/* ── Inner grid: Toolbar (row 1) + panels (row 2) ─── */}
      {/* Rows are always 44px + 1fr — breadcrumb never enters this grid. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: '44px 1fr',
          gridTemplateColumns: '220px 1fr 272px',
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        <ArtboardNavigator />
        <Canvas />
        <Inspector />
      </div>
    </div>
  );
}
