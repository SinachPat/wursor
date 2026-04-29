// @originmain/live — Originmain fiber hook for live component inspection.
//
// Usage:
//   import '@originmain/live';  // MUST be before any React import
//   import React from 'react';
//   ...
//
// This is a side-effect-only import. It installs __REACT_DEVTOOLS_GLOBAL_HOOK__
// before React evaluates, enabling Originmain to inspect the component tree,
// read props, and generate diffs. The hook only activates when the app is
// rendered inside an Originmain artboard iframe — otherwise it is a complete
// no-op with zero runtime cost.

import './hook.js';
