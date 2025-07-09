import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  TableConfig,
  ColumnDefinition,
  FilterState,
  PaginationState,
  FetchDataParams,
} from '@better-tables/core';
import { FilterBar } from '../filters/filter-bar';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { TablePagination } from './table-pagination';
import { cn } from '../../lib/utils';

/**
 * UI-specific props for the BetterTable component
 * Business logic is handled by TableConfig from core
 */
export interface BetterTableProps<TData = any> extends TableConfig<TData> {
  /** Current filter state */
  filters?: FilterState[];

  /** Filter change handler */
  onFiltersChange?: (filters: FilterState[]) => void;

  /** Current pagination state */
  paginationState?: PaginationState;

  /** Pagination handlers */
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;

  /** Row selection state */
  selectedRows?: Set<string>;
  onRowSelectionChange?: (selected: Set<string>) => void;

  /** UI-specific styling and behavior */
  className?: string;

  /** Additional UI event handlers */
  onRowClick?: (row: TData) => void;

  /** Custom empty message override */
  emptyMessage?: string;
}

export function BetterTable<TData = any>({
  // Core table config
  id,
  name,
  columns,
  adapter,
  features = {},
  rowConfig,
  emptyState,
  loadingState,
  errorState,

  // UI-specific props
  filters = [],
  onFiltersChange,
  paginationState = { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
  onPageChange,
  onPageSizeChange,
  selectedRows = new Set(),
  onRowSelectionChange,
  className,
  onRowClick,
  emptyMessage,
  ...props
}: BetterTableProps<TData>) {
  const {
    filtering = true,
    // sorting = true, // TODO: Implement sorting functionality
    pagination: paginationEnabled = true,
    rowSelection = false,
  } = features;

  // State for data fetching
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Note: FilterManager is created and managed by core, not UI
  // The adapter handles all filter logic server-side

  // Get row ID function from rowConfig or use default
  const getRowId = useMemo(() => {
    return rowConfig?.getId || ((_row: TData, index: number) => `row-${index}`);
  }, [rowConfig?.getId]);

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: FilterState[]) => {
      onFiltersChange?.(newFilters);
    },
    [onFiltersChange],
  );

  // Handle row selection
  const handleRowSelection = useCallback(
    (rowId: string, selected: boolean) => {
      if (!onRowSelectionChange) return;

      const newSelected = new Set(selectedRows);
      if (selected) {
        newSelected.add(rowId);
      } else {
        newSelected.delete(rowId);
      }
      onRowSelectionChange(newSelected);
    },
    [selectedRows, onRowSelectionChange],
  );

  // Handle select all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (!onRowSelectionChange) return;

      if (selected) {
        const allIds = data.map((row, index) => getRowId(row, index));
        onRowSelectionChange(new Set(allIds));
      } else {
        onRowSelectionChange(new Set());
      }
    },
    [data, getRowId, onRowSelectionChange],
  );

  // Clear filters handler
  const handleClearFilters = useCallback(() => {
    onFiltersChange?.([]);
  }, [onFiltersChange]);

  // Fetch data using adapter
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params: FetchDataParams = {
          pagination: { page: paginationState.page, limit: paginationState.limit },
          filters,
          // TODO: Add sorting params when implemented
        };

        const result = await adapter.fetchData(params);
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adapter, filters, paginationState.page, paginationState.limit]);

  // Data is already filtered by the adapter
  const filteredData = data;

  // Render loading state
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {filtering && (
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
        )}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {rowSelection && (
                  <TableHead className="w-[50px]">
                    <Skeleton className="h-4 w-4" />
                  </TableHead>
                )}
                {columns.map(column => (
                  <TableHead key={column.id}>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {rowSelection && (
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map(column => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <ErrorState error={error} />
      </div>
    );
  }

  // Render empty state
  if (filteredData.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {filtering && (
          <FilterBar columns={columns} filters={filters} onFiltersChange={handleFiltersChange} />
        )}
        <EmptyState
          message={emptyMessage || emptyState?.description || 'No data available'}
          hasFilters={filters.length > 0}
          onClearFilters={handleClearFilters}
        />
      </div>
    );
  }

  const allSelected =
    filteredData.length > 0 &&
    filteredData.every((row, index) => selectedRows.has(getRowId(row, index)));
  const someSelected = filteredData.some((row, index) => selectedRows.has(getRowId(row, index)));

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {filtering && (
        <FilterBar columns={columns} filters={filters} onFiltersChange={handleFiltersChange} />
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {rowSelection && (
                <TableHead className="w-[50px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={ref => {
                      if (ref) ref.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </TableHead>
              )}
              {columns.map(column => (
                <TableHead
                  key={column.id}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                  )}
                >
                  {column.headerRenderer ? (
                    column.headerRenderer({ column })
                  ) : (
                    <span>{column.displayName}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row, index) => {
              const rowId = getRowId(row, index);
              const isSelected = selectedRows.has(rowId);

              return (
                <TableRow
                  key={rowId}
                  className={cn(isSelected && 'bg-muted/50', onRowClick && 'cursor-pointer')}
                  onClick={() => {
                    onRowClick?.(row);
                    rowConfig?.onClick?.(row);
                  }}
                >
                  {rowSelection && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => handleRowSelection(rowId, e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-proper"
                      />
                    </TableCell>
                  )}
                  {columns.map(column => {
                    const value = column.accessor(row);

                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                        )}
                      >
                        {column.cellRenderer ? (
                          column.cellRenderer({
                            value,
                            row,
                            column,
                            rowIndex: index,
                          })
                        ) : (
                          <span>{formatValue(value, column)}</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {paginationEnabled && paginationState && onPageChange && onPageSizeChange && (
        <TablePagination
          currentPage={paginationState.page}
          totalPages={paginationState.totalPages}
          onPageChange={onPageChange}
          pageSize={paginationState.limit}
          onPageSizeChange={onPageSizeChange}
          totalItems={paginationState.totalPages * paginationState.limit}
        />
      )}
    </div>
  );
}

// Helper function to format values // todo: remove this we have helpers
function formatValue(value: any, column: ColumnDefinition): string {
  if (value == null) return '';

  switch (column.type) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'number':
    case 'currency':
    case 'percentage':
      return typeof value === 'number' ? value.toString() : String(value);
    default:
      return String(value);
  }
}
