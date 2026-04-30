'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { originmainLightTheme, originmainDarkTheme } from '@originmain/ui';
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

  const mode = useTheme((s) => s.mode);
  const theme = mode === 'dark' ? originmainDarkTheme : originmainLightTheme;

  // Sync data-theme on <html> so CSS variables and server-rendered page
  // backgrounds can respond to the user's preference without prop drilling.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={theme} style={{ height: '100%' }}>
        {children}
        <TourOverlay />
      </FluentProvider>
    </QueryClientProvider>
  );
}
