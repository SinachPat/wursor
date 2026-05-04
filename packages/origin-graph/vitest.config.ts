import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/queries.ts', 'src/client.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});
