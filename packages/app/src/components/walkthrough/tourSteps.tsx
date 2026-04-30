import type { ReactNode } from 'react';

export interface TourStep {
  /** Unique key — also used as aria-label. */
  id: string;
  title: string;
  body: ReactNode;
  /** Optional shell command shown in a monospace code block. */
  codeBlock?: string;
  /** CSS selector for the element to spotlight. Falls back to centered modal. */
  targetSelector?: string;
  /** Which side of the spotlight to place the tooltip.
   *  'auto' (default): below if space available, otherwise above. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** URL substring — if present and current URL does NOT include it,
   *  the spotlight is skipped and the card shows a navigation hint. */
  requiredPathPart?: string;
}

// ── Tour steps ─────────────────────────────────────────────────────────────────
// Steps walk the user from the workspace dashboard all the way through live
// component inspection on the canvas. Descriptions are concise (< 3 sentences).

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Originmain',
    body: (
      <>
        Originmain gives you a live visual canvas for your running React apps —
        inspect components, generate intent diffs, and ship changes with AI. Let&apos;s
        get you set up in under 2 minutes.
      </>
    ),
    // No target — renders as a centered welcome card.
  },

  {
    id: 'workspace-projects',
    title: 'Your workspace',
    body: (
      <>
        This is your workspace. It holds all your projects, team members, and
        design language files. Each project connects to a single running
        application — local, staging, or preview.
      </>
    ),
    targetSelector: '[data-tour="projects-section"]',
    placement: 'bottom',
    requiredPathPart: '/workspace/',
  },

  {
    id: 'new-project',
    title: 'Create a project',
    body: (
      <>
        Click <strong>New project</strong> to create your first project.
        You&apos;ll give it a name, an optional URL, and a framework — you can
        always change these later in project settings.
      </>
    ),
    targetSelector: '[data-tour="new-project-btn"]',
    placement: 'bottom',
    requiredPathPart: '/workspace/',
  },

  {
    id: 'open-canvas',
    title: 'Open the canvas',
    body: (
      <>
        Click any project card to open its visual canvas editor. The canvas is
        where live rendering, component inspection, diff generation, and AI
        queries all live.
      </>
    ),
    targetSelector: '[data-tour="project-card"]',
    placement: 'bottom',
    requiredPathPart: '/workspace/',
  },

  {
    id: 'canvas-overview',
    title: 'The canvas editor',
    body: (
      <>
        Left panel: artboard navigator and file tree. Center: infinite canvas
        with your artboards. Right: the inspector — props, diffs, and the live
        component graph. Press <kbd style={{ fontFamily: 'inherit' }}>V</kbd>,{' '}
        <kbd style={{ fontFamily: 'inherit' }}>H</kbd>,{' '}
        <kbd style={{ fontFamily: 'inherit' }}>A</kbd> to switch tools.
      </>
    ),
    // No target — full-canvas overview shown as a centered card.
    requiredPathPart: '/project/',
  },

  {
    id: 'connect-app',
    title: 'Connect your app',
    body: (
      <>
        Run the CLI proxy in a second terminal. It strips iframing headers and
        injects the Originmain fiber hook into your dev server&apos;s HTML — zero
        changes to your app code needed.
      </>
    ),
    codeBlock: `# Terminal 2 — keep your dev server running in Terminal 1
# From the monorepo root:
pnpm cli:build          # one-time build (skip if already built)
pnpm cli:dev --target http://localhost:3000

# ✓ Proxy listening on http://localhost:4170
# Paste http://localhost:4170 into the artboard URL input`,
    targetSelector: '[data-tour="artboard-empty"]',
    placement: 'right',
    requiredPathPart: '/project/',
  },

  {
    id: 'enter-url',
    title: 'Enter the proxy URL',
    body: (
      <>
        Click <strong>Enter proxy URL</strong>, paste{' '}
        <code
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: '0.8em',
            background: 'var(--card-subtle)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          http://localhost:4170
        </code>
        , and press Connect. The artboard will render your live app and begin
        streaming the React fiber tree.
      </>
    ),
    targetSelector: '[data-tour="artboard-url-btn"]',
    placement: 'top',
    requiredPathPart: '/project/',
  },

  {
    id: 'navigator-live',
    title: 'Live connection established',
    body: (
      <>
        A pulsing green dot in the navigator means Originmain has an active
        fiber connection. Every React commit — including HMR hot updates —
        streams the full component tree to the canvas in real time.
      </>
    ),
    targetSelector: '[data-tour="navigator-panel"]',
    placement: 'right',
    requiredPathPart: '/project/',
  },

  {
    id: 'inspector',
    title: 'Inspect any component',
    body: (
      <>
        Click any element in the canvas to select it. The inspector shows its
        live props, lets you export an intent diff, and gives you a full
        component graph. The AI query bar runs cross-artboard analysis.
      </>
    ),
    targetSelector: '[data-tour="inspector-panel"]',
    placement: 'left',
    requiredPathPart: '/project/',
  },

  {
    id: 'done',
    title: "You're all set 🎉",
    body: (
      <>
        You know how to connect an app, inspect components, and navigate the
        canvas. Explore the diff tab to generate intent diffs, or add more
        artboards with{' '}
        <kbd style={{ fontFamily: 'inherit' }}>A</kbd> and connect different
        routes.
      </>
    ),
    // Centered finish card — no spotlight.
  },
];
