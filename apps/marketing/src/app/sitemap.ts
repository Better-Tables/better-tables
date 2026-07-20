import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getBlogPostSummaries } from '@/lib/blog';
import { source } from '@/lib/source';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const domain = headersList.get('host') as string;
  const protocol = 'https';
  const base = `${protocol}://${domain}`;

  const staticRoutes = [
    '',
    '/examples',
    '/examples/relationship-filtering',
    '/examples/query-groups',
    '/examples/big-board',
    '/examples/facets',
    '/blog',
  ].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));

  const posts = getBlogPostSummaries();
  const blogRoutes = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
  }));

  const docsRoutes = source.getPages().map((page) => ({
    url: `${base}${page.url}`,
    // Optional for the same reason as in docs/[[...slug]]/page.tsx: the
    // git-based lastModified() transformer is off in source.config.ts.
    lastModified: (page.data as { lastModified?: Date }).lastModified ?? new Date(),
  }));

  return [...staticRoutes, ...blogRoutes, ...docsRoutes];
}
