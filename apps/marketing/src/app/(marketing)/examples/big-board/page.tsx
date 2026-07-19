import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { ExampleShell } from '@/components/examples/example-shell';
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
    <ExampleShell
      index="03"
      label="virtualization"
      title="12,000 rows, smooth scrolling"
      lede={
        <>
          Same <code>&lt;BetterTable&gt;</code> as the other examples — add <code>virtualized</code>{' '}
          so only rows near the viewport mount. Filtering and sorting work the same way over{' '}
          {total.toLocaleString()} tickets, with variable row heights.
        </>
      }
      sourcePath="src/app/(marketing)/examples/big-board/page.tsx"
      facts={[`${total.toLocaleString()} rows`, 'variable heights', 'one prop']}
    >
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
    </ExampleShell>
  );
}
