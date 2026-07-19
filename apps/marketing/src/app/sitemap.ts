import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getBlogPosts } from '@/lib/blog';

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
    '/docs',
    '/blog',
  ].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));

  const posts = await getBlogPosts();
  const blogRoutes = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
  }));

  return [...staticRoutes, ...blogRoutes];
}
