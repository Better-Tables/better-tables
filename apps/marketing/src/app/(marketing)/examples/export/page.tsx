import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { ExampleShell } from '@/components/examples/example-shell';
import { ExportTableClient } from '@/components/sections/export-table-client';
import { fetchTickets } from '@/lib/demo/support/fetch-tickets';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'CSV export example',
  description:
    'Export the current (filtered, sorted) view to CSV or JSON — the ExportButton module riding the toolbarExtra slot.',
});

interface ExportPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export default async function ExportPage({ searchParams }: ExportPageProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, { page: 1, limit: 10 });

  const fetchResult = await fetchTickets({
    page: tableParams.page,
    limit: tableParams.limit,
    filters: tableParams.filters,
    sorting: tableParams.sorting,
  });

  return (
    <ExampleShell
      index="05"
      label="export"
      title="Export the current view"
      lede={
        <>
          Filter and sort the table, then <strong>Export → CSV</strong>. The download honors exactly
          what you see — the same filters and sorting — bounded by a 50,000-row cap. The button is
          an opt-in module (<code>better-tables add export</code>) wired into the toolbar's{' '}
          <code>toolbarExtra</code> slot.
        </>
      }
      sourcePath="src/app/(marketing)/examples/export/page.tsx"
      facts={['exportData', 'toolbarExtra slot', 'CSV / JSON']}
    >
      {fetchResult.error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load ticket data: {fetchResult.error}
        </div>
      ) : null}

      <section
        aria-label="Exportable ticket table"
        className="rounded-lg border bg-card p-4 md:p-6"
      >
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading table...</div>}>
          <ExportTableClient
            data={fetchResult.result.data ?? []}
            totalCount={fetchResult.result.total ?? 0}
            initialPagination={
              fetchResult.result.pagination ?? {
                page: 1,
                limit: 10,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
              }
            }
            initialSorting={fetchResult.sorting}
            initialFilters={fetchResult.filters}
          />
        </Suspense>
      </section>
    </ExampleShell>
  );
}
