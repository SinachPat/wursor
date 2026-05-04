// ── App router — root tRPC router ─────────────────────────────────────────────
import { router }   from '../trpc.js';
import { aiRouter } from './ai.js';

export const appRouter = router({
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
