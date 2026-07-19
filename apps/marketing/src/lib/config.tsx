export const siteConfig = {
  name: 'Better Tables',
  tagline: 'React tables that reach your database',
  description:
    'Define columns once in TypeScript. Better Tables compiles filtering, sorting, pagination, and cell edits into real queries against Postgres, MySQL, or SQLite — and the UI is shadcn-style source you own.',
  cta: 'Browse examples',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  installCommand: 'npx better-tables@latest init',
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
