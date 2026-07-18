import Link from 'next/link';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Examples',
  description:
    'Four live Better Tables examples: relationship filtering, query groups, virtualization, and facets.',
});

const EXAMPLES = [
  {
    href: '/examples/relationship-filtering',
    title: 'Relationship filtering',
    description:
      'Dot-path columns across joins (customer.plan, assignee.name), cross-table filtering and sorting, and a query trail explaining what the adapter resolves.',
  },
  {
    href: '/examples/query-groups',
    title: 'Query groups',
    description:
      'AND/OR filter trees rendered as a readable sentence, shareable via URL, including a null-only filter (tickets with no assignee).',
  },
  {
    href: '/examples/big-board',
    title: 'Big board',
    description:
      '12,000 virtualized rows with dynamic row heights and an expandable description cell -- only visible rows are ever mounted.',
  },
  {
    href: '/examples/facets',
    title: 'Facets',
    description:
      'A filter-aware facet sidebar built on getFacetedValues/getMinMaxValues, demonstrating self-exclusion.',
  },
];

export default function ExamplesIndexPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-24 md:px-6">
      <div className="mb-10 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#60A5FA]">Examples</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Four ways to see Better Tables working
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Every example runs against the same deterministic, in-memory SQLite support-ticket
          dataset, using the flagship <code>betterTables()</code> + <code>defineTable()</code> API.
          Each page has a collapsible source panel showing the real implementation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <Link
            key={example.href}
            href={example.href}
            className="group rounded-xl border border-[#27272A] bg-[#111217] p-5 transition-colors hover:border-[#60A5FA]/50"
          >
            <h2 className="text-lg font-semibold text-foreground group-hover:text-[#60A5FA]">
              {example.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{example.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
