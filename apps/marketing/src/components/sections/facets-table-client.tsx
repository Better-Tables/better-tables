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

const TABLE_ID = 'facets-table';

interface FacetsTableClientProps {
  data: TicketRow[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
}

export function FacetsTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
}: FacetsTableClientProps) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync(
    TABLE_ID,
    { filters: true, pagination: true, sorting: true, columnVisibility: true, columnOrder: true },
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
      // Explicit `id` (not the table prop's `tableName` default): three
      // separate pages render this same table definition and each needs its
      // own store/URL-sync identity.
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
        columnReordering: false,
      }}
      sorting={{ enabled: true, multiSort: false }}
      emptyMessage="No tickets match the active facets."
    />
  );
}

export { TABLE_ID as FACETS_TABLE_ID };
