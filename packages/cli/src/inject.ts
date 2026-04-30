// ── HTML Injection ───────────────────────────────────────────────────────────
// Injects the Originmain fiber hook <script> into an HTML response body.
// The script must appear BEFORE any other scripts so that
// __REACT_DEVTOOLS_GLOBAL_HOOK__ is installed before React evaluates.

import { buildProxyFiberHookScript } from '@originmain/renderer';

/** The fiber hook script wrapped in a <script> tag, generated once at startup. */
let cachedScriptTag: string | undefined;

function getScriptTag(): string {
  if (cachedScriptTag === undefined) {
    cachedScriptTag = `<script data-originmain-fiber-hook>${buildProxyFiberHookScript()}</script>`;
  }
  return cachedScriptTag;
}

/**
 * Strip inline Content-Security-Policy meta tags from HTML.
 *
 * The proxy already removes the CSP response header, but some frameworks
 * (e.g. Next.js with a custom _document) also embed CSP inside a meta tag.
 * A meta CSP applies to the entire document — including scripts parsed before
 * it — so our injected hook can be silently blocked even though it runs first.
 * Removing these tags lets the hook execute freely inside the sandboxed iframe.
 */
function stripMetaCsp(html: string): string {
  return html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?\s*content-security-policy\s*["']?[^>]*\/?>/gi,
    '',
  );
}

/**
 * Inject the fiber hook script into an HTML string.
 *
 * Steps:
 * 1. Strip any inline Content-Security-Policy meta tags that could block the
 *    injected script (the CSP response header is stripped by the proxy itself).
 * 2. Insert the hook script immediately after the opening <head> tag
 *    (preferred), after <html> (fallback), or prepend to the document (final
 *    fallback). Placing it first ensures __REACT_DEVTOOLS_GLOBAL_HOOK__ is
 *    registered before React's module body runs.
 */
export function injectFiberHook(html: string): string {
  const tag     = getScriptTag();
  const cleaned = stripMetaCsp(html);

  // Try after <head>
  const headMatch = /<head[^>]*>/i.exec(cleaned);
  if (headMatch) {
    const insertAt = headMatch.index + headMatch[0].length;
    return cleaned.slice(0, insertAt) + tag + cleaned.slice(insertAt);
  }

  // Try after <html>
  const htmlMatch = /<html[^>]*>/i.exec(cleaned);
  if (htmlMatch) {
    const insertAt = htmlMatch.index + htmlMatch[0].length;
    return cleaned.slice(0, insertAt) + tag + cleaned.slice(insertAt);
  }

  // Final fallback: prepend
  return tag + cleaned;
}
