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
import { injectFiberHook }                      from './inject.js';

export interface ProxyOptions {
  /** Target dev server URL, e.g. "http://localhost:3000" */
  target: string;
  /** Port for the proxy to listen on (default: 4170) */
  port: number;
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

  const server = createServer((clientReq: IncomingMessage, clientRes: ServerResponse) => {
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
          const injectedHtml = injectFiberHook(rawHtml);
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

  server.listen(opts.port, () => {
    const proxyUrl = `http://localhost:${opts.port}`;
    console.log('');
    console.log('  \x1b[36m\x1b[1mOriginmain\x1b[0m proxy running');
    console.log('');
    console.log(`  Target:  ${opts.target}`);
    console.log(`  Proxy:   \x1b[1m${proxyUrl}\x1b[0m`);
    console.log('');
    console.log('  Paste the proxy URL into your Originmain artboard\'s');
    console.log('  "Connect app" field to enable live rendering.');
    console.log('');
    console.log('  \x1b[2mFiber hook injection ........ active\x1b[0m');
    console.log('  \x1b[2mX-Frame-Options stripping ... active\x1b[0m');
    console.log('  \x1b[2mWebSocket passthrough ....... active\x1b[0m');
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
