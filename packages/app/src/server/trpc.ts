// ── tRPC server initialisation ────────────────────────────────────────────────
// Creates the tRPC context (Clerk auth + Supabase server client), the router
// factory, and the protected-procedure middleware.
//
// Spec Layer 6: all AI feature calls MUST go through tRPC server-side routes
// so they are authenticated, rate-limited, and attributed to a workspace.

import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@clerk/nextjs/server';
import { serverClient } from '@/lib/supabase';
import type { DbClient } from '@originmain/origin-graph';

// ── Context ───────────────────────────────────────────────────────────────────

export interface TRPCContext {
  userId:  string | null;
  db:      DbClient;
}

export async function createTRPCContext(): Promise<TRPCContext> {
  const { userId } = await auth();
  const db          = serverClient();
  return { userId, db };
}

// ── Initialisation ────────────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create();

export const router    = t.router;
export const publicProcedure = t.procedure;

// ── Auth middleware ───────────────────────────────────────────────────────────
// Throws UNAUTHORIZED if the caller has no Clerk session.

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const protectedProcedure = t.procedure.use(isAuthed);
