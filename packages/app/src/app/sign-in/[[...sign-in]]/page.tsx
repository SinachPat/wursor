'use client';

import { SignIn } from '@clerk/nextjs';
import { useCanvasTheme } from '@/store/canvasTheme';

export default function SignInPage() {
  const T = useCanvasTheme();

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        // Use the exact canvas background tokens so this page matches the
        // product's dark / light canvas aesthetic.
        background: T.canvasBg,
        backgroundImage: `radial-gradient(circle, ${T.dotColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        transition: 'background 0.2s',
      }}
    >
      <SignIn />
    </main>
  );
}
