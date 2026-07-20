import { ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import { SectionRow } from '@/components/site/section-row';
import { EXAMPLE_ENTRIES } from '@/lib/examples-data';
import { cn } from '@/lib/utils';

const GRID = 'md:grid-cols-[3.5rem_12rem_1fr_11rem_3rem]';

export function ExamplesIndex() {
  return (
    <SectionRow
      index="03"
      label="examples"
      id="examples"
      title="Live tables, not screenshots."
      description="Examples run against real databases — Postgres on the homepage when DATABASE_URL is set, in-memory SQLite for the ticket demos. Open one, filter it, and watch the URL carry your state."
      aside={
        <Link
          href="/examples"
          className="hidden items-center gap-1 font-mono text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          all examples <ArrowRightIcon className="size-3" />
        </Link>
      }
    >
      <div className="overflow-hidden rounded-lg border bg-card">
        <div
          className={cn(
            'hidden gap-4 border-b bg-background/60 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:grid',
            GRID
          )}
          aria-hidden
        >
          <span>nº</span>
          <span>example</span>
          <span>demonstrates</span>
          <span>dataset</span>
          <span />
        </div>

        <ul>
          {EXAMPLE_ENTRIES.map((entry) => (
            <li key={entry.id} className="border-b last:border-b-0">
              <Link
                href={entry.href}
                className={cn(
                  'group grid grid-cols-[3.5rem_1fr_3rem] items-baseline gap-x-4 gap-y-1 px-5 py-4 transition-colors',
                  'hover:bg-ledger-wash md:items-center',
                  GRID
                )}
              >
                <span className="tnum font-mono text-[12px] text-muted-foreground">{entry.id}</span>
                <span className="font-display text-[15px] font-semibold tracking-tight">
                  {entry.title}
                </span>
                <span className="col-span-full text-[13.5px] leading-relaxed text-muted-foreground md:col-span-1 md:col-start-3">
                  {entry.demonstrates}
                </span>
                <span className="tnum col-start-2 font-mono text-[11.5px] text-muted-foreground md:col-start-4">
                  {entry.dataset}
                </span>
                <span className="col-start-3 row-start-1 justify-self-end text-muted-foreground transition-colors group-hover:text-ledger md:col-start-5 md:row-start-auto">
                  {entry.anchor ? (
                    <ArrowRightIcon className="size-4 rotate-90 md:rotate-0" />
                  ) : (
                    <ArrowUpRightIcon className="size-4" />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SectionRow>
  );
}
