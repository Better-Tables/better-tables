'use client';

import type { FilterState, PaginationState, SchemaInfo, SortingState } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { fetchExportData } from '@/lib/actions/export-actions';
import { userActions } from '@/lib/actions/user-actions';
import { defaultVisibleColumns, userColumns } from '@/lib/columns/user-columns';
import type { UserWithRelations } from '@/lib/db/schema';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

const TABLE_ID = 'users-table';

interface UsersTableClientProps {
  data: UserWithRelations[];
  totalCount: number;
  initialPagination: PaginationState;
  initialSorting: SortingState;
  initialFilters: FilterState[];
  schemaInfo: SchemaInfo;
}

export function UsersTableClient({
  data,
  totalCount,
  initialPagination,
  initialSorting,
  initialFilters,
  schemaInfo,
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
      columns={userColumns}
      actions={userActions}
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
      export={{
        enabled: true,
        // Use server action instead of API route - no boilerplate needed!
        serverAction: fetchExportData,
        schemaInfo, // Pass schema info for SQL export support
        formats: ['csv', 'excel', 'json', 'sql'],
        filename: 'users-export',
        batchSize: 500,
      }}
      emptyMessage="No users found. Try adjusting your filters."
    />
  );
}
