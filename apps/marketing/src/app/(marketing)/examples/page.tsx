import { ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { EXAMPLE_ENTRIES } from '@/lib/examples-data';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Examples',
  description:
    'Five live Better Tables examples: cross-table filtering, query groups, 12,000 virtualized rows, facets, and a live SQL readout — all querying a real SQLite database.',
});

export default function ExamplesIndexPage() {
  return (
    <div className="shell pt-14 pb-20 md:pt-20">
      <div className="max-w-2xl">
        <p className="row-eyebrow">
          <b>{String(EXAMPLE_ENTRIES.length).padStart(2, '0')}</b>
          live examples
        </p>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-tight tracking-tight md:text-[3rem]">
          Every example is running.
        </h1>
        <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
          These pages query a real SQLite database seeded inside this site&apos;s server — the same
          code paths you&apos;d ship, not recordings. Filter something, watch the URL carry your
          state, then read the source.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-lg border bg-card">
        {EXAMPLE_ENTRIES.map((entry, i) => (
          <Link key={entry.id} href={entry.href} className={cnRow(i)}>
            <span className="tnum pt-1 font-mono text-[12px] text-muted-foreground">
              {entry.id}
            </span>

            <span className="flex min-w-0 flex-col gap-2">
              <span className="font-display text-[19px] font-semibold tracking-tight md:text-[21px]">
                {entry.title}
                {entry.anchor && (
                  <span className="ml-2.5 align-middle font-mono text-[10.5px] font-normal tracking-wide text-ledger">
                    on the homepage
                  </span>
                )}
              </span>
              <span className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
                {entry.demonstrates}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {entry.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
                <span className="tnum ml-1 font-mono text-[10.5px] tracking-wide text-muted-foreground/70">
                  {entry.dataset}
                </span>
              </span>
            </span>

            <span className="hidden self-center text-muted-foreground transition-colors group-hover:translate-x-0.5 group-hover:text-ledger sm:block">
              <ArrowRightIcon className="size-4 transition-transform" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-6 flex flex-wrap items-center gap-1.5 font-mono text-[11.5px] tracking-wide text-muted-foreground">
        The shared data layer lives in{' '}
        <a
          href={`${siteConfig.sourceBase.replace('/blob/', '/tree/')}/src/lib/demo/support`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-ledger transition-colors hover:text-ledger-strong"
        >
          src/lib/demo/support <ArrowUpRightIcon className="size-3" />
        </a>
        — schema, seed, columns, and server actions.
      </p>
    </div>
  );
}

function cnRow(index: number): string {
  return [
    'group grid grid-cols-[3rem_1fr] gap-x-2 px-5 py-6 transition-colors sm:grid-cols-[3.5rem_1fr_2.5rem] md:px-7',
    'hover:bg-ledger-wash',
    index > 0 ? 'border-t' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
