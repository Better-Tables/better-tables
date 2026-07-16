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
 * 12,000 rows through the SAME `<BetterTable>` every other example uses --
 * `virtualized` is the only difference. Windowing is a rendering detail, so the
 * filter bar, header sort UI, column visibility and URL sync all come for free;
 * there's no separate virtualized component, no hand-built sort toolbar, and no
 * per-column `renderCell` (the column definitions' own `.dateTime()`/
 * `.cellRenderer()` config drives formatting).
 *
 * `pagination: false` because windowing already handles arbitrarily many rows:
 * the server returns every matching row in one query and the table renders only
 * the ones in view.
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
