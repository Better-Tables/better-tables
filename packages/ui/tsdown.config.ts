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
]);
