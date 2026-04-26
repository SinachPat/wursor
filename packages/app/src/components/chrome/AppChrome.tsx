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

  // Push workspace/project IDs into the store so Canvas and Navigator can read them.
  useEffect(() => {
    if (workspaceId && projectId) setContext(workspaceId, projectId);
  }, [workspaceId, projectId, setContext]);

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
        background: '#0C0C10',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Breadcrumb bar ─────────────────────────────────── */}
      {showBreadcrumb && (
        <div style={{
          height: 36,
          flexShrink: 0,
          background: '#0A0A0E',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 0,
        }}>
          {/* Logo */}
          <Link href="/workspaces" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', marginRight: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.6)' }}>
              Origin<span style={{ color: '#3385FF' }}>main</span>
            </span>
          </Link>

          <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px', fontSize: '0.75rem' }}>/</span>

          <Link href="/workspaces" style={{ textDecoration: 'none', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            Workspaces
          </Link>

          <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px', fontSize: '0.75rem' }}>/</span>

          <Link href={`/workspace/${workspaceId}`} style={{ textDecoration: 'none', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            {workspaceName ?? 'Workspace'}
          </Link>

          <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px', fontSize: '0.75rem' }}>/</span>

          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            {projectName ?? 'Canvas'}
          </span>

          <div style={{ flex: 1 }} />

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
