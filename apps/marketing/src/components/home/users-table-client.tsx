'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { userActions } from '@/lib/actions/user-actions';
import { saveUserCell } from '@/lib/actions/user-cell-actions';
import { defaultVisibleColumns, type UserRow, userColumns } from '@/lib/columns/user-columns';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'users-table';

interface UsersTableClientProps {
  data: UserRow[];
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
  const router = useRouter();
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

  // The homepage table is server-driven (data arrives as props via the URL),
  // so bulk actions must refresh the route to show their effect.
  const actions = useMemo(
    () =>
      userActions.map((action) => ({
        ...action,
        handler: async (selectedIds: string[]) => {
          const result = await action.handler(selectedIds);
          router.refresh();
          return result;
        },
      })),
    [router]
  );

  return (
    <BetterTable
      id={TABLE_ID}
      name="Users"
      columns={userColumns}
      actions={actions}
      data={data}
      totalCount={totalCount}
      initialPagination={initialPagination}
      initialSorting={initialSorting}
      initialFilters={initialFilters}
      defaultVisibleColumns={defaultVisibleColumns}
      saveAction={saveUserCell}
      autoShowFilteredColumns
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
      emptyMessage="No users match. Loosen a filter, or reset the demo data below."
    />
  );
}
