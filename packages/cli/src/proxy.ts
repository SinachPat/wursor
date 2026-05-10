// ── Reverse Proxy ────────────────────────────────────────────────────────────
// HTTP(S) reverse proxy that:
//   1. Forwards all requests to the target dev server (http or https)
//   2. Strips X-Frame-Options and CSP frame-ancestors from responses
//   3. Injects the Originmain fiber hook into HTML responses
//   4. Passes WebSocket upgrades through for HMR
//
// Uses only Node.js built-ins — no external dependencies.

import { createServer }                         from 'node:http';
import { request as httpRequest }               from 'node:http';
import { request as httpsRequest }              from 'node:https';
import { connect as netConnect }                from 'node:net';
import type { IncomingMessage, ServerResponse,
              RequestOptions, ClientRequest }   from 'node:http';
import type { Socket }                          from 'node:net';
import { injectFiberHook, buildFiberHookExternalScript } from './inject.js';
import { handleIsolationRequest }               from './isolation-server.js';
import html2canvasSource                        from 'html2canvas/dist/html2canvas.min.js';

export interface ProxyOptions {
  /** Target dev server URL, e.g. "http://localhost:3000" */
  target: string;
  /** Port for the proxy to listen on (default: 4170) */
  port: number;
  /** URL of the AST indexer API (null when --no-index). Injected as window.__OM_INDEX_URL__ */
  indexUrl?: string | null;
}

/** Headers to strip from proxied responses (case-insensitive). */
const STRIP_RESPONSE_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
]);

/** CORS headers appended to every response so the canvas can reach the app. */
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin':      '*',
  'access-control-allow-methods':     '*',
  'access-control-allow-headers':     '*',
  'access-control-allow-credentials': 'true',
};

// ── Outgoing request helper ────────────────────────────────────────────────
// Chooses http / https based on the target protocol.
// rejectUnauthorized is disabled for HTTPS because dev / staging servers
// frequently use self-signed certificates.

function doRequest(
  isHttps: boolean,
  options: RequestOptions,
  cb: (res: IncomingMessage) => void,
): ClientRequest {
  if (isHttps) {
    return httpsRequest({ ...options, rejectUnauthorized: false }, cb);
  }
  return httpRequest(options, cb);
}

/**
 * Start the reverse proxy server.
 * Returns an object with a `close()` method for graceful shutdown.
 */
