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

  // ── Fiber tree cache (per artboard, updated on each FIBER_TREE_UPDATE) ─────
  artboardFiberRoots: Record<string, FiberNode>;
  setFiberRoot: (artboardId: string, root: FiberNode) => void;

  // ── Component selection (from SelectionOverlay / fiber tree) ───────────────
  selectedComponentId: string | null;
  selectedComponentData: FiberNode | null;
  selectComponent: (id: string | null, data: FiberNode | null) => void;

  // ── Component computed styles (populated by ELEMENT_STYLES response) ────────
  /** Computed CSS property map for the currently-selected component DOM element. */
  selectedComponentStyles: Record<string, string> | null;
  setComponentStyles: (styles: Record<string, string> | null) => void;

  // ── Style edit queue ────────────────────────────────────────────────────────
  // The Design tab and resize handles push patches here; each owning
  // LiveArtboard drains entries addressed to it, then removes them.
  // A queue (not a single slot) is required because resize sends width + height
  // in the same synchronous event — a single slot would silently drop the first.
  styleEditQueue: Array<{ artboardId: string; nodeId: string; property: string; value: string }>;
  patchStyleEdit: (artboardId: string, nodeId: string, property: string, value: string) => void;
  clearStyleEdits: (artboardId: string) => void;

  // ── Element removal mailbox ─────────────────────────────────────────────────
  removeElementEvent: { artboardId: string; nodeId: string } | null;
  dispatchRemoveElement: (artboardId: string, nodeId: string) => void;
  clearRemoveElement: () => void;
}

export const useCanvas = create<CanvasStore>((set) => ({
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  selectedArtboardId: null,
  selectArtboard: (id) =>
    set({ selectedArtboardId: id, selectedComponentId: null, selectedComponentData: null, selectedComponentStyles: null }),

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

  artboardFiberRoots: {},
  setFiberRoot: (artboardId, root) =>
    set((state) => ({ artboardFiberRoots: { ...state.artboardFiberRoots, [artboardId]: root } })),

  selectedComponentId: null,
  selectedComponentData: null,
  selectComponent: (id, data) =>
    set({ selectedComponentId: id, selectedComponentData: data, selectedComponentStyles: null }),

  selectedComponentStyles: null,
  setComponentStyles: (styles) => set({ selectedComponentStyles: styles }),

  styleEditQueue: [],
  patchStyleEdit: (artboardId, nodeId, property, value) =>
    set((s) => ({ styleEditQueue: [...s.styleEditQueue, { artboardId, nodeId, property, value }] })),
  clearStyleEdits: (artboardId) =>
    set((s) => ({ styleEditQueue: s.styleEditQueue.filter((e) => e.artboardId !== artboardId) })),

  removeElementEvent: null,
  dispatchRemoveElement: (artboardId, nodeId) =>
    set({ removeElementEvent: { artboardId, nodeId } }),
  clearRemoveElement: () => set({ removeElementEvent: null }),
}));
