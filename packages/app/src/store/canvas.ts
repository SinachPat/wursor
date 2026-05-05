import { create } from 'zustand';
import type { FiberNode } from '@originmain/renderer';
import type { Violation } from '@originmain/design-language';
import type { DesignToken } from './canvas.types';

/** Framework and CSS strategy detected by the CLI AST indexer at startup. */
export interface ProjectMeta {
  framework: 'next' | 'vite' | 'remix' | 'generic';
  tailwind: boolean;
  cssModules: boolean;
  styledComponents: boolean;
}

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

  /** True if the selected element has a direct TEXT_NODE child (gates Typography section). */
  selectedComponentHasDirectText: boolean;
  /** True if the selected element has at least one direct <p> child (gates paragraph spacing). */
  selectedComponentHasParagraphChildren: boolean;
  /** Set both structural text flags together — always called alongside setComponentStyles. */
  setComponentTextFlags: (hasDirectText: boolean, hasParagraphChildren: boolean) => void;

  // ── Style edit queue ────────────────────────────────────────────────────────
  // The Design tab and resize handles push patches here; each owning
  // LiveArtboard drains entries addressed to it, then removes them.
  // A queue (not a single slot) is required because resize sends width + height
  // in the same synchronous event — a single slot would silently drop the first.
  styleEditQueue: Array<{ artboardId: string; nodeId: string; property: string; value: string }>;
  patchStyleEdit: (artboardId: string, nodeId: string, property: string, value: string) => void;
  clearStyleEdits: (artboardId: string) => void;

  // ── Children style edit queue (PATCH_CHILDREN_STYLE — paragraph spacing etc.) ──
  childrenStyleEditQueue: Array<{ artboardId: string; parentNodeId: string; selector: string; property: string; value: string }>;
  patchChildrenStyleEdit: (artboardId: string, parentNodeId: string, selector: string, property: string, value: string) => void;
  clearChildrenStyleEdits: (artboardId: string) => void;

  // ── Element removal mailbox ─────────────────────────────────────────────────
  removeElementEvent: { artboardId: string; nodeId: string } | null;
  dispatchRemoveElement: (artboardId: string, nodeId: string) => void;
  clearRemoveElement: () => void;

  // ── Selected element mode (Phase 2) ─────────────────────────────────────────
  /** 'component' = capitalized React component; 'element' = lowercase DOM tag; null = nothing selected */
  selectedElementMode: 'component' | 'element' | null;
  setSelectedElementMode: (mode: 'component' | 'element' | null) => void;

  // ── CLI AST indexer integration (Phase 3) ────────────────────────────────────
  /** Status of the CLI AST indexer; drives Props tab and Code tab behavior */
  indexerStatus: 'offline' | 'indexing' | 'ready';
  setIndexerStatus: (status: 'offline' | 'indexing' | 'ready') => void;

  /** Project metadata fetched from GET /health on CLI connection */
  projectMeta: ProjectMeta | null;
  setProjectMeta: (meta: ProjectMeta | null) => void;

  // ── DLF violations (spec Layer 5.2) ──────────────────────────────────────────
  // Written by Inspector's DesignTab when it evaluates the selected component
  // against the active DLF; read by SelectionOverlay to render inline badges.
  activeViolations: Violation[];
  setActiveViolations: (violations: Violation[]) => void;

  // ── Active agent session (spec Layer 6 — diff attribution) ──────────────────
  activeAgentSessionId: string | null;
  setActiveAgentSessionId: (id: string | null) => void;

  // ── Phase 0: Discovered routes (aggregated from ROUTES_DISCOVERED messages) ───
  /** Map of artboardId → routes discovered by that artboard's live app. */
  discoveredRoutes: Record<string, Array<{ path: string; label: string }>>;
  setDiscoveredRoutes: (artboardId: string, routes: Array<{ path: string; label: string }>) => void;

  // ── Selected artboard dimensions (Phase 0 device preset picker) ──────────────
  // Set by Artboard.tsx whenever the selected artboard renders, so that Toolbar
  // can read current width/height without needing workspaceId/projectId.
  selectedArtboardW: number | null;
  selectedArtboardH: number | null;
  setSelectedArtboardSize: (w: number, h: number) => void;
  /** One-shot resize event: Artboard.tsx watches this and fires a PATCH, then clears. */
  artboardResizeEvent: { artboardId: string; width: number; height: number } | null;
  dispatchArtboardResize: (artboardId: string, width: number, height: number) => void;
  clearArtboardResize: () => void;

  // ── Phase 4 — Intent diff tracking ───────────────────────────────────────────
  /** Map of intentId → status: 'EXPORTED' | 'IMPLEMENTED' | 'BLOCKED' */
  intentStatus: Record<string, string>;
  setIntentStatus: (intentId: string, status: string) => void;

  /** Undo queue for DOM style previews (Cmd+Z support). */
  styleUndoStack: Array<{ artboardId: string; nodeId: string; property: string; previousValue: string }>;
  pushStyleUndo: (artboardId: string, nodeId: string, property: string, previousValue: string) => void;
  undoStyleEdit: () => { artboardId: string; nodeId: string; property: string; previousValue: string } | null;

  // ── Phase 6 — Design Language (DesignToken[] from parser/resolver) ────────────
  /** Loaded design tokens after user uploads a token file — null until uploaded. */
  designLanguageTokens: DesignToken[] | null;
  setDesignLanguageTokens: (tokens: DesignToken[] | null) => void;

  /** Root font size in px per artboard — read from rootFontSizePx in READY message.
   *  Used by the token resolver to normalise rem → px. */
  artboardRootFontSize: Record<string, number>;
  setArtboardRootFontSize: (artboardId: string, px: number) => void;

  // ── Phase 0 — Artboard thumbnails ────────────────────────────────────────────
  /** Base64 JPEG data-URL snapshots per artboard — captured when transitioning Active→Far.
   *  Displayed as a static image placeholder while the iframe is unmounted (far state). */
  artboardThumbnails: Record<string, string | null>;
  setArtboardThumbnail: (artboardId: string, dataUrl: string | null) => void;

  // ── Phase 4 — Element snapshot (for Code Preview diff) ───────────────────────
  /** Most-recent PNG snapshot response from SNAPSHOT_READY — consumed by CodeTab. */
  elementSnapshot: { artboardId: string; nodeId: string; dataUrl: string | null } | null;
  setElementSnapshot: (artboardId: string, nodeId: string, dataUrl: string | null) => void;
}

