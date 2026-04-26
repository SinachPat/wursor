import { create } from 'zustand';

export type Tool = 'select' | 'pan' | 'artboard' | 'zone';

interface CanvasStore {
  activeTool: Tool;
  selectedArtboardId: string | null;
  /** Workspace/project context set by AppChrome on mount. */
  workspaceId: string | null;
  projectId: string | null;
  setActiveTool: (tool: Tool) => void;
  selectArtboard: (id: string | null) => void;
  setContext: (workspaceId: string, projectId: string) => void;
}

export const useCanvas = create<CanvasStore>((set) => ({
  activeTool: 'select',
  selectedArtboardId: null,
  workspaceId: null,
  projectId: null,
  setActiveTool: (tool) => set({ activeTool: tool }),
  selectArtboard: (id) => set({ selectedArtboardId: id }),
  setContext: (workspaceId, projectId) => set({ workspaceId, projectId }),
}));
