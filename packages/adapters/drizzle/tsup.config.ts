import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: [
    'react',
    'react-dom',
    'postgres',
    'mysql2',
    'better-sqlite3'
  ],
  esbuildOptions(options) {
    // Remove the "use client" banner to keep this as a server-side adapter
    // options.banner = {
    //   js: '"use client"',
    // };
  },
});
