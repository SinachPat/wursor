import { create } from 'zustand';
import type { FiberNode } from '@originmain/renderer';
import type { Violation } from '@originmain/design-language';

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
  // Set by the Agent Bridge when a session starts/ends. Inspector and
  // CompletionZone read this to populate session_id on intent_diffs so the
  // Agent Bridge can later query diffs by session (getDiffsByStatus etc.).
  // null = no agent session active; user-created diffs get session_id ''.
  activeAgentSessionId: string | null;
  setActiveAgentSessionId: (id: string | null) => void;
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
}));
