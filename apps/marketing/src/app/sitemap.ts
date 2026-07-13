import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const domain = headersList.get('host') as string;
  const protocol = 'https';

  return [
    {
      url: `${protocol}://${domain}`,
      lastModified: new Date(),
    },
    {
      url: `${protocol}://${domain}/examples`,
      lastModified: new Date(),
    },
    {
      url: `${protocol}://${domain}/examples/relationship-filtering`,
      lastModified: new Date(),
    },
    {
      url: `${protocol}://${domain}/examples/query-groups`,
      lastModified: new Date(),
    },
    {
      url: `${protocol}://${domain}/examples/big-board`,
      lastModified: new Date(),
    },
    {
      url: `${protocol}://${domain}/examples/facets`,
      lastModified: new Date(),
    },
    {
      url: `${protocol}://${domain}/blog`,
      lastModified: new Date(),
    },
  ];
}
