import { create } from 'zustand';

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number, originX?: number, originY?: number) => void;
  reset: () => void;
}

export const useViewport = create<ViewportState>((set, get) => ({
  panX: 0,
  panY: 0,
  zoom: 1,

  setPan: (x, y) => set({ panX: x, panY: y }),

  setZoom: (zoom, originX = 0, originY = 0) => {
    const prev = get();
    const clampedZoom = Math.min(Math.max(zoom, 0.1), 8);
    const scale = clampedZoom / prev.zoom;
    set({
      zoom: clampedZoom,
      panX: originX - (originX - prev.panX) * scale,
      panY: originY - (originY - prev.panY) * scale,
    });
  },

  reset: () => set({ panX: 0, panY: 0, zoom: 1 }),
}));
