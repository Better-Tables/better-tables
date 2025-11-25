import { defineConfig } from 'tsdown';

const isWatch = process.argv.includes('--watch');

export default defineConfig([
  // Client bundle (with "use client" directive)
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: !isWatch, // Disable cleaning in watch mode to avoid file system conflicts
    external: ['react', 'react-dom'],
    banner: {
      js: '"use client";',
    },
  },
  // Server bundle (no "use client" directive)
  {
    entry: ['src/server.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: false, // Never clean on second build
    external: ['react', 'react-dom'],
    // No banner - this is server-only code
  },
]);
