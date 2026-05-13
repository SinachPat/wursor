# @originmain/live

Browser SDK for [Originmain](https://originmain.com) — installs the React fiber hook that enables live component inspection and design editing in the Originmain canvas.

## Installation

```bash
npm install @originmain/live
# or
pnpm add @originmain/live
```

## Usage

Import **before React** in your app entry point:

```ts
// app/layout.tsx (or pages/_app.tsx)
import '@originmain/live';   // ← must be first
import React from 'react';
// ...
```

Or use the [`@originmain/next`](https://www.npmjs.com/package/@originmain/next) plugin which injects it automatically:

```ts
// next.config.ts
import { withOriginmain } from '@originmain/next';
export default withOriginmain({ reactStrictMode: true });
```

## How it works

- Installs `__REACT_DEVTOOLS_GLOBAL_HOOK__` **before** React evaluates (module load time), so React captures fiber commits from the very first render.
- Activates **only** when the page runs inside an Originmain artboard iframe (detected via `#__om_artboard=<id>` in the URL fragment).
- **Complete no-op** in production or any non-Originmain context — zero runtime cost.

## License

MIT