export function startProxy(opts: ProxyOptions): { close: () => void } {
  const targetUrl  = new URL(opts.target);
  const isHttps    = targetUrl.protocol === 'https:';
  const targetHost = targetUrl.hostname;
  // Default port: 443 for HTTPS, 80 for HTTP — matches browser behaviour.
  const targetPort = parseInt(targetUrl.port || (isHttps ? '443' : '80'), 10);

  // html2canvas source is embedded at build time by build.mjs's html2canvas-text
  // plugin. Convert to a Buffer once so repeated requests don't re-encode.
  const html2canvasBuf = Buffer.from(html2canvasSource, 'utf-8');

  const server = createServer((clientReq: IncomingMessage, clientRes: ServerResponse) => {
    // ── Serve embedded html2canvas bundle (replaces CDN dependency) ───────
    // The fiber hook loads html2canvas via /__om_h2c__.js instead of unpkg so
    // the proxy works offline and is not blocked by restrictive CSP policies.
    if (clientReq.url === '/__om_h2c__.js') {
      clientRes.writeHead(200, {
        'content-type':   'application/javascript; charset=utf-8',
        'content-length': String(html2canvasBuf.byteLength),
        'cache-control':  'public, max-age=86400, immutable',
        ...CORS_HEADERS,
      });
      clientRes.end(html2canvasBuf);
      return;
    }

    // ── Serve the fiber hook as an EXTERNAL script (not inline) ───────────
    // We used to inject the hook as an inline <script>...</script> tag, but
    // inline scripts are blocked by many real-world conditions:
    //   • CSPs without 'unsafe-inline' (often set by upstream proxies/CDNs)
    //   • React 19 hydration tearing out unmanaged <head> elements
    //   • Some browser-extension content filters
    // Serving the script same-origin from the proxy bypasses every one of
    // these because:
    //   • script-src 'self' is allowed by virtually every CSP
    //   • React doesn't reconcile the content of external <script src="..."> tags
    //   • The script body comes from a separate HTTP request, so HTML caching
    //     of the page doesn't pin a stale script body.
    if (clientReq.url?.startsWith('/__om_fiber_hook__.js')) {
      const script = buildFiberHookExternalScript(opts.indexUrl);
      const buf    = Buffer.from(script, 'utf-8');
      clientRes.writeHead(200, {
        'content-type':   'application/javascript; charset=utf-8',
        'content-length': String(buf.byteLength),
        // Don't cache — the proxy may be restarted with different indexUrl
        // and we never want a stale bundle pinned in the iframe.
        'cache-control':  'no-store, no-cache, must-revalidate',
        ...CORS_HEADERS,
      });
      clientRes.end(buf);
      return;
    }

    // ── Intercept /__om_isolation__/* requests ────────────────────────────
    if (clientReq.url?.startsWith('/__om_isolation__')) {
      handleIsolationRequest(clientReq, clientRes);
      return;
    }

    // ── Build the outgoing request headers ────────────────────────────────

    const outHeaders: Record<string, string | string[]> = {};

    for (const [key, val] of Object.entries(clientReq.headers)) {
      const lower = key.toLowerCase();

      // Strip Accept-Encoding — we replace it with 'identity' below so the
      // target always returns uncompressed HTML that we can decode and inject.
      if (lower === 'accept-encoding') continue;

      // Rewrite Host to point at the actual target, not the proxy.
      if (lower === 'host') {
        outHeaders[key] = `${targetHost}:${targetPort}`;
        continue;
      }

      if (val !== undefined) outHeaders[key] = val as string | string[];
    }

    // Explicitly ask for uncompressed content.
    outHeaders['accept-encoding'] = 'identity';

    const method    = clientReq.method ?? 'GET';
    const isHeadReq = method === 'HEAD';

    const proxyReq = doRequest(
      isHttps,
      {
        hostname: targetHost,
        port:     targetPort,
        path:     clientReq.url ?? '/',
        method,
        headers:  outHeaders,
      },
      (proxyRes: IncomingMessage) => {
        // ── Build clean response headers ──────────────────────────────────

        const resHeaders: Record<string, string | string[]> = {};

        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
          if (val !== undefined) resHeaders[key] = val as string | string[];
        }

        // Append CORS.
        for (const [key, val] of Object.entries(CORS_HEADERS)) {
          resHeaders[key] = val;
        }

        // ── Detect HTML responses ─────────────────────────────────────────

        const contentType = (proxyRes.headers['content-type'] ?? '').toLowerCase();
        const isHtml      = contentType.includes('text/html');

        // HEAD and non-HTML responses: stream (or drain) through unchanged.
        // HEAD: RFC 7231 §4.3.2 — response MUST NOT include a body.
        //   We must drain the response to free the socket, but send no body.
        // Non-HTML: no injection needed, stream straight through.
        if (isHeadReq || !isHtml) {
          clientRes.writeHead(proxyRes.statusCode ?? 200, resHeaders);
          proxyRes.on('error', (err: Error) => {
            console.error(`[originmain proxy] Response stream error: ${err.message}`);
            clientRes.destroy();
          });
          if (isHeadReq) {
            // Drain + end without sending body.
            proxyRes.resume();
            proxyRes.on('end', () => clientRes.end());
          } else {
            proxyRes.pipe(clientRes);
          }
          return;
        }

        // HTML GET/POST: buffer, inject the fiber hook script, then send.
        // Strip Content-Encoding — we decode to UTF-8, so the encoding header
        // would be incorrect after injection.
        delete resHeaders['content-encoding'];

        // Force fresh fetches every time. Without this, browsers (and proxies)
        // can pin an injected HTML response in cache, so the iframe loads an
        // older version of our injected <script> tag — even after the CLI is
        // rebuilt and restarted. no-store is the strongest such directive.
        resHeaders['cache-control'] = 'no-store, no-cache, must-revalidate';
        delete resHeaders['etag'];
        delete resHeaders['last-modified'];

        const chunks: Buffer[] = [];

        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));

        proxyRes.on('error', (err: Error) => {
          console.error(`[originmain proxy] HTML response stream error: ${err.message}`);
          if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'content-type': 'text/plain' });
          }
          clientRes.destroy();
        });

        proxyRes.on('end', () => {
          const rawHtml      = Buffer.concat(chunks).toString('utf-8');
          const injectedHtml = injectFiberHook(rawHtml, opts.indexUrl);
          const body         = Buffer.from(injectedHtml, 'utf-8');

          // Correct Content-Length and drop Transfer-Encoding: chunked.
          resHeaders['content-length'] = String(body.byteLength);
          delete resHeaders['transfer-encoding'];

          clientRes.writeHead(proxyRes.statusCode ?? 200, resHeaders);
          clientRes.end(body);
        });
      },
    );

    // ── Handle target-unreachable errors ──────────────────────────────────

    proxyReq.on('error', (err: Error) => {
      console.error(`[originmain proxy] Target request failed: ${err.message}`);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'content-type': 'text/plain' });
        clientRes.end(
          `Originmain proxy: could not reach target at ${opts.target}\n${err.message}`,
        );
      } else {
        // Headers already on the wire — tear down the connection cleanly.
        clientRes.destroy();
      }
    });

    // ── Handle client disconnects ─────────────────────────────────────────

    clientReq.on('error', (err: Error) => {
      console.error(`[originmain proxy] Client request error: ${err.message}`);
      proxyReq.destroy();
    });

    // Pipe the request body (relevant for POST / PUT / PATCH).
    clientReq.pipe(proxyReq);
  });

  // ── Friendly error for port conflicts ─────────────────────────────────────

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  \x1b[31mError:\x1b[0m Port ${opts.port} is already in use.`);
      console.error(
        `  Try a different port: originmain dev --target ${opts.target} --port ${opts.port + 1}\n`,
      );
      process.exit(1);
    }
    throw err;
  });

  // ── WebSocket upgrade passthrough (for HMR) ───────────────────────────────

  server.on('upgrade', (req: IncomingMessage, clientSocket: Socket, head: Buffer) => {
    const targetSocket = netConnect(targetPort, targetHost, () => {
      // Reconstruct the raw HTTP upgrade request.
      const reqLine  = `${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/${req.httpVersion}\r\n`;
      const hostHdr  = `host: ${targetHost}:${targetPort}`;
      const otherHdr = Object.entries(req.headers)
        .filter(([key]) => key.toLowerCase() !== 'host')
        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : (val ?? '')}`)
        .join('\r\n');

      targetSocket.write(`${reqLine}${hostHdr}\r\n${otherHdr}\r\n\r\n`);
      if (head.length > 0) targetSocket.write(head);

      // Bidirectional pipe.
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    // Ensure both sockets are torn down when either side closes.
    targetSocket.on('close', () => clientSocket.destroy());
    clientSocket.on('close', () => targetSocket.destroy());

    targetSocket.on('error', (err: Error) => {
      console.error(`[originmain proxy] WebSocket proxy error: ${err.message}`);
      clientSocket.destroy();
    });

    clientSocket.on('error', (err: Error) => {
      console.error(`[originmain proxy] WebSocket client error: ${err.message}`);
      targetSocket.destroy();
    });
  });

  // ── Start listening ───────────────────────────────────────────────────────

  // H-5 fix: bind to loopback only — the proxy strips security headers and
  // injects the fiber hook, so it must never be reachable from the LAN.
  server.listen(opts.port, '127.0.0.1', () => {
    const proxyUrl = `http://localhost:${opts.port}`;
    console.log('');
    console.log('  \x1b[36m\x1b[1mOriginmain\x1b[0m proxy running');
    console.log('');
    console.log(`  Target:  ${opts.target}`);
    console.log(`  Proxy:   \x1b[1m${proxyUrl}\x1b[0m`);
    if (opts.indexUrl) {
      console.log(`  Indexer: \x1b[1m${opts.indexUrl}\x1b[0m`);
    }
    console.log('');
    console.log('  Paste the proxy URL into your Originmain artboard\'s');
    console.log('  "Connect app" field to enable live rendering.');
    console.log('');
    console.log('  \x1b[2mFiber hook injection ........ active\x1b[0m');
    console.log('  \x1b[2mX-Frame-Options stripping ... active\x1b[0m');
    console.log('  \x1b[2mWebSocket passthrough ....... active\x1b[0m');
    console.log(opts.indexUrl
      ? '  \x1b[2mAST indexer ................. active\x1b[0m'
      : '  \x1b[2mAST indexer ................. disabled (--no-index)\x1b[0m',
    );
    if (isHttps) {
      console.log('  \x1b[2mHTTPS → HTTP bridge ......... active\x1b[0m');
    }
    console.log('');
  });

  return {
    close() {
      server.close();
    },
  };
}
