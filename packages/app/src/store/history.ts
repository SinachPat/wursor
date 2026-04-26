import { create } from 'zustand';
import type { PropChange } from '@originmain/diff-engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditEntry {
  /** Which component was changed */
  componentId: string;
  componentName: string;
  /** The prop/style changes in this edit */
  changes: PropChange[];
  timestamp: number;
}

interface ArtboardHistory {
  past: EditEntry[];
  future: EditEntry[];
}

interface HistoryStore {
  /** Per-artboard history stacks */
  stacks: Record<string, ArtboardHistory>;

  /** Push a new edit onto the artboard's history (clears the future stack) */
  pushEdit: (artboardId: string, entry: EditEntry) => void;

  /** Undo the most recent edit for an artboard; returns the undone entry */
  undo: (artboardId: string) => EditEntry | undefined;

  /** Redo the next edit for an artboard; returns the redone entry */
  redo: (artboardId: string) => EditEntry | undefined;

  canUndo: (artboardId: string) => boolean;
  canRedo: (artboardId: string) => boolean;

  /** Clear history for a specific artboard */
  clearHistory: (artboardId: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 100;

function emptyStack(): ArtboardHistory {
  return { past: [], future: [] };
}

export const useHistory = create<HistoryStore>((set, get) => ({
  stacks: {},

  pushEdit(artboardId, entry) {
    set(state => {
      const current = state.stacks[artboardId] ?? emptyStack();
      const past = [...current.past, entry].slice(-MAX_HISTORY);
      return {
        stacks: {
          ...state.stacks,
          [artboardId]: { past, future: [] },
        },
      };
    });
  },

  undo(artboardId) {
    const stack = get().stacks[artboardId] ?? emptyStack();
    const last = stack.past[stack.past.length - 1];
    if (!last) return undefined;

    set(state => {
      const current = state.stacks[artboardId] ?? emptyStack();
      return {
        stacks: {
          ...state.stacks,
          [artboardId]: {
            past: current.past.slice(0, -1),
            future: [last, ...current.future],
          },
        },
      };
    });

    return last;
  },

  redo(artboardId) {
    const stack = get().stacks[artboardId] ?? emptyStack();
    const next = stack.future[0];
    if (!next) return undefined;

    set(state => {
      const current = state.stacks[artboardId] ?? emptyStack();
      return {
        stacks: {
          ...state.stacks,
          [artboardId]: {
            past: [...current.past, next],
            future: current.future.slice(1),
          },
        },
      };
    });

    return next;
  },

  canUndo(artboardId) {
    return (get().stacks[artboardId]?.past.length ?? 0) > 0;
  },

  canRedo(artboardId) {
    return (get().stacks[artboardId]?.future.length ?? 0) > 0;
  },

  clearHistory(artboardId) {
    set(state => ({
      stacks: {
        ...state.stacks,
        [artboardId]: emptyStack(),
      },
    }));
  },
}));
