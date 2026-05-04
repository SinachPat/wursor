'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { originmainLightTheme, originmainDarkTheme } from '@originmain/ui';
import { trpc } from '@/lib/trpc';
import { useTheme } from '@/store/theme';
import { TourOverlay } from '@/components/walkthrough/TourOverlay';

export function Providers({ children }: { children: ReactNode }) {
  // TanStack Query v5: create QueryClient inside useState so it's stable across
  // re-renders and each client-side navigation gets the same instance.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // tRPC client — shares the QueryClient so tRPC queries/mutations go into the
  // same cache as all other TanStack Query calls in the app.
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({ url: '/api/trpc' }),
      ],
    }),
  );

  const mode = useTheme((s) => s.mode);
  const theme = mode === 'dark' ? originmainDarkTheme : originmainLightTheme;

  // Sync data-theme on <html> so CSS variables and server-rendered page
  // backgrounds can respond to the user's preference without prop drilling.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <FluentProvider theme={theme} style={{ height: '100%' }}>
          {children}
          <TourOverlay />
        </FluentProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
