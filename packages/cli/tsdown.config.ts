import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === 'production',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
