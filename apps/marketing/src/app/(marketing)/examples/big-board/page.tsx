import { Suspense } from 'react';
import { BigBoardClient } from '@/components/sections/big-board-client';
import { SourceView } from '@/components/sections/source-view';
import { fetchBulkTickets } from '@/lib/demo/support/fetch-bulk-tickets';
import { readSourceFile } from '@/lib/demo/read-source';
import { constructMetadata } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Big board example',
  description: '12,000 virtualized rows with dynamic row heights and an expandable description cell.',
});

interface BigBoardPageProps {
  searchParams: Promise<{
    sortColumn?: string;
    sortDirection?: string;
  }>;
}

const SORTABLE_COLUMNS = new Set(['createdAt', 'status', 'priority', 'customerName']);

export default async function BigBoardPage({ searchParams }: BigBoardPageProps) {
  const params = await searchParams;
  const sortColumnId = params.sortColumn && SORTABLE_COLUMNS.has(params.sortColumn) ? params.sortColumn : 'createdAt';
  const sortDirection = params.sortDirection === 'desc' ? 'desc' : 'asc';

  const { data, total, error } = await fetchBulkTickets([{ columnId: sortColumnId, direction: sortDirection }]);

  const bulkColumnsSource = readSourceFile('src/lib/demo/support/bulk-columns.tsx');
  const bigBoardClientSource = readSourceFile('src/components/sections/big-board-client.tsx');

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
          A deterministic synthetic dataset of {total.toLocaleString()} tickets, all fetched and
          rendered at once via <code>&lt;VirtualizedTable&gt;</code> -- only the rows in (and near)
          the viewport are ever mounted. Click a row to expand its description and watch the row
          height animate.
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

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading big board...</div>}>
        <BigBoardClient data={data} total={total} sortColumnId={sortColumnId} sortDirection={sortDirection} />
      </Suspense>

      <div className="mt-6">
        <SourceView
          title="Implementation: bulk table definition and virtualized client"
          files={[
            { label: 'src/lib/demo/support/bulk-columns.tsx', code: bulkColumnsSource },
            { label: 'src/components/sections/big-board-client.tsx', code: bigBoardClientSource },
          ]}
        />
      </div>
    </div>
  );
}
