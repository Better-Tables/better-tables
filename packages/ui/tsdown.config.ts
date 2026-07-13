import { defineConfig } from 'tsdown';

const isWatch = process.argv.includes('--watch');

/**
 * Unbundle (file-to-file) emit so per-file `'use client'` directives survive.
 * A single bundled entry previously required a global banner because Rolldown
 * strips leading directives from bundled chunks (plan 009).
 *
 * ESM-only: this package is React UI for bundlers/Next, not a Node CJS consumer.
 */
export default defineConfig({
  entry: ['src/**/*.ts', 'src/**/*.tsx', '!**/*.test.ts', '!**/*.test.tsx'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  unbundle: true,
  clean: !isWatch,
  // Dependencies stay external; consumers / Next transpilePackages resolve them.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    /^@better-tables\//,
    /^@base-ui\//,
    /^@dnd-kit\//,
    'lucide-react',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    'cmdk',
    'date-fns',
    /^date-fns\//,
    'lz-string',
    'react-day-picker',
    'zustand',
    /^zustand\//,
    'shadcn',
  ],
});
