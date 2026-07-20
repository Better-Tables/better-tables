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
    lastModified: page.data.lastModified ?? new Date(),
  }));

  return [...staticRoutes, ...blogRoutes, ...docsRoutes];
}
