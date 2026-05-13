# @originmain/next

Next.js plugin for [Originmain](https://originmain.com) — automatically injects the Originmain live SDK before React loads, enabling the canvas to inspect your component tree in real time.

## Installation

```bash
npm install @originmain/next
# or
pnpm add @originmain/next
```

## Usage

Wrap your Next.js config with `withOriginmain`:

```ts
// next.config.ts
import { withOriginmain } from '@originmain/next';

const nextConfig = {
  reactStrictMode: true,
};

export default withOriginmain(nextConfig);
```

Or in CommonJS format:

```js
// next.config.js
const { withOriginmain } = require('@originmain/next');

module.exports = withOriginmain({
  reactStrictMode: true,
});
```

## What it does

1. Prepends `import '@originmain/live'` to **every page entry point** at build time via webpack entry modification.
2. The live SDK installs `__REACT_DEVTOOLS_GLOBAL_HOOK__` before React's module body evaluates — this is required for React to capture component commits.
3. The hook activates **only** when the page runs inside an Originmain artboard iframe. In all other contexts it is a complete no-op with zero runtime cost.

## Requirements

- Next.js `>=14.0.0`
- Node.js `>=18`

## License

MIT
