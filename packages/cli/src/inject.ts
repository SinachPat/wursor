// -- HTML Injection ----------------------------------------------------------
// Injects the Originmain fiber hook into an HTML response body as an
// EXTERNAL script tag (<script src="/__om_fiber_hook__.js">) rather than as
// an inline script. External scripts survive several blocking conditions that
// inline scripts hit in the wild:
//   • CSPs without 'unsafe-inline' (script-src 'self' is widely allowed)
//   • React 19 hydration removing unmanaged <head> children
//   • Browser-extension inline-script filters
// The script body itself is served at /__om_fiber_hook__.js by the proxy
// (see proxy.ts). The bridge-config globals (__OM_INDEX_URL__,
// __OM_ISO_BASE__) are baked into the head of that served script, so we don't
// need a separate inline configuration tag in the HTML at all.
//
// We also inject the script tag in TWO positions for redundancy:
// immediately after <head> (so it runs as early as possible, ideally before
// any other scripts) AND immediately before </body> (a fallback in case the
// first injection is interfered with — e.g. removed during React hydration).
// The script's IIFE has internal idempotency guards so a double-execution is
// harmless.

import { buildProxyFiberHookScript } from '@originmain/renderer';

/**
 * The full content served at /__om_fiber_hook__.js — bridge globals followed
 * by the fiber-hook IIFE. The proxy writes this directly into the JS response.
 */
export function buildFiberHookExternalScript(
  indexUrl: string | null | undefined,
): string {
  const indexUrlJson = indexUrl ? JSON.stringify(indexUrl) : 'null';
  return (
    `window.__OM_INDEX_URL__=${indexUrlJson};` +
    `window.__OM_ISO_BASE__="/__om_isolation__";\n` +
    buildProxyFiberHookScript()
  );
}

/**
 * The <script> tag injected into HTML — references the external endpoint.
 * Not marked async/defer so it runs in document order before any subsequent
 * script, exactly like the previous inline tag did.
 */
function getFiberTag(): string {
  return `<script src="/__om_fiber_hook__.js" data-originmain-fiber-hook></script>`;
}

/**
 * Strip inline Content-Security-Policy meta tags from HTML — both the
 * blocking variant (`Content-Security-Policy`) and the report-only variant.
 * The regex tolerates attribute reordering, optional quoting, and casing.
 */
function stripMetaCsp(html: string): string {
  return html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?\s*content-security-policy(-report-only)?\s*["']?[^>]*\/?>/gi,
    '',
  );
}

/**
 * Inject the fiber hook script tag into an HTML string.
 *
 * The `indexUrl` argument is no longer needed in the injected HTML (the script
 * body that bakes it in is fetched separately at /__om_fiber_hook__.js).
 * It is accepted for API compatibility with the proxy's previous call shape.
 */
export function injectFiberHook(html: string, _indexUrl?: string | null): string {
  const tag     = getFiberTag();
  const cleaned = stripMetaCsp(html);

  // ── Primary injection: immediately after <head> ─────────────────────────
  let withHead = cleaned;
  const headMatch = cleaned.match(/<head[^>]*>/i);
  if (headMatch?.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    withHead = cleaned.slice(0, insertAt) + tag + cleaned.slice(insertAt);
  } else {
    // No <head>? Try after <html> as a fallback.
    const htmlMatch = cleaned.match(/<html[^>]*>/i);
    if (htmlMatch?.index !== undefined) {
      const insertAt = htmlMatch.index + htmlMatch[0].length;
      withHead = cleaned.slice(0, insertAt) + tag + cleaned.slice(insertAt);
    } else {
      // Last resort: prepend.
      withHead = tag + cleaned;
    }
  }

  // ── Redundant injection: immediately before </body> ─────────────────────
  // Provides a fallback if the head-position tag is interfered with (e.g.
  // removed during React 19 hydration of <head>). The script's IIFE is
  // idempotent — a second execution after the first ran is a no-op.
  const bodyCloseIdx = withHead.lastIndexOf('</body>');
  if (bodyCloseIdx >= 0) {
    return withHead.slice(0, bodyCloseIdx) + tag + withHead.slice(bodyCloseIdx);
  }

  return withHead;
}
