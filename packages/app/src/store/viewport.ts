import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number, originX?: number, originY?: number) => void;
  reset: () => void;
}

export const useViewport = create<ViewportState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'originmain:viewport',
      storage: createJSONStorage(() => localStorage),
      // Only persist the numeric state, not the action functions
      partialize: (state) => ({ panX: state.panX, panY: state.panY, zoom: state.zoom }),
    },
  ),
);
