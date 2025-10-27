'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useMemo } from 'react';
import { defaultVisibleColumns, userColumns } from '@/lib/columns/user-columns';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'users-table';

interface UsersTableClientProps {
  // biome-ignore lint/suspicious/noExplicitAny: Data type is generic
  data: any[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
}

export function UsersTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
}: UsersTableClientProps) {
  // Filter columns to only show visible ones
  // biome-ignore lint/suspicious/noExplicitAny: Column types are complex and vary
  const visibleColumns: any[] = useMemo(
    () => userColumns.filter((col) => defaultVisibleColumns.includes(col.id)),
    []
  );

  // Set up URL sync with Next.js adapter
  const urlAdapter = useNextjsUrlAdapter();

  useTableUrlSync(
    TABLE_ID,
    {
      filters: true,
      pagination: true,
      sorting: true,
      columnVisibility: true,
    },
    urlAdapter
  );

  return (
    <BetterTable
      id={TABLE_ID}
      name="Users"
      columns={visibleColumns}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialSorting={initialSorting}
      initialFilters={initialFilters}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: true,
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
        maxSortColumns: 3,
      }}
      emptyMessage="No users found. Try adjusting your filters."
    />
  );
}
