import { create } from 'zustand';

export type Tool = 'select' | 'pan' | 'artboard' | 'zone';

interface CanvasStore {
  activeTool: Tool;
  selectedArtboardId: string | null;
  setActiveTool: (tool: Tool) => void;
  selectArtboard: (id: string | null) => void;
}

export const useCanvas = create<CanvasStore>((set) => ({
  activeTool: 'select',
  selectedArtboardId: 'dashboard-card',
  setActiveTool: (tool) => set({ activeTool: tool }),
  selectArtboard: (id) => set({ selectedArtboardId: id }),
}));