export const useCanvas = create<CanvasStore>((set, get) => ({
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
    // BUG-2 fix: reset text flags alongside styles so a component without
    // direct text doesn't inherit the previous selection's Typography section.
    set({
      selectedComponentId: id,
      selectedComponentData: data,
      selectedComponentStyles: null,
      selectedComponentHasDirectText: false,
      selectedComponentHasParagraphChildren: false,
    }),

  selectedComponentStyles: null,
  setComponentStyles: (styles) => set({ selectedComponentStyles: styles }),

  selectedComponentHasDirectText: false,
  selectedComponentHasParagraphChildren: false,
  setComponentTextFlags: (hasDirectText, hasParagraphChildren) =>
    set({ selectedComponentHasDirectText: hasDirectText, selectedComponentHasParagraphChildren: hasParagraphChildren }),

  styleEditQueue: [],
  patchStyleEdit: (artboardId, nodeId, property, value) =>
    set((s) => ({ styleEditQueue: [...s.styleEditQueue, { artboardId, nodeId, property, value }] })),
  clearStyleEdits: (artboardId) =>
    set((s) => ({ styleEditQueue: s.styleEditQueue.filter((e) => e.artboardId !== artboardId) })),

  childrenStyleEditQueue: [],
  patchChildrenStyleEdit: (artboardId, parentNodeId, selector, property, value) =>
    set((s) => ({ childrenStyleEditQueue: [...s.childrenStyleEditQueue, { artboardId, parentNodeId, selector, property, value }] })),
  clearChildrenStyleEdits: (artboardId) =>
    set((s) => ({ childrenStyleEditQueue: s.childrenStyleEditQueue.filter((e) => e.artboardId !== artboardId) })),

  removeElementEvent: null,
  dispatchRemoveElement: (artboardId, nodeId) =>
    set({ removeElementEvent: { artboardId, nodeId } }),
  clearRemoveElement: () => set({ removeElementEvent: null }),

  selectedElementMode: null,
  setSelectedElementMode: (mode) => set({ selectedElementMode: mode }),

  indexerStatus: 'offline',
  setIndexerStatus: (status) => set({ indexerStatus: status }),

  projectMeta: null,
  setProjectMeta: (meta) => set({ projectMeta: meta }),

  activeViolations: [],
  setActiveViolations: (violations) => set({ activeViolations: violations }),

  activeAgentSessionId: null,
  setActiveAgentSessionId: (id) => set({ activeAgentSessionId: id }),

  discoveredRoutes: {},
  setDiscoveredRoutes: (artboardId, routes) =>
    set((s) => ({ discoveredRoutes: { ...s.discoveredRoutes, [artboardId]: routes } })),

  selectedArtboardW: null,
  selectedArtboardH: null,
  setSelectedArtboardSize: (w, h) => set({ selectedArtboardW: w, selectedArtboardH: h }),

  artboardResizeEvent: null,
  dispatchArtboardResize: (artboardId, width, height) =>
    set({ artboardResizeEvent: { artboardId, width, height } }),
  clearArtboardResize: () => set({ artboardResizeEvent: null }),

  intentStatus: {},
  setIntentStatus: (intentId, status) =>
    set((s) => ({ intentStatus: { ...s.intentStatus, [intentId]: status } })),

  styleUndoStack: [],
  pushStyleUndo: (artboardId, nodeId, property, previousValue) =>
    set((s) => ({ styleUndoStack: [...s.styleUndoStack, { artboardId, nodeId, property, previousValue }] })),
  undoStyleEdit: () => {
    const stack = get().styleUndoStack;
    if (stack.length === 0) return null;
    const item = stack[stack.length - 1]!;
    set({ styleUndoStack: stack.slice(0, -1) });
    return item;
  },

  designLanguageTokens: null,
  setDesignLanguageTokens: (tokens) => set({ designLanguageTokens: tokens }),

  artboardRootFontSize: {},
  setArtboardRootFontSize: (artboardId, px) =>
    set((s) => ({ artboardRootFontSize: { ...s.artboardRootFontSize, [artboardId]: px } })),

  artboardThumbnails: {},
  setArtboardThumbnail: (artboardId, dataUrl) =>
    set((s) => ({ artboardThumbnails: { ...s.artboardThumbnails, [artboardId]: dataUrl } })),

  elementSnapshot: null,
  setElementSnapshot: (artboardId, nodeId, dataUrl) => set({ elementSnapshot: { artboardId, nodeId, dataUrl } }),
}));
