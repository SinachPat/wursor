// ── Reverse Proxy ────────────────────────────────────────────────────────────
// HTTP reverse proxy that:
//   1. Forwards all requests to the target dev server
//   2. Strips X-Frame-Options and CSP frame-ancestors from responses
//   3. Injects the Originmain fiber hook into HTML responses
//   4. Passes WebSocket upgrades through for HMR
//
// Uses only Node.js built-ins — no external dependencies.

import { createServer, request as httpRequest } from 'node:http';
import { connect as netConnect } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { injectFiberHook } from './inject.js';

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

/** CORS headers added to every response for cross-origin API compatibility. */
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-credentials': 'true',
};

/**
 * Start the reverse proxy server.
 * Returns a cleanup function that shuts down the server.
 */
export function startProxy(opts: ProxyOptions): { close: () => void } {
  const targetUrl = new URL(opts.target);
  const targetHost = targetUrl.hostname;
  const targetPort = parseInt(targetUrl.port || '80', 10);

  const server = createServer((clientReq: IncomingMessage, clientRes: ServerResponse) => {
    // ── Build the outgoing request to the target ─────────────────────────

    // Clone headers, stripping Accept-Encoding so the target sends
    // uncompressed HTML (avoids needing to decompress before injection).
    const outHeaders: Record<string, string | string[]> = {};
    for (const [key, val] of Object.entries(clientReq.headers)) {
      if (key.toLowerCase() === 'accept-encoding') continue;
      if (key.toLowerCase() === 'host') {
        outHeaders[key] = `${targetHost}:${targetPort}`;
        continue;
      }
      if (val !== undefined) {
        outHeaders[key] = val;
      }
    }

    const proxyReq = httpRequest(
      {
        hostname: targetHost,
        port: targetPort,
        path: clientReq.url ?? '/',
        method: clientReq.method,
        headers: outHeaders,
      },
      (proxyRes) => {
        // ── Process response headers ───────────────────────────────────

        const resHeaders: Record<string, string | string[]> = {};

        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
          if (val !== undefined) {
            resHeaders[key] = val;
          }
        }

        // Add CORS headers
        for (const [key, val] of Object.entries(CORS_HEADERS)) {
          resHeaders[key] = val;
        }

        // ── Determine if this is an HTML response ──────────────────────

        const contentType = (proxyRes.headers['content-type'] ?? '').toLowerCase();
        const isHtml = contentType.includes('text/html');

        if (!isHtml) {
          // Non-HTML: stream through unchanged (headers already stripped)
          clientRes.writeHead(proxyRes.statusCode ?? 200, resHeaders);
          proxyRes.pipe(clientRes);
          return;
        }

        // HTML: buffer the full body, inject the script, then send.
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const rawHtml = Buffer.concat(chunks).toString('utf-8');
          const injectedHtml = injectFiberHook(rawHtml);
          const body = Buffer.from(injectedHtml, 'utf-8');

          // Update Content-Length to match the injected body
          resHeaders['content-length'] = String(body.byteLength);
          // Remove Transfer-Encoding: chunked since we send the full body
          delete resHeaders['transfer-encoding'];

          clientRes.writeHead(proxyRes.statusCode ?? 200, resHeaders);
          clientRes.end(body);
        });
      },
    );

    proxyReq.on('error', (err) => {
      console.error(`[originmain proxy] Target request failed: ${err.message}`);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'content-type': 'text/plain' });
      }
      clientRes.end(`Originmain proxy: could not reach target at ${opts.target}\n${err.message}`);
    });

    // Pipe the client request body to the target
    clientReq.pipe(proxyReq);
  });

  // ── WebSocket upgrade passthrough (for HMR) ─────────────────────────────

  server.on('upgrade', (req: IncomingMessage, clientSocket: Socket, head: Buffer) => {
    // Open a TCP connection to the target and forward the HTTP upgrade
    const targetSocket = netConnect(targetPort, targetHost, () => {
      // Reconstruct the raw HTTP upgrade request
      const reqLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      const headers = Object.entries(req.headers)
        .filter(([key]) => key.toLowerCase() !== 'host')
        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val ?? ''}`)
        .join('\r\n');
      const hostHeader = `host: ${targetHost}:${targetPort}`;

      targetSocket.write(`${reqLine}${hostHeader}\r\n${headers}\r\n\r\n`);
      if (head.length > 0) {
        targetSocket.write(head);
      }

      // Pipe bidirectionally
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
      console.error(`[originmain proxy] WebSocket proxy error: ${err.message}`);
      clientSocket.destroy();
    });

    clientSocket.on('error', () => {
      targetSocket.destroy();
    });
  });

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
    console.log('');
  });

  return {
    close() {
      server.close();
    },
  };
}
