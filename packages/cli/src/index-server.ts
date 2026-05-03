// ── AST Index HTTP Server ─────────────────────────────────────────────────────
// Exposes the component index built by the Indexer class over a local HTTP API.
// Runs on port 4171 (or --index-port N). Localhost-only; no auth required.
//
// Endpoints:
//   GET /health                  → status + indexed count + projectMeta
//   GET /components              → ComponentEntry[]  (all)
//   GET /components?name=Card    → ComponentEntry[]  (fuzzy by name)
//   GET /components?file=src/…   → ComponentEntry[]  (by file path)
//   GET /file?path=src/…         → { content, lines }  (with path security)
//   GET /events                  → text/event-stream (SSE for index updates)
//   POST /reindex                → trigger full rescan

import { createServer }              from 'node:http';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, sep }              from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Indexer }              from './indexer.js';
import type { ProjectMeta }          from './detect-framework.js';

// ── File security config ────────────────────────────────────────────────────

/** Only these extensions are allowed through GET /file. */
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json',
]);

/** Path patterns that are always blocked, regardless of extension. */
const BLOCKED_PATH_RE = /(\/(\.git|node_modules)\/)|(password|secret|credential|token|private)/i;

/** Filename patterns that are never served. */
const BLOCKED_FILENAME_RE = /^\.env(\.|$)|(\.pem|\.key|\.p12|\.pfx|\.jks|\.crt|\.cer|\.der|\.secret|\.secrets)$/i;

function isPathSafe(
  projectRoot: string,
  requestedPath: string,
): { safe: boolean; absolute: string } {
  // Step 1: URL-decode
  let decoded: string;
  try { decoded = decodeURIComponent(requestedPath); }
  catch { return { safe: false, absolute: '' }; }

  // Step 2: Resolve to absolute (lexical — does NOT follow symlinks yet)
  const absolute = resolve(projectRoot, decoded);

  // Step 3: Must be within projectRoot (+ sep prevents prefix confusion).
  // Check lexical path first as a fast pre-filter.
  if (!absolute.startsWith(projectRoot + sep)) {
    return { safe: false, absolute };
  }

  // C-2 fix: resolve() is lexical; a symlink inside the project root could
  // point outside it (e.g., src/secrets -> /etc). Call realpathSync on the
  // *parent directory* (which must exist) to canonicalise without requiring
  // the file itself to exist yet, then re-apply the prefix check.
  try {
    if (existsSync(absolute)) {
      const real = realpathSync(absolute);
      if (!real.startsWith(projectRoot + sep)) {
        return { safe: false, absolute };
      }
    }
  } catch {
    // realpathSync can fail for broken symlinks — treat as unsafe.
    return { safe: false, absolute };
  }

  // Step 4: Extension check
  const lastDot = absolute.lastIndexOf('.');
  const ext = lastDot >= 0 ? absolute.slice(lastDot) : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) return { safe: false, absolute };

  // Step 5: Blocked path / filename patterns
  if (BLOCKED_PATH_RE.test(absolute)) return { safe: false, absolute };
  const fileName = absolute.slice(absolute.lastIndexOf(sep) + 1);
  if (BLOCKED_FILENAME_RE.test(fileName)) return { safe: false, absolute };

  return { safe: true, absolute };
}

// ── CORS headers ────────────────────────────────────────────────────────────

const CORS: Record<string, string> = {
  'access-control-allow-origin':  '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...CORS });
  res.end(json);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

// ── SSE helpers ─────────────────────────────────────────────────────────────

/** Active SSE connections; used to broadcast index update events. */
let sseClients: ServerResponse[] = [];

function broadcastSse(event: Record<string, unknown>): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try { res.write(data); return true; }
    catch { return false; }
  });
}

/**
 * Start the index HTTP server.
 * Returns a `close()` method for graceful shutdown.
 */
export function startIndexServer(opts: {
  indexer:     Indexer;
  projectMeta: ProjectMeta;
  projectRoot: string;
  port:        number;
}): { close: () => void } {
  const { indexer, projectMeta, projectRoot, port } = opts;

  // Broadcast index updates to SSE clients
  indexer.on('update', (event: Record<string, unknown>) => {
    broadcastSse({ type: 'INDEX_UPDATED', ...event });
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase() ?? 'GET';

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    // ── GET /health ────────────────────────────────────────────────────────
    if (path === '/health' && method === 'GET') {
      sendJson(res, 200, {
        status:      indexer.status,
        indexed:     indexer.componentCount(),
        lastScan:    indexer.lastScan,
        projectRoot,
        projectMeta,
      });
      return;
    }

    // ── GET /components ────────────────────────────────────────────────────
    if (path === '/components' && method === 'GET') {
      const nameParam = url.searchParams.get('name');
      const fileParam = url.searchParams.get('file');
      const results = indexer.query({
        ...(nameParam != null && { name: nameParam }),
        ...(fileParam != null && { file: fileParam }),
      });
      sendJson(res, 200, results);
      return;
    }

    // ── GET /file ──────────────────────────────────────────────────────────
    if (path === '/file' && method === 'GET') {
      const requestedPath = url.searchParams.get('path') ?? '';
      console.log(`[originmain indexer] File request: ${requestedPath}`);

      if (!requestedPath) {
        sendError(res, 400, 'Missing ?path= parameter');
        return;
      }

      const { safe, absolute } = isPathSafe(projectRoot, requestedPath);
      if (!safe) {
        console.warn(`[originmain indexer] Blocked file request: ${requestedPath} (resolved: ${absolute})`);
        sendError(res, 403, 'Access denied');
        return;
      }

      try {
        const content = readFileSync(absolute, 'utf-8');
        const lines   = content.split('\n').length;
        sendJson(res, 200, { content, lines });
      } catch {
        sendError(res, 404, 'File not found');
      }
      return;
    }

    // ── GET /events (SSE) ──────────────────────────────────────────────────
    if (path === '/events' && method === 'GET') {
      res.writeHead(200, {
        'content-type':  'text/event-stream',
        'cache-control': 'no-cache',
        'connection':    'keep-alive',
        ...CORS,
      });
      // Heartbeat comment to keep connection alive through proxies
      res.write(': connected\n\n');
      sseClients.push(res);

      // Send current status immediately on connect
      res.write(`data: ${JSON.stringify({ type: 'STATUS', status: indexer.status, indexed: indexer.componentCount() })}\n\n`);

      req.on('close', () => {
        sseClients = sseClients.filter((c) => c !== res);
      });
      return;
    }

    // ── POST /reindex ──────────────────────────────────────────────────────
    if (path === '/reindex' && method === 'POST') {
      indexer.fullScan().catch((err: Error) => {
        console.error(`[originmain indexer] Rescan failed: ${err.message}`);
      });
      sendJson(res, 202, { message: 'Rescan started' });
      return;
    }

    // 404
    sendError(res, 404, `Unknown endpoint: ${path}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  \x1b[31mError:\x1b[0m Index port ${port} is already in use.`);
      console.error(`  Try: originmain dev --target ... --index-port ${port + 1}\n`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`  \x1b[2mAST indexer API .............. http://localhost:${port}\x1b[0m`);
  });

  return {
    close() {
      sseClients.forEach((res) => { try { res.end(); } catch { /* ignore */ } });
      sseClients = [];
      server.close();
    },
  };
}
