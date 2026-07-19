import { ArrowUpRightIcon } from 'lucide-react';
import { SectionRow } from '@/components/site/section-row';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

type SpecStatus = 'shipped' | 'planned';

interface SpecRow {
  capability: string;
  detail: string;
  status: SpecStatus;
}

const SPEC: SpecRow[] = [
  {
    capability: 'Cross-table filtering',
    detail:
      'Dot-path columns like customer.company detect Drizzle relations and generate only the JOINs a query needs.',
    status: 'shipped',
  },
  {
    capability: '34 filter operators',
    detail:
      'Across text, number, date, option, multi-option, boolean, and JSON groups — null-aware throughout.',
    status: 'shipped',
  },
  {
    capability: 'Editable cells',
    detail:
      'Type-aware inline editors with optimistic updates and rollback. Editing a joined column writes the related row.',
    status: 'shipped',
  },
  {
    capability: 'Schema-inferred columns',
    detail:
      't.auto() reads your database schema; enum columns become dropdowns with humanized labels, no options list needed.',
    status: 'shipped',
  },
  {
    capability: 'Zero-boilerplate saves',
    detail:
      "tables.cellEditAction(def) returns a save handler that's ready to export as a Next.js server action.",
    status: 'shipped',
  },
  {
    capability: 'URL-synced state',
    detail:
      'Filters, sorting, pagination, column visibility, and column order — compressed, shareable, SSR-hydration safe.',
    status: 'shipped',
  },
  {
    capability: 'Virtualized rows',
    detail: 'Scroll 12,000+ rows with variable heights — see the big board example.',
    status: 'shipped',
  },
  {
    capability: 'Multi-column sort',
    detail: 'Priority-ordered and reorderable, with a configurable cap.',
    status: 'shipped',
  },
  {
    capability: 'Typed end to end',
    detail:
      'Column paths, filter values, and row types infer from your schema. A renamed column fails the build, not production.',
    status: 'shipped',
  },
  {
    capability: 'Three databases',
    detail:
      'PostgreSQL, MySQL, and SQLite through the Drizzle adapter — plus an HTTP adapter with a ready-made route handler.',
    status: 'shipped',
  },
  {
    capability: 'Visual query-group builder',
    detail: 'The nested AND/OR data model ships today; the drag-to-build UI is on the roadmap.',
    status: 'planned',
  },
  {
    capability: 'CSV export',
    detail: 'Export the current filtered view from the toolbar.',
    status: 'planned',
  },
  {
    capability: 'More adapters',
    detail: 'REST and in-memory adapters, for tables without a Drizzle schema.',
    status: 'planned',
  },
];

function StatusPill({ status }: { status: SpecStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-wide',
        status === 'shipped'
          ? 'border-ledger/25 bg-accent text-accent-foreground'
          : 'border-border bg-transparent text-muted-foreground'
      )}
    >
      {status}
    </span>
  );
}

export function FeaturesSpec() {
  return (
    <SectionRow
      index="04"
      label="capabilities"
      title="The spec sheet."
      description="What ships today — verifiable in the source — and what's next. No adjectives where a fact will do."
      aside={
        <a
          href={`${siteConfig.links.github}/blob/main/plans/README.md`}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1 font-mono text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          roadmap on github <ArrowUpRightIcon className="size-3" />
        </a>
      }
    >
      <div className="overflow-hidden rounded-lg border bg-card">
        {SPEC.map((row, i) => (
          <div
            key={row.capability}
            className={cn(
              'grid gap-x-6 gap-y-1 px-5 py-3.5 md:grid-cols-[15rem_1fr_5.5rem] md:items-baseline',
              i > 0 && 'border-t'
            )}
          >
            <div className="flex items-center justify-between gap-3 md:block">
              <h3 className="text-[13.5px] font-semibold tracking-tight">{row.capability}</h3>
              <span className="md:hidden">
                <StatusPill status={row.status} />
              </span>
            </div>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">{row.detail}</p>
            <span className="hidden justify-self-end md:block">
              <StatusPill status={row.status} />
            </span>
          </div>
        ))}
      </div>
    </SectionRow>
  );
}
