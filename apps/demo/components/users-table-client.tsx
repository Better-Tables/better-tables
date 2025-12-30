'use client';

import type { FilterState, PaginationState, SortingState, TableAdapter } from '@better-tables/core';
import { BetterTable, useTableUrlSync } from '@better-tables/ui';
import { useCallback, useMemo } from 'react';
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

  // Export success handler - using a void expression to satisfy linter
  const handleExportComplete = useCallback((_result: { rowCount: number; filename: string }) => {
    // Export completed successfully
    // In production, you might show a toast notification here
  }, []);

  // Export error handler
  const handleExportError = useCallback((_error: Error) => {
    // Export failed
    // In production, you might show an error notification here
  }, []);

  // Create an adapter for export that fetches data from the API
  const exportAdapter = useMemo<TableAdapter<UserWithRelations>>(
    () => ({
      fetchData: async (params) => {
        const { pagination, filters, sorting } = params;
        const offset = pagination ? (pagination.page - 1) * pagination.limit : 0;
        const limit = pagination?.limit ?? 100;

        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, limit, filters, sorting }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch export data');
        }

        const result = await response.json();
        return {
          data: result.data,
          total: result.total,
          pagination: {
            page: Math.floor(offset / limit) + 1,
            limit,
            totalPages: Math.ceil(result.total / limit),
            hasNext: offset + limit < result.total,
            hasPrev: offset > 0,
          },
        };
      },
      getFilterOptions: async () => [],
      getFacetedValues: async () => new Map(),
      getMinMaxValues: async () => [0, 0] as [number, number],
      meta: {
        name: 'export-adapter',
        version: '1.0.0',
        features: {
          create: false,
          read: true,
          update: false,
          delete: false,
          bulkOperations: false,
          realTimeUpdates: false,
          export: true,
          transactions: false,
        },
        supportedColumnTypes: ['text', 'number', 'date', 'boolean', 'option', 'multiOption'],
        supportedOperators: {
          text: ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
          number: [
            'equals',
            'greaterThan',
            'lessThan',
            'greaterThanOrEqual',
            'lessThanOrEqual',
            'between',
          ],
          date: ['is', 'before', 'after', 'between', 'isEmpty', 'isNotEmpty'],
          boolean: ['isTrue', 'isFalse'],
          option: ['equals', 'notEquals', 'isAnyOf', 'isEmpty', 'isNotEmpty'],
          multiOption: ['includes', 'includesAll', 'includesAny', 'isEmpty', 'isNotEmpty'],
          currency: ['equals', 'greaterThan', 'lessThan', 'between'],
          percentage: ['equals', 'greaterThan', 'lessThan', 'between'],
          url: ['contains', 'equals', 'startsWith', 'isEmpty', 'isNotEmpty'],
          email: ['contains', 'equals', 'startsWith', 'isEmpty', 'isNotEmpty'],
          phone: ['contains', 'equals', 'startsWith', 'isEmpty', 'isNotEmpty'],
          json: ['isEmpty', 'isNotEmpty'],
          custom: [],
        },
      },
    }),
    []
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
        adapter: exportAdapter,
        formats: ['csv', 'excel', 'json'],
        filename: 'users-export',
        batchSize: 500,
        onComplete: handleExportComplete,
        onError: handleExportError,
      }}
      emptyMessage="No users found. Try adjusting your filters."
    />
  );
}
