import { Suspense } from 'react';
import { parseTableSearchParams } from '@better-tables/core';
import { SourceView } from '@/components/sections/source-view';
import { QueryGroupsWorkspace } from '@/components/sections/query-groups-workspace';
import { readSourceFile } from '@/lib/demo/read-source';
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

  const filterSentenceSource = readSourceFile('src/lib/demo/support/filter-sentence.ts');
  const presetsSource = readSourceFile('src/lib/demo/support/relationship-trail.ts');

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
          Every scenario below is a real <code>FilterGroupNode</code> tree -- some AND, one OR, one
          a flat implicit-AND array, and one a null-only filter (&ldquo;tickets with no
          assignee&rdquo;). Each is shareable: applying a scenario updates the URL with the{' '}
          <code>c2:</code> wire format, so the link you copy reproduces the exact same query.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading workspace...</div>}>
        <QueryGroupsWorkspace fetchResult={fetchResult} activePresetId={params.preset ?? null} />
      </Suspense>

      <div className="mt-6">
        <SourceView
          title="Implementation: filter groups and sentence rendering"
          files={[
            { label: 'src/lib/demo/support/filter-sentence.ts', code: filterSentenceSource },
            { label: 'src/lib/demo/support/relationship-trail.ts (presets)', code: presetsSource },
          ]}
        />
      </div>
    </div>
  );
}
