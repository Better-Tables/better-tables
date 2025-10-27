'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { userColumns } from '@/lib/columns/user-columns';
import type { UserWithRelations } from '@/lib/db/schema';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'users-table';

interface UsersTableClientProps {
  data: UserWithRelations[];
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
  // Set up URL sync with Next.js adapter
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
      name="Users"
      // biome-ignore lint/suspicious/noExplicitAny: Column types need to match BetterTable expectations
      columns={userColumns as any}
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
        maxSortColumns: 3,
      }}
      emptyMessage="No users found. Try adjusting your filters."
    />
  );
}
