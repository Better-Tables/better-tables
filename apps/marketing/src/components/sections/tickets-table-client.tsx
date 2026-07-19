'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { httpAdapter } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useMemo } from 'react';
import { saveTicketCell } from '@/lib/demo/support/actions';
import {
  defaultVisibleTicketColumns,
  type TicketRow,
  ticketsTable,
} from '@/lib/demo/support/columns';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'support-tickets-table';

interface TicketsTableClientProps {
  data: TicketRow[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
}

export function TicketsTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
}: TicketsTableClientProps) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync(
    TABLE_ID,
    {
      filters: true,
      pagination: true,
      sorting: true,
      columnVisibility: true,
      columnOrder: true,
    },
    urlAdapter
  );

  // Auto columns (plan 054): `ticketsTable` spreads `t.auto()`, so BetterTable
  // resolves the inferred columns at mount through this adapter's
  // `describeColumns` (same endpoint the facets sidebar reads); the joined
  // `customer.company` column also resolves its write target through it.
  // SAVES go through the DIRECT server-action path (`saveAction` below) --
  // this endpoint proxies reads only.
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
      saveAction={saveTicketCell}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: false,
        columnReordering: true,
        headerContextMenu: {
          enabled: true,
          showSortToggle: true,
          allowSortReorder: true,
          showColumnVisibility: true,
        },
      }}
      sorting={{
        enabled: true,
        multiSort: true,
        maxSortColumns: 2,
      }}
      emptyMessage="No tickets match these filters. Try a scenario preset or clear filters."
    />
  );
}

export { TABLE_ID as SUPPORT_TABLE_ID };
