import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/sqlite-setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.d.ts', '**/*.config.*', 'dist/'],
    },
  },
  resolve: {
    alias: {
      '@better-tables/core': resolve(__dirname, '../core/src'),
    },
  },
});
