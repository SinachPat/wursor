'use client';

import { useState, type ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { originmainLightTheme } from '@originmain/ui';

export function Providers({ children }: { children: ReactNode }) {
  // TanStack Query v5: create QueryClient inside useState so it's stable across
  // re-renders and each client-side navigation gets the same instance. Creating
  // it outside the component would cause it to be shared across requests on the
  // server (SSR memory leak / cross-request data pollution).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,      // treat data as fresh for 30 s
            retry: 1,               // one automatic retry on transient errors
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={originmainLightTheme} style={{ height: '100%' }}>
        {children}
      </FluentProvider>
    </QueryClientProvider>
  );
}
