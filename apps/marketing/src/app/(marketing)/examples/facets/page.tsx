import { Suspense } from 'react';
import { parseTableSearchParams } from '@better-tables/core';
import { FacetsSidebar } from '@/components/sections/facets-sidebar';
import { FacetsTableClient } from '@/components/sections/facets-table-client';
import { SourceView } from '@/components/sections/source-view';
import { readSourceFile } from '@/lib/demo/read-source';
import { fetchTickets } from '@/lib/demo/support/fetch-tickets';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Facets example',
  description: 'A filter-aware facet sidebar built on getFacetedValues/getMinMaxValues, with self-exclusion.',
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

  const routeSource = readSourceFile('src/app/api/facets/route.ts');
  const sidebarSource = readSourceFile('src/components/sections/facets-sidebar.tsx');

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      <div className="mb-10 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#60A5FA]">
          Faceted search
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Filter-aware facets, hand-built
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          The sidebar calls the adapter&apos;s <code>getFacetedValues</code>/
          <code>getMinMaxValues</code> from a route handler on every filter change. No UI component
          ships this yet (this app is the first real caller) -- everything below is hand-built.
        </p>
      </div>

      {fetchResult.error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load ticket data: {fetchResult.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <FacetsSidebar activeFilters={fetchResult.filters} />

        <section
          aria-label="Facets ticket table"
          className="rounded-xl border border-[#27272A] bg-[#111217] p-4 md:p-6"
        >
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading table...</div>}>
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

      <div className="mt-6">
        <SourceView
          title="Implementation: facet route handler and sidebar"
          files={[
            { label: 'src/app/api/facets/route.ts', code: routeSource },
            { label: 'src/components/sections/facets-sidebar.tsx', code: sidebarSource },
          ]}
        />
      </div>
    </div>
  );
}
