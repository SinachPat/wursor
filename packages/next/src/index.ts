// ── @originmain/next ──────────────────────────────────────────────────────────
// Next.js plugin that injects @originmain/live before React loads, enabling
// the Originmain canvas to inspect React component trees in real-time.
//
// Usage (next.config.ts or next.config.js):
//
//   import { withOriginmain } from '@originmain/next';
//
//   const nextConfig = { /* your config */ };
//   export default withOriginmain(nextConfig);
//
// What it does:
//   1. Prepends `import '@originmain/live'` to every page entry point at build
//      time via webpack entry modification.
//   2. The live SDK installs __REACT_DEVTOOLS_GLOBAL_HOOK__ before React's module
//      body evaluates, so React captures component commits from the very first render.
//   3. The hook is a complete no-op when the app is NOT running inside an
//      Originmain artboard iframe — zero runtime cost in production.
//
// Environment:
//   The SDK activates ONLY when the page is rendered inside an Originmain iframe
//   (detected via URL fragment: #__om_artboard=<id>). No opt-in flag or env var
//   needed — it self-activates in the right context and stays dormant otherwise.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextConfig = Record<string, any>;

/** The entry point that installs the Originmain fiber hook before React. */
const LIVE_SDK_ENTRY = '@originmain/live';

/**
 * Wraps a Next.js config to inject the Originmain live SDK into every page
 * entry point. The SDK is a no-op outside Originmain artboard iframes.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withOriginmain } from '@originmain/next';
 * export default withOriginmain({ reactStrictMode: true });
 * ```
 */
export function withOriginmain(nextConfig: NextConfig = {}): NextConfig {
  return {
    ...nextConfig,

    webpack(
      config: WebpackConfig,
      context: { buildId: string; dev: boolean; isServer: boolean; nextRuntime?: string },
    ) {
      // Only patch the client-side bundle. The fiber hook is browser-only.
      // isServer covers both Node.js runtime and Edge runtime (nextRuntime).
      if (!context.isServer) {
        config.entry = prependLiveSdk(config.entry);
      }

      // Delegate to any existing webpack customisation in the user's config.
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, context);
      }
      return config;
    },
  };
}

// ── Entry prepend helper ──────────────────────────────────────────────────────
// Next.js entry can be a plain object, a function returning an object, or a
// function returning a Promise. We wrap all three shapes uniformly.

type EntryValue  = string | string[] | EntryObject;
type EntryObject = Record<string, string | string[]>;
type EntryFn     = () => EntryValue | Promise<EntryValue>;
type Entry       = EntryValue | EntryFn;

function prependLiveSdk(entry: Entry): EntryFn {
  return async () => {
    const resolved = typeof entry === 'function' ? await entry() : entry;
    return injectIntoEntries(resolved as EntryObject);
  };
}

function injectIntoEntries(entries: EntryObject): EntryObject {
  const out: EntryObject = {};
  for (const [key, value] of Object.entries(entries)) {
    out[key] = prependToChunk(value);
  }
  return out;
}

function prependToChunk(chunk: string | string[]): string[] {
  const arr = Array.isArray(chunk) ? chunk : [chunk];
  // Avoid duplicating if already present (e.g. running withOriginmain twice).
  if (arr.includes(LIVE_SDK_ENTRY)) return arr;
  return [LIVE_SDK_ENTRY, ...arr];
}

// ── Minimal webpack types (avoids adding webpack as a dev dep) ────────────────

interface WebpackConfig {
  entry: Entry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
