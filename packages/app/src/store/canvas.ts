import { create } from 'zustand';
import type { FiberNode } from '@originmain/renderer';

export type Tool = 'select' | 'pan' | 'artboard' | 'zone';

interface CanvasStore {
  // ── Tool state ──────────────────────────────────────────────────────────────
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  // ── Artboard selection ──────────────────────────────────────────────────────
  selectedArtboardId: string | null;
  selectArtboard: (id: string | null) => void;

  // ── Workspace / project context (set by AppChrome on mount) ───��────────────
  workspaceId: string | null;
  projectId: string | null;
  setContext: (workspaceId: string, projectId: string) => void;

  // ── Live artboard tracking ──────────────────────────────────────────────────
  /** IDs of artboards that have an active LiveArtboard iframe connection */
  liveArtboardIds: Set<string>;
  setArtboardLive: (id: string, live: boolean) => void;

  // ── Component selection (from SelectionOverlay / fiber tree) ───────────────
  selectedComponentId: string | null;
  selectedComponentData: FiberNode | null;
  selectComponent: (id: string | null, data: FiberNode | null) => void;
}

export const useCanvas = create<CanvasStore>((set) => ({
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  selectedArtboardId: null,
  selectArtboard: (id) =>
    set({ selectedArtboardId: id, selectedComponentId: null, selectedComponentData: null }),

  workspaceId: null,
  projectId: null,
  setContext: (workspaceId, projectId) => set({ workspaceId, projectId }),

  liveArtboardIds: new Set<string>(),
  setArtboardLive: (id, live) =>
    set((state) => {
      const next = new Set(state.liveArtboardIds);
      if (live) next.add(id); else next.delete(id);
      return { liveArtboardIds: next };
    }),

  selectedComponentId: null,
  selectedComponentData: null,
  selectComponent: (id, data) => set({ selectedComponentId: id, selectedComponentData: data }),
}));
