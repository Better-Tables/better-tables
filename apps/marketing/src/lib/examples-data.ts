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
      'Cross-table filtering, bulk actions, and the live SQL readout — on the homepage.',
    dataset: '5,000 rows · 3 tables',
    href: '/#demo',
    anchor: true,
    chips: ['profile.* dot-paths', 'bulk actions', 'generated sql'],
  },
  {
    id: '01',
    title: 'Relationship filtering',
    demonstrates:
      'Filter tickets by joined customer and assignee fields; the query trail explains each JOIN the adapter resolves.',
    dataset: '20 tickets · 3 tables',
    href: '/examples/relationship-filtering',
    chips: ['t.auto()', 'customer.plan', 'editable cells', 'query trail'],
  },
  {
    id: '02',
    title: 'Query groups',
    demonstrates:
      'Nested AND/OR filter trees, read back as a sentence and serialized into a shareable URL — including a null-only filter.',
    dataset: '20 tickets',
    href: '/examples/query-groups',
    chips: ['FilterGroupNode', 'isNull', 'url presets'],
  },
  {
    id: '03',
    title: 'Big board',
    demonstrates:
      'Virtualized scrolling through 12,000 rows with variable row heights — only rows near the viewport ever mount.',
    dataset: '12,000 rows',
    href: '/examples/big-board',
    chips: ['virtualized', 'dynamic heights'],
  },
  {
    id: '04',
    title: 'Facets',
    demonstrates:
      'Self-excluding facet counts and min/max ranges computed in SQL, aware of every other active filter.',
    dataset: '20 tickets',
    href: '/examples/facets',
    chips: ['getFacetedValues', 'getMinMaxValues'],
  },
];
