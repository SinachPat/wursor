// ── tRPC HTTP handler (Next.js App Router) ────────────────────────────────────
// Mounts the tRPC appRouter at /api/trpc/* using the fetch adapter.
// Both GET (queries) and POST (mutations) are needed.

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter }           from '@/server/routers/index';
import { createTRPCContext }   from '@/server/trpc';
import type { NextRequest }    from 'next/server';

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint:   '/api/trpc',
    req,
    router:     appRouter,
    createContext: createTRPCContext,
    onError: ({ path, error }) => {
      console.error(`tRPC error on /${path}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
