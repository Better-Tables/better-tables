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
      'Filter across joined tables, run bulk actions, and watch the exact SQL appear as you go. Lives on the homepage — Postgres when DATABASE_URL is set, SQLite otherwise.',
    dataset: '~1M · Postgres / 5k · SQLite',
    href: '/#demo',
    anchor: true,
    chips: ['drizzle · postgres', 'profile.* dot-paths', 'bulk actions', 'generated sql'],
  },
  {
    id: '01',
    title: 'Relationship filtering',
    demonstrates:
      "Filter tickets by fields on related tables — the customer's plan, the assignee's team. A query trail shows every JOIN the adapter builds to answer you.",
    dataset: '20 tickets · SQLite',
    href: '/examples/relationship-filtering',
    chips: ['drizzle · sqlite', 't.auto()', 'customer.plan', 'editable cells', 'query trail'],
  },
  {
    id: '02',
    title: 'Query groups',
    demonstrates:
      "Build nested AND/OR filters, read back to you as a plain sentence and saved into a shareable URL — including “is empty” filters.",
    dataset: '20 tickets · SQLite',
    href: '/examples/query-groups',
    chips: ['drizzle · sqlite', 'FilterGroupNode', 'isNull', 'url presets'],
  },
  {
    id: '03',
    title: 'Big board',
    demonstrates:
      'Scroll 12,000 rows without the browser breaking a sweat. Only the rows near your viewport are ever rendered, even when row heights vary.',
    dataset: '12,000 rows · SQLite',
    href: '/examples/big-board',
    chips: ['drizzle · sqlite', 'virtualized', 'dynamic heights'],
  },
  {
    id: '04',
    title: 'Facets',
    demonstrates:
      'A faceted sidebar whose counts and ranges are computed in SQL and update with every filter you apply — without a facet ever hiding its own options.',
    dataset: '20 tickets · SQLite',
    href: '/examples/facets',
    chips: ['drizzle · sqlite', 'getFacetedValues', 'getMinMaxValues'],
  },
  {
    id: '05',
    title: 'CSV export',
    demonstrates:
      'Export exactly what you are looking at — the current filtered, sorted view — to CSV or JSON, straight from the toolbar.',
    dataset: '20 tickets · SQLite',
    href: '/examples/export',
    chips: ['exportData', 'toolbarExtra slot', 'CSV / JSON', 'row cap'],
  },
];
