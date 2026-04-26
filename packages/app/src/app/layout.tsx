import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
import './globals.css';

export const metadata = {
  title: 'Originmain',
  description: 'AI-Native Design Engineering Platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
