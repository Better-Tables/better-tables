import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@better-tables/core',
    '@better-tables/ui',
    '@better-tables/adapters-drizzle',
  ],
};

export default nextConfig;
