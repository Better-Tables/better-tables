import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'localhost' }],
  },
  // Turbopack (Next 16 default) auto-transpiles workspace packages from source,
  // which breaks each package's internal `@/*` path aliases. Resolve to dist instead.
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      '@better-tables/core': '../../packages/core/dist/index.mjs',
      '@better-tables/ui': '../../packages/ui/dist/index.mjs',
      '@better-tables/adapters-drizzle': '../../packages/adapters/drizzle/dist/index.mjs',
    },
  },
};

export default nextConfig;
