'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { defaultVisibleTicketColumns, ticketColumns } from '@/lib/demo/support/columns';
import type { TicketWithRelations } from '@/lib/demo/support/schema';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'query-groups-table';

interface QueryGroupsTableClientProps {
  data: TicketWithRelations[];
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

  return (
    <BetterTable
      id={TABLE_ID}
      name="Tickets"
      columns={ticketColumns}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialSorting={initialSorting}
      initialFilters={initialFilters}
      defaultVisibleColumns={defaultVisibleTicketColumns}
      autoShowFilteredColumns
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: false,
        columnReordering: false,
      }}
      sorting={{ enabled: true, multiSort: true, maxSortColumns: 2 }}
      emptyMessage="No tickets match this scenario."
    />
  );
}

export { TABLE_ID as QUERY_GROUPS_TABLE_ID };
