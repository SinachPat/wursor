# @originmain/cli

A reverse proxy that enables live React component inspection inside [Originmain](https://originmain.sinachpat.com) artboards.

Point it at your running dev server and paste the proxy URL into an artboard's **Connect app** field. From that point on, Originmain can read your component tree in real time, highlight selected components, and push design tokens into the running app — without any changes to your source code.

---

## Requirements

- Node.js ≥ 22
- A running React dev server (Next.js, Vite, Remix, etc.)

---

## Quick start

```bash
npx @originmain/cli dev --target http://localhost:3000
```

The proxy starts on port **4170** by default and prints its URL:

```
  Originmain proxy running

  Target:  http://localhost:3000
  Proxy:   http://localhost:4170

  Paste the proxy URL into your Originmain artboard's
  "Connect app" field to enable live rendering.

  Fiber hook injection ........ active
  X-Frame-Options stripping ... active
  WebSocket passthrough ....... active
```

Paste `http://localhost:4170` into the artboard. Done.

---

## Usage

```
originmain dev --target <url> [--port <number>]
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--target` | `-t` | *(required)* | URL of your dev server — `http://` or `https://` |
| `--port` | `-p` | `4170` | Port the proxy listens on |
| `--help` | `-h` | | Print usage |

### Examples

```bash
# Default port
npx @originmain/cli dev --target http://localhost:3000

# Custom port
npx @originmain/cli dev --target http://localhost:5173 --port 4200

# HTTPS dev server (self-signed certs are accepted)
npx @originmain/cli dev --target https://localhost:3000

# Short flags
npx @originmain/cli dev -t http://localhost:3000 -p 4200
```

If port 4170 is already in use the CLI prints a clear error and suggests the next port:

```
  Error: Port 4170 is already in use.
  Try a different port: originmain dev --target http://localhost:3000 --port 4171
```

---

## What the proxy does

| Feature | Detail |
|---------|--------|
| **Fiber hook injection** | Inserts a small script before any other scripts in every HTML response. React detects it as a DevTools hook and reports every component commit. |
| **X-Frame-Options removal** | Strips `X-Frame-Options` and `Content-Security-Policy` response headers so the app can load inside the Originmain iframe. Also removes inline CSP `<meta>` tags that some frameworks embed in the HTML. |
| **WebSocket passthrough** | Forwards HMR upgrade requests directly to the dev server so hot reload keeps working. |
| **HTTPS support** | Accepts self-signed certificates from local HTTPS dev servers (`rejectUnauthorized: false`). |
| **CORS headers** | Appends permissive CORS headers to every response so the canvas can reach the app. |

The proxy makes no changes to your source files and stops completely when you `Ctrl-C`.

---

## Global install (optional)

```bash
npm install -g @originmain/cli
originmain dev --target http://localhost:3000
```

---

## Programmatic API

```ts
import { startProxy, injectFiberHook } from '@originmain/cli'
```

### `startProxy(options)`

Starts the proxy server and returns a `{ close() }` handle.

```ts
import { startProxy } from '@originmain/cli'

const proxy = startProxy({
  target: 'http://localhost:3000',
  port: 4170,
})

// Later:
proxy.close()
```

**Options**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `target` | `string` | *(required)* | Dev server URL |
| `port` | `number` | `4170` | Port to listen on |

### `injectFiberHook(html)`

Injects the fiber hook `<script>` into an HTML string and returns the modified HTML. Useful if you are building a custom proxy or middleware.

```ts
import { injectFiberHook } from '@originmain/cli'

const modified = injectFiberHook(rawHtml)
```

---

## How it works

When a browser (the Originmain iframe) loads a page through the proxy, the proxy:

1. Strips `X-Frame-Options` and CSP headers so the iframe is allowed.
2. Buffers the HTML response and inserts the fiber hook script immediately after the opening `<head>` tag — before any other scripts.
3. The script installs `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` before React evaluates, so React registers its renderer with the hook on startup.
4. On every React commit the hook serializes the component tree and posts it to the parent frame via `postMessage`.
5. Artboard selection and design token updates flow back into the app through the same channel.

WebSocket connections (used by Next.js, Vite, and other bundlers for HMR) are tunnelled directly to the target server so hot reload is unaffected.

---

## License

MIT
