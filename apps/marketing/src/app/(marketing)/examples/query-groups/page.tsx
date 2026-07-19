import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { ExampleShell } from '@/components/examples/example-shell';
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
    <ExampleShell
      index="02"
      label="query groups"
      title="AND/OR filter groups, as a sentence"
      lede={
        <>
          Nest AND/OR groups (or a flat filter list), including null-only filters like
          &ldquo;tickets with no assignee.&rdquo; Apply a scenario and the URL updates, so the link
          you copy reproduces the same query.
        </>
      }
      sourcePath="src/app/(marketing)/examples/query-groups/page.tsx"
      facts={['nested and/or trees', 'null-only filters', 'shareable urls']}
    >
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading workspace...</div>}
      >
        <QueryGroupsWorkspace fetchResult={fetchResult} activePresetId={params.preset ?? null} />
      </Suspense>
    </ExampleShell>
  );
}
