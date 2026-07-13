import { Suspense } from 'react';
import { parseTableSearchParams } from '@better-tables/core';
import { SourceView } from '@/components/sections/source-view';
import { SupportDemoWorkspace } from '@/components/sections/support-demo-workspace';
import { readSourceFile } from '@/lib/demo/read-source';
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

  const columnsSource = readSourceFile('src/lib/demo/support/columns.tsx');
  const dbSource = readSourceFile('src/lib/demo/support/db.ts');

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      <div className="mb-10 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#60A5FA]">
          Support operations
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Filter tickets across relationships
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          This workspace uses a deterministic in-memory SQLite dataset with{' '}
          {supportSeed.tickets.length} tickets, {supportSeed.customers.length} customers, and{' '}
          {supportSeed.assignees.length} assignees. Add filters on related customer or assignee
          fields and watch the query trail explain what the adapter resolves.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading workspace...</div>}>
        <SupportDemoWorkspace fetchResult={fetchResult} />
      </Suspense>

      <div className="mt-6">
        <SourceView
          title="Implementation: table definition and flagship betterTables() instance"
          files={[
            { label: 'src/lib/demo/support/columns.tsx', code: columnsSource },
            { label: 'src/lib/demo/support/db.ts', code: dbSource },
          ]}
        />
      </div>
    </div>
  );
}
