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

const TABLE_ID = 'query-groups-table';

interface QueryGroupsTableClientProps {
  data: TicketRow[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
}

export function QueryGroupsTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
}: QueryGroupsTableClientProps) {
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
        columnReordering: false,
        headerContextMenu: {
          enabled: true,
          showSortToggle: true,
          allowSortReorder: true,
          showColumnVisibility: true,
        },
      }}
      sorting={{ enabled: true, multiSort: true, maxSortColumns: 2 }}
      emptyMessage="No tickets match this scenario."
    />
  );
}

export { TABLE_ID as QUERY_GROUPS_TABLE_ID };
