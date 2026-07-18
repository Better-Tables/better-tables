'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useCallback } from 'react';
import {
  defaultVisibleTicketColumns,
  type TicketRow,
  ticketsTable,
} from '@/lib/demo/support/columns';
import { persistTicketCellEdit } from '@/lib/demo/support/ticket-cell-edit';
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

  const onCellEdit = useCallback(persistTicketCellEdit, []);

  return (
    <BetterTable
      id={TABLE_ID}
      name="Tickets"
      table={ticketsTable}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialSorting={initialSorting}
      initialFilters={initialFilters}
      defaultVisibleColumns={defaultVisibleTicketColumns}
      autoShowFilteredColumns
      onCellEdit={onCellEdit}
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
