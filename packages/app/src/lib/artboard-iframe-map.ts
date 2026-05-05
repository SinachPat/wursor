// ── Artboard iframe map ───────────────────────────────────────────────────────
// Module-level singleton: maps artboard ID → live HTMLIFrameElement.
//
// DOM references must never be stored in Zustand — they are not serialisable,
// prevent garbage collection, and break React DevTools. Each <LiveArtboard>
// registers its iframeRef.current on mount and removes it on unmount.
//
// The canvas dispatches postMessage via:
//   artboardIframeMap.get(selectedArtboardId)?.contentWindow?.postMessage(…)

export const artboardIframeMap = new Map<string, HTMLIFrameElement>();
