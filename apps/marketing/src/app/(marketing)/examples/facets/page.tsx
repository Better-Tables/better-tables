import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { ExampleShell } from '@/components/examples/example-shell';
import { FacetsSidebar } from '@/components/sections/facets-sidebar';
import { FacetsTableClient } from '@/components/sections/facets-table-client';
import { fetchTickets } from '@/lib/demo/support/fetch-tickets';
import { UrlNavigationPendingProvider } from '@/lib/nextjs-url-adapter';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Facets example',
  description:
    'A filter-aware facet sidebar built on getFacetedValues/getMinMaxValues, with self-exclusion.',
});

interface FacetsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export default async function FacetsPage({ searchParams }: FacetsPageProps) {
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
      index="04"
      label="faceted search"
      title="Filter-aware facets"
      lede={
        <>
          Click a facet to narrow the table. Counts respect every other active filter — and a column
          never excludes itself from its own facet list, so its remaining options stay visible.
        </>
      }
      sourcePath="src/app/(marketing)/examples/facets/page.tsx"
      facts={['getFacetedValues', 'getMinMaxValues', 'self-exclusion']}
    >
      {fetchResult.error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load ticket data: {fetchResult.error}
        </div>
      ) : null}

      {/* Shared transition: a sidebar facet click dims the table while its
          RSC round-trip is in flight (both components' url adapters join the
          same pending state). */}
      <UrlNavigationPendingProvider>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <FacetsSidebar activeFilters={fetchResult.filters} />

          <section
            aria-label="Facets ticket table"
            className="rounded-lg border bg-card p-4 md:p-6"
          >
            <Suspense
              fallback={<div className="text-sm text-muted-foreground">Loading table...</div>}
            >
              <FacetsTableClient
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
        </div>
      </UrlNavigationPendingProvider>
    </ExampleShell>
  );
}
