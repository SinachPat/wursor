'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Toolbar } from './Toolbar';
import { ArtboardNavigator } from '../navigator/ArtboardNavigator';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';
import { useHistory } from '@/store/history';
import { useCanvas } from '@/store/canvas';

interface AppChromeProps {
  workspaceId?: string;
  projectId?: string;
  workspaceName?: string;
  projectName?: string;
}

export function AppChrome({ workspaceId, projectId, workspaceName, projectName }: AppChromeProps) {
  const selectedArtboardId = useCanvas((s) => s.selectedArtboardId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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
  }, [selectedArtboardId]);
  const showBreadcrumb = workspaceId && projectId;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: showBreadcrumb ? '36px 44px 1fr' : '44px 1fr',
        gridTemplateColumns: '220px 1fr 272px',
        height: '100dvh',
        overflow: 'hidden',
        background: '#0C0C10',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Breadcrumb bar — spans all 3 columns, only shown when project context is set */}
      {showBreadcrumb && (
        <div style={{
          gridColumn: '1 / -1',
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

          {/* User avatar in the top-right corner of canvas */}
          <div style={{ transform: 'scale(0.8)', transformOrigin: 'right center' }}>
            <UserButton />
          </div>
        </div>
      )}

      <Toolbar />
      <ArtboardNavigator />
      <Canvas />
      <Inspector />
    </div>
  );
}
