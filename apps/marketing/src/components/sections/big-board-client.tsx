'use client';

import type { FilterState, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { bulkTicketsTable } from '@/lib/demo/support/bulk-columns';
import type { BulkTicketRow } from '@/lib/demo/support/fetch-bulk-tickets';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'big-board-table';

interface BigBoardClientProps {
  data: BulkTicketRow[];
  total: number;
  initialFilters: FilterState[];
  initialSorting: SortingState;
}

/**
 * Virtualized board: same `<BetterTable>` API, with `virtualized` so only
 * visible rows mount. Pagination is off — the server returns matching rows
 * and the table windows them in the client.
 */
export function BigBoardClient({
  data,
  total,
  initialFilters,
  initialSorting,
}: BigBoardClientProps) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync(TABLE_ID, { filters: true, sorting: true }, urlAdapter);

  return (
    <div className="space-y-3">
      <BetterTable
        id={TABLE_ID}
        table={bulkTicketsTable}
        data={data}
        totalCount={total}
        initialFilters={initialFilters}
        initialSorting={initialSorting}
        virtualized={{ height: 640, rowHeight: 56 }}
        features={{ filtering: true, sorting: true, pagination: false }}
        sorting={{ enabled: true, multiSort: false }}
        emptyMessage="No tickets match the active filters."
      />
      <p className="text-right font-mono text-xs text-muted-foreground tabular-nums">
        {total.toLocaleString()} rows, only the visible ones mounted
      </p>
    </div>
  );
}
