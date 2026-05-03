// -- HTML Injection ----------------------------------------------------------
// Injects the Originmain fiber hook <script> into an HTML response body.
// The script must appear BEFORE any other scripts so that
// __REACT_DEVTOOLS_GLOBAL_HOOK__ is installed before React evaluates.
//
// Also injects window.__OM_INDEX_URL__ (AST indexer API) and
// window.__OM_ISO_BASE__ (isolation artboard base path) so the canvas can
// discover the indexer without any out-of-band coordination.

import { buildProxyFiberHookScript } from '@originmain/renderer';

/** The fiber hook script wrapped in a <script> tag, generated once at startup. */
let cachedFiberTag: string | undefined;

function getFiberTag(): string {
  if (cachedFiberTag === undefined) {
    cachedFiberTag = `<script data-originmain-fiber-hook>${buildProxyFiberHookScript()}</script>`;
  }
  return cachedFiberTag;
}

/**
 * Build the bridge config <script> tag.
 * Not cached because indexUrl may vary per process invocation.
 */
function getBridgeConfigTag(indexUrl: string | null | undefined): string {
  const indexUrlJson = indexUrl ? JSON.stringify(indexUrl) : 'null';
  return (
    `<script data-originmain-bridge-config>` +
    `window.__OM_INDEX_URL__=${indexUrlJson};` +
    `window.__OM_ISO_BASE__="/__om_isolation__";` +
    `</script>`
  );
}

/**
 * Strip inline Content-Security-Policy meta tags from HTML.
 */
function stripMetaCsp(html: string): string {
  return html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?\s*content-security-policy\s*["']?[^>]*\/?>/gi,
    '',
  );
}

/**
 * Inject the fiber hook + bridge config scripts into an HTML string.
 */
export function injectFiberHook(html: string, indexUrl?: string | null): string {
  const injection = getBridgeConfigTag(indexUrl) + getFiberTag();
  const cleaned   = stripMetaCsp(html);

  // Try after <head>
  const headMatch = cleaned.match(/<head[^>]*>/i);
  if (headMatch?.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return cleaned.slice(0, insertAt) + injection + cleaned.slice(insertAt);
  }

  // Try after <html>
  const htmlMatch = cleaned.match(/<html[^>]*>/i);
  if (htmlMatch?.index !== undefined) {
    const insertAt = htmlMatch.index + htmlMatch[0].length;
    return cleaned.slice(0, insertAt) + injection + cleaned.slice(insertAt);
  }

  // Final fallback: prepend
  return injection + cleaned;
}
