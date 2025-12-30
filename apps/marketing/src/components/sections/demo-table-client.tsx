'use client';

import type {
  FilterState,
  PaginationState,
  SortingState,
} from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
import { demoColumns, defaultVisibleColumns, type DemoUser } from '@/lib/demo-columns';

const TABLE_ID = 'demo-table';

interface DemoTableClientProps {
  data: DemoUser[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
}

export function DemoTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
}: DemoTableClientProps) {
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync(
    TABLE_ID,
    {
      filters: true,
      pagination: true,
      sorting: true,
    },
    urlAdapter
  );

  return (
    <BetterTable
      id={TABLE_ID}
      name="Demo Users"
      columns={demoColumns}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialSorting={initialSorting}
      initialFilters={initialFilters}
      defaultVisibleColumns={defaultVisibleColumns}
      autoShowFilteredColumns
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: false,
      }}
      sorting={{
        enabled: true,
        multiSort: true,
        maxSortColumns: 3,
      }}
      emptyMessage="No users found. Try adjusting your filters."
    />
  );
}

