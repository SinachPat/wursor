'use client';

// ── tRPC client (Next.js App Router, client components) ───────────────────────
// Creates a typed tRPC client backed by the TanStack Query context already
// provided by the app's QueryClientProvider.
//
// Usage (in client components):
//   const summarize = trpc.ai.summarizeDiff.useMutation();
//   await summarize.mutateAsync({ artboardId, workspaceId, changes });

import { createTRPCReact }  from '@trpc/react-query';
import { httpBatchLink }    from '@trpc/client';
import type { AppRouter }   from '@/server/routers/index';

// Typed tRPC hooks — import `trpc` in client components for .useQuery / .useMutation
export const trpc = createTRPCReact<AppRouter>();

// Raw client for server-side usage (e.g., in Server Actions)
export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/api/trpc',
      }),
    ],
  });
}
