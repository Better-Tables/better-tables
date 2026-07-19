import { parseTableSearchParams } from '@better-tables/core';
import { Suspense } from 'react';
import { ExampleShell } from '@/components/examples/example-shell';
import { SupportDemoWorkspace } from '@/components/sections/support-demo-workspace';
import { fetchTickets } from '@/lib/demo/support/fetch-tickets';
import { supportSeed } from '@/lib/demo/support/seed-data';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Relationship filtering example',
  description:
    'Explore support ticket filtering across customer and assignee relationships with Better Tables.',
});

interface RelationshipFilteringPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export default async function RelationshipFilteringPage({
  searchParams,
}: RelationshipFilteringPageProps) {
  const params = await searchParams;
  const tableParams = parseTableSearchParams(params, {
    page: 1,
    limit: 10,
  });

  const fetchResult = await fetchTickets({
    page: tableParams.page,
    limit: tableParams.limit,
    filters: tableParams.filters,
    sorting: tableParams.sorting,
  });

  return (
    <ExampleShell
      index="01"
      label="relationship filtering"
      title="Filter tickets across relationships"
      lede={
        <>
          {supportSeed.tickets.length} tickets joined to {supportSeed.customers.length} customers
          and {supportSeed.assignees.length} assignees. Filter on related fields like{' '}
          <code>customer.plan</code> or <code>assignee.team</code> — the adapter resolves the joins
          from your schema, and the query trail shows each one.
        </>
      }
      sourcePath="src/app/(marketing)/examples/relationship-filtering/page.tsx"
      facts={[
        `${supportSeed.tickets.length} tickets`,
        '3 joined tables',
        't.auto() columns',
        'editable cells',
      ]}
    >
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading workspace...</div>}
      >
        <SupportDemoWorkspace fetchResult={fetchResult} />
      </Suspense>
    </ExampleShell>
  );
}
