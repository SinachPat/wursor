'use client';

// ── useIndexer ────────────────────────────────────────────────────────────────
// Connects the canvas app to the CLI AST indexer server.
//
// On mount it:
//   1. Reads window.__OM_INDEX_URL__ injected by the CLI proxy. If absent,
//      the indexer stays 'offline' and the hook is a no-op.
//   2. Fetches GET /health to hydrate projectMeta (framework, tailwind, etc.)
//      and sets indexerStatus → 'ready'.
//   3. Opens a GET /events SSE subscription that updates indexerStatus to
//      'indexing' during re-scans and back to 'ready' when done.
//
// Exports fetchComponents(name) and fetchFile(path) for use by the Props tab
// and future Code tab.

import { useEffect, useRef, useCallback } from 'react';
import { useCanvas } from '@/store/canvas';
import type { ProjectMeta } from '@/store/canvas';

interface ComponentEntry {
  name: string;
  filePath: string;
  line: number;
  cssImports: string[];
}

interface IndexerHealthResponse {
  status: string;
  projectMeta: ProjectMeta;
}

declare global {
  interface Window {
    __OM_INDEX_URL__?: string;
  }
}

export function useIndexer() {
  const { setIndexerStatus, setProjectMeta } = useCanvas();
  const baseUrlRef = useRef<string | null>(null);

  // ── 1. Detect indexer URL and fetch /health ────────────────────────────��───
  useEffect(() => {
    const base = typeof window !== 'undefined' ? (window.__OM_INDEX_URL__ ?? null) : null;
    if (!base) {
      setIndexerStatus('offline');
      return;
    }
    // Store for use by SSE effect and fetch helpers. Both effects run in the
    // same render cycle so the ref is populated before the SSE effect opens.
    baseUrlRef.current = base;

    let cancelled = false;

    async function fetchHealth() {
      try {
        const res = await fetch(`${base}/health`);
        if (!res.ok) throw new Error(`/health ${res.status}`);
        const data = await res.json() as IndexerHealthResponse;
        if (!cancelled) {
          setProjectMeta(data.projectMeta);
          setIndexerStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useIndexer] /health failed — indexer offline', err);
          setIndexerStatus('offline');
        }
      }
    }

    void fetchHealth();
    return () => { cancelled = true; };
  }, [setIndexerStatus, setProjectMeta]);

  // ── 2. SSE subscription for live re-index events ───────────────────────────
  useEffect(() => {
    // BUG-11 fix: read from ref, not window, for consistency and to avoid
    // a second window access after the first effect already resolved the URL.
    const base = baseUrlRef.current;
    if (!base) return;

    const es = new EventSource(`${base}/events`);

    // BUG-1 fix: `onopen` fires on EVERY connection, including the very first
    // one. We must distinguish initial open (health already fetched by the
    // sibling useEffect above) from a *reconnection* after an error. Calling
    // /health again on the initial open produces two concurrent fetches racing
    // to set projectMeta/indexerStatus, and the second fetch has no cleanup.
    let isFirstOpen = true;
    // Track whether an onopen-triggered health fetch is in-flight so that the
    // effect cleanup can cancel it if the component unmounts before it resolves.
    let reopenCancelled = false;

    es.addEventListener('INDEX_START', () => {
      setIndexerStatus('indexing');
    });

    es.addEventListener('INDEX_UPDATED', () => {
      setIndexerStatus('ready');
    });

    es.onerror = () => {
      // Connection dropped — mark offline. The browser will auto-reconnect;
      // onopen will fire again and we will re-sync health at that point.
      setIndexerStatus('offline');
    };

    es.onopen = () => {
      if (isFirstOpen) {
        // Initial connection: health was already fetched by the sibling effect.
        isFirstOpen = false;
        return;
      }
      // Reconnection after an error — re-fetch /health to sync projectMeta
      // (the CLI may have been restarted with a different project).
      reopenCancelled = false;
      void fetch(`${base}/health`)
        .then(r => r.json() as Promise<IndexerHealthResponse>)
        .then(data => {
          if (!reopenCancelled) {
            setProjectMeta(data.projectMeta);
            setIndexerStatus('ready');
          }
        })
        .catch(() => { if (!reopenCancelled) setIndexerStatus('offline'); });
    };

    return () => {
      es.close();
      reopenCancelled = true;
    };
  }, [setIndexerStatus, setProjectMeta]);

  // ── 3. Data-fetching helpers exposed to consuming components ───────────────

  /** Fetch all component entries matching a display name from the index. */
  const fetchComponents = useCallback(async (name: string): Promise<ComponentEntry[]> => {
    const base = baseUrlRef.current;
    if (!base) return [];
    try {
      const res = await fetch(`${base}/components?name=${encodeURIComponent(name)}`);
      if (!res.ok) return [];
      return await res.json() as ComponentEntry[];
    } catch {
      return [];
    }
  }, []);

  /** Fetch the raw source text of a file by absolute path. */
  const fetchFile = useCallback(async (filePath: string): Promise<string | null> => {
    const base = baseUrlRef.current;
    if (!base) return null;
    try {
      const res = await fetch(`${base}/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }, []);

  return { fetchComponents, fetchFile };
}
