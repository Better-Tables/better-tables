export interface ExampleEntry {
  id: string;
  title: string;
  demonstrates: string;
  dataset: string;
  href: string;
  /** Links to a section of the homepage rather than a dedicated page. */
  anchor?: boolean;
  /** API surface the example exercises, shown as mono chips on the hub. */
  chips: string[];
}

export const EXAMPLE_ENTRIES: ExampleEntry[] = [
  {
    id: '00',
    title: 'Users directory',
    demonstrates:
      'Cross-table filtering, bulk actions, and the live SQL readout — on the homepage against Postgres when DATABASE_URL is set (SQLite fallback otherwise).',
    dataset: '~1M users · Postgres (or SQLite)',
    href: '/#demo',
    anchor: true,
    chips: ['drizzle · postgres', 'profile.* dot-paths', 'bulk actions', 'generated sql'],
  },
  {
    id: '01',
    title: 'Relationship filtering',
    demonstrates:
      'Filter tickets by joined customer and assignee fields; the query trail explains each JOIN the adapter resolves.',
    dataset: '20 tickets · SQLite',
    href: '/examples/relationship-filtering',
    chips: ['drizzle · sqlite', 't.auto()', 'customer.plan', 'editable cells', 'query trail'],
  },
  {
    id: '02',
    title: 'Query groups',
    demonstrates:
      'Nested AND/OR filter trees, read back as a sentence and serialized into a shareable URL — including a null-only filter.',
    dataset: '20 tickets · SQLite',
    href: '/examples/query-groups',
    chips: ['drizzle · sqlite', 'FilterGroupNode', 'isNull', 'url presets'],
  },
  {
    id: '03',
    title: 'Big board',
    demonstrates:
      'Virtualized scrolling through 12,000 rows with variable row heights — only rows near the viewport ever mount.',
    dataset: '12,000 rows · SQLite',
    href: '/examples/big-board',
    chips: ['drizzle · sqlite', 'virtualized', 'dynamic heights'],
  },
  {
    id: '04',
    title: 'Facets',
    demonstrates:
      'Self-excluding facet counts and min/max ranges computed in SQL, aware of every other active filter.',
    dataset: '20 tickets · SQLite',
    href: '/examples/facets',
    chips: ['drizzle · sqlite', 'getFacetedValues', 'getMinMaxValues'],
  },
];
