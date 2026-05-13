// @originmain/dev — client entry
//
// Side-effect-only re-export of the live SDK.
// Install this before React in your app entry point (or use withOriginmain()).
//
// Usage:
//   import '@originmain/dev';  // MUST be before React
//
// The browser-side fiber hook will activate when the page runs inside an
// Originmain artboard iframe (via postMessage) OR when connected to the
// cloud canvas via the SDK bridge (via SSE).

export * from '@originmain/live';
import '@originmain/live';
