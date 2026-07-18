'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { httpAdapter } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useCallback, useMemo } from 'react';
import {
  defaultVisibleTicketColumns,
  type TicketRow,
  ticketsTable,
} from '@/lib/demo/support/columns';
import { persistTicketCellEdit } from '@/lib/demo/support/ticket-cell-edit';
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

  const onCellEdit = useCallback(persistTicketCellEdit, []);

  // Auto columns (plan 054): `ticketsTable` spreads `t.auto()`, so BetterTable
  // resolves the inferred columns at mount through this adapter's
  // `describeColumns` (same endpoint the facets sidebar reads). The SAVE path
  // is unchanged -- `onCellEdit` above wins over the adapter (plan 055 next).
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
      onCellEdit={onCellEdit}
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
