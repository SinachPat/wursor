import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalkthroughStore {
  /** Whether the tour overlay is currently visible. */
  active: boolean;
  /** Zero-based index of the current step. */
  stepIndex: number;
  /** True once the user reaches the final step and closes the tour. */
  completed: boolean;
  start: () => void;
  next: (totalSteps: number) => void;
  prev: () => void;
  dismiss: () => void;
  restart: () => void;
}

export const useWalkthrough = create<WalkthroughStore>()(
  persist(
    (set) => ({
      active:    false,
      stepIndex: 0,
      completed: false,

      start: () => set({ active: true, stepIndex: 0 }),

      next: (totalSteps: number) =>
        set((s) => {
          const next = s.stepIndex + 1;
          if (next >= totalSteps) {
            // Reached the end — mark complete and close.
            return { active: false, completed: true, stepIndex: 0 };
          }
          return { stepIndex: next };
        }),

      prev: () =>
        set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),

      dismiss: () => set({ active: false }),

      restart: () => set({ active: true, stepIndex: 0, completed: false }),
    }),
    {
      name: 'originmain:tour',
    },
  ),
);
