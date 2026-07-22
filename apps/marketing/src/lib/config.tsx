export const siteConfig = {
  name: 'Better Tables',
  tagline: 'React tables that reach your database',
  description:
    'React tables that compile filters, sorts, and edits into real SQL for Postgres, MySQL, or SQLite — UI you own.',
  cta: 'Browse examples',
  // Absolute base for metadata/OG image URLs. Prefer an explicit override, then
  // Vercel's production domain, then the per-deployment URL, else localhost.
  // Without this, og:image resolves to http://localhost:3000/og in production
  // and social crawlers can't fetch it.
  url:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:3000',
  installCommand: 'npx @better-tables/cli@latest init',
  keywords: [
    'Better Tables',
    'React table library',
    'data table',
    'Drizzle ORM',
    'server-side filtering',
    'shadcn table',
    'type-safe tables',
    'admin table React',
  ],
  links: {
    github: 'https://github.com/Better-Tables/better-tables',
    npm: 'https://www.npmjs.com/package/@better-tables/core',
    issues: 'https://github.com/Better-Tables/better-tables/issues',
    license: 'https://github.com/Better-Tables/better-tables/blob/main/LICENSE',
    contributing: 'https://github.com/Better-Tables/better-tables/blob/main/CONTRIBUTING.md',
  },
  nav: [
    { href: '/examples', label: 'Examples' },
    { href: '/docs', label: 'Docs' },
    { href: '/blog', label: 'Blog' },
  ],
  /** Repo paths used by "view source" links on example pages. */
  sourceBase: 'https://github.com/Better-Tables/better-tables/blob/main/apps/marketing',
};

export type SiteConfig = typeof siteConfig;
