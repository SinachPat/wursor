// @originmain/dev — server runtime
//
// Runs inside the Next.js dev server process (Node.js, not the browser).
// Connects outbound to the Originmain cloud canvas bridge via two SSE channels:
//
//   1. POST  {bridgeUrl}/api/sdk/{projectId}           ← SDK pushes fiber events
//   2. GET   {bridgeUrl}/api/sdk/{projectId}/commands  ← SDK receives canvas commands
//
// Usage (called by withOriginmain() in @originmain/next when SDK_TOKEN is set):
//
//   import { startDevServer } from '@originmain/dev/server';
//   startDevServer({
//     projectId:  process.env.ORIGINMAIN_PROJECT_ID,
//     sdkToken:   process.env.ORIGINMAIN_SDK_TOKEN,
//     bridgeUrl:  'https://originmain.com',           // or custom cloud URL
//     localUrl:   'http://localhost:3000',            // the Next.js dev server
//   });
//
// The server runtime does NOT instrument React itself — that is handled by
// @originmain/live in the browser. Instead, this runtime:
//
//   a. Forwards fiber events it receives from the browser (via localhost:3000
//      acting as a relay) to the cloud canvas bridge.
//   b. Receives edit commands from the cloud canvas bridge and applies them
//      to source files on disk (file-write capability).
//   c. Optionally applies commands to the browser via the app's own SSE relay.

import type { HostMessage } from './types.js';
import { applyEditToFile }  from './file-writer.js';

export interface DevServerOptions {
  /** Originmain project ID (from canvas URL). */
  projectId:  string;
  /** SDK token issued in project settings (POST /api/sdk/token). */
  sdkToken:   string;
  /** Root URL of the Originmain cloud canvas. Default: https://originmain.com */
  bridgeUrl?: string;
  /** URL of the local Next.js dev server. Default: http://localhost:3000 */
  localUrl?:  string;
  /** Enable verbose logging. Default: false. */
  debug?:     boolean;
}

let running = false;

/** Start the SDK dev server. Idempotent — safe to call multiple times. */
export function startDevServer(opts: DevServerOptions): void {
  if (running) return;
  running = true;

  const {
    projectId,
    sdkToken,
    bridgeUrl = 'https://originmain.com',
    debug     = false,
  } = opts;

  const log = debug ? (...args: unknown[]) => console.log('[originmain/dev]', ...args) : () => {};
  const warn = (...args: unknown[]) => console.warn('[originmain/dev]', ...args);

  log(`Connecting to bridge for project ${projectId}…`);

  void connectCommandsStream({ projectId, sdkToken, bridgeUrl, log, warn });
}

// ── Commands stream (Canvas → SDK) ────────────────────────────────────────────
// Long-lived SSE connection to GET /api/sdk/{projectId}/commands.
// Reconnects automatically on disconnect.

interface ConnectOpts {
  projectId: string;
  sdkToken:  string;
  bridgeUrl: string;
  log: (...a: unknown[]) => void;
  warn: (...a: unknown[]) => void;
}

async function connectCommandsStream(opts: ConnectOpts): Promise<void> {
  const { projectId, sdkToken, bridgeUrl, log, warn } = opts;
  const url = `${bridgeUrl}/api/sdk/${encodeURIComponent(projectId)}/commands`;
  const headers = { Authorization: `Bearer ${sdkToken}` };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      log('Subscribing to commands stream…');
      const response = await fetch(url, { headers, signal: undefined });

      if (!response.ok) {
        warn(`Commands stream returned ${response.status} — retrying in 5s`);
        await sleep(5000);
        continue;
      }

      if (!response.body) {
        warn('Commands stream has no body — retrying in 5s');
        await sleep(5000);
        continue;
      }

      log('Commands stream connected ✓');
      await readSseStream(response.body, (message) => {
        void handleCommand(message as HostMessage, opts);
      });

      // Stream ended (server closed connection) — reconnect after a short delay.
      log('Commands stream closed — reconnecting in 2s');
      await sleep(2000);

    } catch (err) {
      warn('Commands stream error:', err instanceof Error ? err.message : err);
      await sleep(5000);
    }
  }
}

// ── SSE stream reader ─────────────────────────────────────────────────────────

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onMessage: (data: unknown) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  const reader  = body.getReader();
  let   buffer  = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          onMessage(JSON.parse(raw));
        } catch { /* malformed JSON — skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

async function handleCommand(msg: HostMessage, opts: ConnectOpts): Promise<void> {
  const { log, warn } = opts;

  // Bridge status ping — not a real command.
  if ((msg as Record<string, unknown>).type === '__bridge_status__') return;

  log(`Received command: ${msg.type}`);

  switch (msg.type) {
    case 'PATCH_ELEMENT_STYLE': {
      // Apply style change to source file via callSite information.
      // The browser SDK has already applied the inline style; here we
      // write it to the source file so the change persists.
      const { nodeId, property, value } = msg;
      if (nodeId && property !== undefined && value !== undefined) {
        const result = await applyEditToFile({ nodeId, property, value });
        if (result.written) {
          log(`  → wrote ${property}: ${value} to ${result.filePath}`);
        } else {
          log(`  → no callSite for ${nodeId} — inline style applied, source unchanged`);
        }
      }
      break;
    }

    case 'NAVIGATE':
    case 'SET_DESIGN_TOKENS':
    case 'SELECT_COMPONENT':
    case 'DESELECT':
    case 'REQUEST_ELEMENT_STYLES':
    case 'CAPTURE_THUMBNAIL':
    case 'CAPTURE_SNAPSHOT':
    case 'CANCEL_SNAPSHOT':
      // These commands target the browser-side SDK (already handled via postMessage
      // when iframed). When using the bridge (non-iframe mode), these would be
      // forwarded to the browser via the local relay. Not yet implemented.
      log(`  → forwarding ${msg.type} to browser (not yet implemented)`);
      break;

    default:
      warn(`Unknown command type: ${(msg as Record<string, unknown>).type}`);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
