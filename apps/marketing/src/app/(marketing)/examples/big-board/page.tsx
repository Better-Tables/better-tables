import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { BigBoardClient } from '@/components/sections/big-board-client';
import { fetchBulkTickets } from '@/lib/demo/support/fetch-bulk-tickets';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Big board example',
  description:
    '12,000 rows through the same <BetterTable> as every other example — one `virtualized` prop, with filtering and sorting intact.',
});

interface BigBoardPageProps {
  searchParams: Promise<{
    filters?: string;
    sorting?: string;
  }>;
}

export default async function BigBoardPage({ searchParams }: BigBoardPageProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, { page: 1, limit: 12_500 });

  const { data, total, filters, sorting, error } = await fetchBulkTickets({
    filters: tableParams.filters,
    sorting: tableParams.sorting,
  });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      <div className="mb-10 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#60A5FA]">
          Virtualization
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          12,000 rows, smooth scrolling
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Same <code>&lt;BetterTable&gt;</code> as the other examples — add <code>virtualized</code>{' '}
          so only rows near the viewport mount. Filtering and sorting work the same way over{' '}
          {total.toLocaleString()} tickets.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load big-board data: {error}
        </div>
      ) : null}

      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading big board...</div>}
      >
        <BigBoardClient
          data={data}
          total={total}
          initialFilters={filters}
          initialSorting={sorting}
        />
      </Suspense>
    </div>
  );
}
