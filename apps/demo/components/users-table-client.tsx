'use client';

import type { FilterState, PaginationState, SortingState } from '@better-tables/core';
import { BetterTable } from '@better-tables/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useId, useMemo, useState } from 'react';
import { defaultVisibleColumns, userColumns } from '@/lib/columns/user-columns';

interface UsersTableClientProps {
  // biome-ignore lint/suspicious/noExplicitAny: Data type is generic
  data: any[];
  totalCount: number;
  pagination: PaginationState;
  sorting: SortingState;
  filters: FilterState[];
}

export function UsersTableClient({
  data,
  totalCount,
  pagination: initialPagination,
  sorting: initialSorting,
  filters: initialFilters,
}: UsersTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Filter columns to only show visible ones
  // biome-ignore lint/suspicious/noExplicitAny: Column types are complex and vary
  const visibleColumns: any[] = useMemo(
    () => userColumns.filter((col) => defaultVisibleColumns.includes(col.id)),
    []
  );

  const updateURL = useCallback(
    (updates: {
      filters?: FilterState[];
      sorting?: SortingState;
      page?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams(searchParams);

      if (updates.filters !== undefined) {
        if (updates.filters.length > 0) {
          params.set('filters', JSON.stringify(updates.filters));
        } else {
          params.delete('filters');
        }
        params.set('page', '1'); // Reset to page 1 on filter change
      }

      if (updates.sorting !== undefined) {
        if (updates.sorting.length > 0) {
          params.set('sorting', JSON.stringify(updates.sorting));
        } else {
          params.delete('sorting');
        }
        params.set('page', '1'); // Reset to page 1 on sort change
      }

      if (updates.page !== undefined) {
        params.set('page', updates.page.toString());
      }

      if (updates.limit !== undefined) {
        params.set('limit', updates.limit.toString());
        params.set('page', '1'); // Reset to page 1 on limit change
      }

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleFiltersChange = useCallback(
    (filters: FilterState[]) => {
      updateURL({ filters });
      setSelectedRows(new Set());
    },
    [updateURL]
  );

  const handleSortingChange = useCallback(
    (sorting: SortingState) => {
      updateURL({ sorting });
      setSelectedRows(new Set());
    },
    [updateURL]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateURL({ page });
      setSelectedRows(new Set());
    },
    [updateURL]
  );

  const handlePageSizeChange = useCallback(
    (limit: number) => {
      updateURL({ limit });
      setSelectedRows(new Set());
    },
    [updateURL]
  );

  return (
    <BetterTable
      id={useId()}
      name="Users"
      columns={visibleColumns}
      data={data}
      totalCount={totalCount}
      paginationState={initialPagination}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      sortingState={initialSorting}
      onSortingChange={handleSortingChange}
      filters={initialFilters}
      onFiltersChange={handleFiltersChange}
      selectedRows={selectedRows}
      onRowSelectionChange={setSelectedRows}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: true,
      }}
      emptyMessage="No users found. Try adjusting your filters."
    />
  );
}
