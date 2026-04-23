import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/diff-engine',
      'packages/origin-graph',
      'packages/ai-layer',
      'packages/agent-bridge',
    ],
    coverage: {
      provider: 'v8',
      thresholds: {
        // diff-engine and origin-graph have higher gates per the spec
      },
    },
  },
});
