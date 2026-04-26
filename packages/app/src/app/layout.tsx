import type { ReactNode } from 'react';
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
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
          <header style={{ position: 'fixed', top: 0, right: 0, zIndex: 9999, padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
