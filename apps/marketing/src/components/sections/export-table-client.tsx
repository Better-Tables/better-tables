'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { httpAdapter } from '@better-tables/core';
import { BetterTable, ExportButton, useTableUrlSync } from '@better-tables/ui';
import { useMemo } from 'react';
import {
  defaultVisibleTicketColumns,
  type TicketRow,
  ticketsTable,
} from '@/lib/demo/support/columns';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'export-tickets-table';

interface ExportTableClientProps {
  data: TicketRow[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
}

export function ExportTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
}: ExportTableClientProps) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync(
    TABLE_ID,
    { filters: true, pagination: true, sorting: true, columnVisibility: true, columnOrder: true },
    urlAdapter
  );

  // The `httpAdapter` advertises export (plan 050): `exportData` reuses this
  // read endpoint to pull the filtered rows, then formats CSV/JSON in the
  // browser — no separate export route.
  const adapter = useMemo(() => httpAdapter<TicketRow>({ url: '/api/tables/tickets' }), []);

  return (
    <BetterTable
      id={TABLE_ID}
      name="Tickets"
      table={ticketsTable}
      adapter={adapter}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialSorting={initialSorting}
      initialFilters={initialFilters}
      defaultVisibleColumns={defaultVisibleTicketColumns}
      autoShowFilteredColumns
      // The export module rides the `toolbarExtra` slot. Filter the table, then
      // Export → the download honors the current filters and sorting.
      slots={{ toolbarExtra: ExportButton }}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        columnReordering: true,
        headerContextMenu: {
          enabled: true,
          showSortToggle: true,
          allowSortReorder: true,
          showColumnVisibility: true,
        },
      }}
      sorting={{ enabled: true, multiSort: true, maxSortColumns: 2 }}
      emptyMessage="No tickets match these filters. Clear a filter to see more."
    />
  );
}
