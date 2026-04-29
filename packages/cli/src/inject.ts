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
 * Inject the fiber hook script into an HTML string.
 *
 * Injection strategy (in order of preference):
 * 1. After `<head...>` — standard position for early scripts
 * 2. After `<html...>` — fallback if <head> is missing
 * 3. Prepend to document — final fallback
 */
export function injectFiberHook(html: string): string {
  const tag = getScriptTag();

  // Try after <head>
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + tag + html.slice(insertAt);
  }

  // Try after <html>
  const htmlMatch = /<html[^>]*>/i.exec(html);
  if (htmlMatch) {
    const insertAt = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, insertAt) + tag + html.slice(insertAt);
  }

  // Final fallback: prepend
  return tag + html;
}
