import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { QueryGroupsWorkspace } from '@/components/sections/query-groups-workspace';
import { fetchTickets } from '@/lib/demo/support/fetch-tickets';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Query groups example',
  description:
    'AND/OR filter groups over support tickets, rendered as a readable sentence and shared via URL.',
});

interface QueryGroupsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
    preset?: string;
  }>;
}

export default async function QueryGroupsPage({ searchParams }: QueryGroupsPageProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, { page: 1, limit: 10 });

  const fetchResult = await fetchTickets({
    page: tableParams.page,
    limit: tableParams.limit,
    filters: tableParams.filters,
    sorting: tableParams.sorting,
  });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      <div className="mb-10 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#60A5FA]">
          Query groups
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          AND/OR filter groups, as a sentence
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Nest AND/OR groups (or a flat filter list), including null-only filters like
          &ldquo;tickets with no assignee.&rdquo; Apply a scenario and the URL updates so the link
          you copy reproduces the same query.
        </p>
      </div>

      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading workspace...</div>}
      >
        <QueryGroupsWorkspace fetchResult={fetchResult} activePresetId={params.preset ?? null} />
      </Suspense>
    </div>
  );
}
