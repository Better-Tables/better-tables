import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// Load .env file from the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Exclude SQLite tests in CI (better-sqlite3 requires native bindings)
    exclude: [
      'node_modules/',
      'dist/',
      // Exclude SQLite tests when CI env is set or better-sqlite3 is not available
      ...(process.env.CI === 'true' || process.env.DISABLE_SQLITE === 'true'
        ? ['**/*sqlite*.test.ts', '**/query-builder.test.ts']
        : []),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.d.ts', '**/*.config.*', 'dist/'],
    },
  },
});
