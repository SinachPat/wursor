'use client';

import type { ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { originmainLightTheme } from '@originmain/ui';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FluentProvider theme={originmainLightTheme} style={{ height: '100%' }}>
      {children}
    </FluentProvider>
  );
}
