#!/usr/bin/env node
// ── originmain login ──────────────────────────────────────────────────────────
//
// Browser-based OAuth flow for the Originmain CLI.
//
// Flow:
//   1. Start a local HTTP server on a random port (callback receiver).
//   2. Print the auth URL and attempt to open it in the default browser.
//   3. Wait for the browser to redirect back with token + workspaceId.
//   4. Write { workspaceToken, workspaceId, bridgeUrl } to ~/.originmain/config.json.
//
// The app-side endpoint is GET /api/cli-auth?callback=<callbackUrl>.
// On success it redirects to <callbackUrl>?token=X&workspaceId=Y&bridgeUrl=Z.
//
// spec: SOURCE-AWARE-CANVAS.md Phase 5 §8.6

import { createServer }                              from 'node:http';
import type { Server }                               from 'node:http';
import { resolve, dirname }                          from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execFile }                                  from 'node:child_process';

// ── Config paths ──────────────────────────────────────────────────────────────

function getConfigPath(): string {
  const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
  return resolve(homeDir, '.originmain', 'config.json');
}

function readConfig(): Record<string, unknown> {
  const p = getConfigPath();
  try {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch { /* ignore corrupt config */ }
  return {};
}

function writeConfig(data: Record<string, unknown>): void {
  const p = getConfigPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...readConfig(), ...data }, null, 2), 'utf-8');
}

// ── Browser open ──────────────────────────────────────────────────────────────
// Uses execFile (not exec) so no shell is invoked — eliminates injection risk.

function openBrowser(url: string): void {
  let bin:  string;
  let args: string[];

  if (process.platform === 'darwin') {
    bin  = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    // `start` is a shell built-in; delegate to cmd /c
    bin  = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    bin  = 'xdg-open';
    args = [url];
  }

  execFile(bin, args, (err) => {
    if (err) {
      console.log('  Could not open browser automatically. Please visit the URL above manually.');
    }
  });
}

// ── Local callback server ─────────────────────────────────────────────────────

interface CallbackResult {
  token:       string;
  workspaceId: string;
  bridgeUrl:   string;
}

function startCallbackServer(): Promise<{
  server: Server;
  port:   number;
  result: Promise<CallbackResult>;
}> {
  return new Promise((resolveOuter) => {
    let resolveResult: (r: CallbackResult) => void;
    let rejectResult:  (e: Error) => void;
    const result = new Promise<CallbackResult>((res, rej) => {
      resolveResult = res;
      rejectResult  = rej;
    });

    const server = createServer((req, res) => {
      try {
        const url       = new URL(req.url ?? '/', 'http://localhost');
        const token       = url.searchParams.get('token');
        const workspaceId = url.searchParams.get('workspaceId');
        const bridgeUrl   = url.searchParams.get('bridgeUrl') ?? 'http://localhost:4172';
        const errorMsg    = url.searchParams.get('error');

        if (errorMsg) {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(htmlPage('Login failed',
            `<p style="color:#f55">Error: ${escHtml(errorMsg)}</p><p>You can close this tab.</p>`));
          rejectResult(new Error(errorMsg));
          return;
        }

        if (!token || !workspaceId) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
          res.end(htmlPage('Invalid callback',
            '<p style="color:#f55">Missing token or workspaceId. Please try again.</p>'));
          return;
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(htmlPage('Login successful',
          '<p style="color:#4f4">&#x2713; Logged in! You can close this tab and return to the terminal.</p>'));

        resolveResult({ token, workspaceId, bridgeUrl });
      } catch (err) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Callback server error');
        rejectResult(err instanceof Error ? err : new Error(String(err)));
      }
    });

    // Bind to port 0 so the OS assigns a free port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 4173;
      resolveOuter({ server, port, result });
    });
  });
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escHtml(title)} — Originmain CLI</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #111; color: #eee;
           padding: 2rem; max-width: 480px; margin: auto; }
    h2   { margin-top: 0; }
  </style>
</head>
<body>
  <h2>Originmain CLI</h2>
  ${body}
</body>
</html>`;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export interface LoginOptions {
  /** Base URL of the Originmain web app (default: https://app.originmain.io). */
  appUrl?:  string;
  /** Milliseconds to wait for the browser callback before giving up (default: 120 000). */
  timeout?: number;
}

export async function runLogin(opts: LoginOptions = {}): Promise<void> {
  const appUrl  = (
    opts.appUrl ??
    process.env['ORIGINMAIN_APP_URL'] ??
    'https://app.originmain.io'
  ).replace(/\/$/, '');
  const timeout = opts.timeout ?? 120_000;

  console.log('');
  console.log('  \x1b[36m\x1b[1mOriginmain Login\x1b[0m');
  console.log('');

  const { server, port, result } = await startCallbackServer();
  const callbackUrl = `http://localhost:${port}/`;
  const authUrl     = `${appUrl}/api/cli-auth?callback=${encodeURIComponent(callbackUrl)}`;

  console.log('  Opening your browser to complete login…');
  console.log('');
  console.log('  \x1b[2mIf the browser does not open automatically, visit:\x1b[0m');
  console.log(`  \x1b[1m${authUrl}\x1b[0m`);
  console.log('');

  openBrowser(authUrl);

  // Race the callback against the timeout
  const timeoutPromise = new Promise<never>((_, rej) =>
    setTimeout(
      () => rej(new Error(`Login timed out after ${timeout / 1000}s — no callback received.`)),
      timeout,
    ),
  );

  let callbackData: CallbackResult;
  try {
    callbackData = await Promise.race([result, timeoutPromise]);
  } finally {
    server.close();
  }

  // Persist credentials to ~/.originmain/config.json
  writeConfig({
    workspaceToken: callbackData.token,
    workspaceId:    callbackData.workspaceId,
    bridgeUrl:      callbackData.bridgeUrl,
  });

  const configPath = getConfigPath();
  console.log(`  \x1b[32m✓\x1b[0m Logged in — workspace \x1b[1m${callbackData.workspaceId.slice(0, 8)}…\x1b[0m`);
  console.log(`  \x1b[2mCredentials saved to ${configPath}\x1b[0m`);
  console.log('');
  console.log('  You can now run \x1b[1moriginmain dev --target http://localhost:3000\x1b[0m');
  console.log('');
}
