// ── Isolation Server (Phase 3 stub) ──────────────────────────────────────────
// Serves `/__om_isolation__` wrapper pages that render a single component in
// isolation (component artboard type). Full implementation ships in Phase 3.
//
// Current status: 501 stub that tells the user Phase 3 is required.
// The proxy delegates all /__om_isolation__ requests here.

import type { IncomingMessage, ServerResponse } from 'node:http';

const STUB_BODY = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head><meta charset="UTF-8" /><title>Isolation artboard — not yet available</title>',
  '<style>body{margin:0;background:#0d0d11;color:rgba(255,255,255,0.6);',
  'font:13px/1.6 ui-monospace,monospace;display:flex;align-items:center;',
  'justify-content:center;height:100vh;text-align:center;}</style></head>',
  '<body>',
  '<div>',
  '  <p style="font-size:1.1rem;color:rgba(255,255,255,0.85)">',
  '    Isolation artboards require the CLI AST indexer',
  '  </p>',
  '  <p>Start <code style="color:#7EB8FF">originmain dev</code> without ',
  '    <code style="color:#7EB8FF">--no-index</code> to enable isolation frames.</p>',
  '</div>',
  '</body></html>',
].join('\n');

/** Handles any request to /__om_isolation__/* — returns a 501 stub page. */
export function handleIsolationRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  res.writeHead(501, {
    'content-type':  'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(STUB_BODY);
}
