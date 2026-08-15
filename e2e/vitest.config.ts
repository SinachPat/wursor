import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['golden/**/*.test.ts'],
  },
});
