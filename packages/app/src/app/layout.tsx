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
        {/* signInForceRedirectUrl / signUpForceRedirectUrl override any redirect_url
            param that OAuth providers (GitHub, Google) may inject — ensuring we
            always land on the right page regardless of the OAuth callback URL. */}
        <ClerkProvider
          signInForceRedirectUrl="/workspaces"
          signUpForceRedirectUrl="/onboarding"
        >
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
