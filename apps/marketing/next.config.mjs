import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ hostname: 'localhost' }],
  },
  serverExternalPackages: ['oxc-transform', 'typescript', 'twoslash', 'postgres', 'better-sqlite3'],
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
  async rewrites() {
    return [
      {
        source: '/docs.mdx',
        destination: '/llms.mdx/docs/content.md',
      },
      {
        source: '/docs.md',
        destination: '/llms.mdx/docs/content.md',
      },
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
      {
        source: '/docs/:path*.md',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
};

export default withMDX(nextConfig);
