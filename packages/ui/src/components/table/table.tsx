import type {
  FilterState,
  PaginationState,
  SortDirection,
  SortingState,
  TableConfig,
} from '@better-tables/core';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { getFormatterForType } from '../../lib/format-utils';
import { cn } from '../../lib/utils';
import { FilterBar } from '../filters/filter-bar';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { TablePagination } from './table-pagination';

/**
 * UI-specific props for the BetterTable component
 * Data fetching is handled by parent component
 */
export interface BetterTableProps<TData = unknown> extends Omit<TableConfig<TData>, 'adapter'> {
  /** Table data */
  data: TData[];

  /** Adapter (optional when data is provided directly) */
  adapter?: TableConfig<TData>['adapter'];

  /** Loading state */
  loading?: boolean;

  /** Error state */
  error?: Error | null;

  /** Current filter state */
  filters?: FilterState[];

  /** Filter change handler */
  onFiltersChange?: (filters: FilterState[]) => void;

  /** Current sorting state */
  sortingState?: SortingState;

  /** Callback when sorting changes */
  onSortingChange?: (sorting: SortingState) => void;

  /** Total number of items (for pagination) */
  totalCount?: number;

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

  /** Retry handler for error state */
  onRetry?: () => void;
}

export function BetterTable<TData = unknown>({
  // Core table config (minus adapter)
  columns,
  features = {},
  rowConfig,
  emptyState,
  errorState,

  // Data props (handled by parent)
  data,
  loading = false,
  error = null,
  totalCount,

  // UI-specific props
  filters = [],
  onFiltersChange,
  sortingState = [],
  onSortingChange,
  paginationState,
  onPageChange,
  onPageSizeChange,
  selectedRows = new Set(),
  onRowSelectionChange,
  className,
  onRowClick,
  emptyMessage,
  onRetry,
  ...props
}: BetterTableProps<TData>) {
  const {
    filtering = true,
    sorting = true,
    pagination: paginationEnabled = true,
    rowSelection = false,
  } = features;

  // Get row ID function from rowConfig or use default
  const getRowId = useMemo(() => {
    return rowConfig?.getId || ((_row: TData, index: number) => `row-${index}`);
  }, [rowConfig?.getId]);

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: FilterState[]) => {
      onFiltersChange?.(newFilters);
    },
    [onFiltersChange]
  );

  // Handle sorting changes
  const handleSortingChange = useCallback(
    (columnId: string) => {
      if (!onSortingChange) return;

      const currentSort = sortingState.find((s) => s.columnId === columnId);
      let newSorting: SortingState;

      if (currentSort) {
        // Cycle through: asc -> desc -> none
        if (currentSort.direction === 'asc') {
          newSorting = sortingState.map((s) =>
            s.columnId === columnId ? { ...s, direction: 'desc' as SortDirection } : s
          );
        } else {
          // Remove from sorting
          newSorting = sortingState.filter((s) => s.columnId !== columnId);
        }
      } else {
        // Add new sort (asc)
        newSorting = [...sortingState, { columnId, direction: 'asc' as SortDirection }];
      }

      onSortingChange(newSorting);
    },
    [sortingState, onSortingChange]
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
    [selectedRows, onRowSelectionChange]
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
    [data, getRowId, onRowSelectionChange]
  );

  // Clear filters handler
  const handleClearFilters = useCallback(() => {
    onFiltersChange?.([]);
  }, [onFiltersChange]);

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
                {columns.map((column) => (
                  <TableHead key={column.id}>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, rowIdx) => {
                // Use skeleton row+column combo as key to avoid using only index
                const rowKey = `skeleton-row-${rowIdx}`;
                return (
                  <TableRow key={rowKey}>
                    {rowSelection && (
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={`${rowKey}-col-${column.id}`}>
                        <Skeleton className="h-4 w-[100px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
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
        <ErrorState error={error} onRetry={onRetry} title={errorState?.title} />
      </div>
    );
  }

  // Render empty state
  if (data.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {filtering && (
          <FilterBar columns={columns} filters={filters} onFiltersChange={handleFiltersChange} />
        )}
        <EmptyState
          message={emptyMessage || emptyState?.description || 'No data available'}
          hasFilters={filters.length > 0}
          onClearFilters={handleClearFilters}
          icon={emptyState?.icon as React.ComponentType<unknown>}
        />
      </div>
    );
  }

  const allSelected =
    data.length > 0 && data.every((row, index) => selectedRows.has(getRowId(row, index)));
  const someSelected = data.some((row, index) => selectedRows.has(getRowId(row, index)));

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
                    ref={(ref) => {
                      if (ref) ref.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </TableHead>
              )}
              {columns.map((column) => {
                const currentSort = sortingState.find((s) => s.columnId === column.id);
                const isSortable = sorting && column.sortable !== false;

                return (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      isSortable && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={isSortable ? () => handleSortingChange(column.id) : undefined}
                  >
                    {column.headerRenderer ? (
                      column.headerRenderer({
                        column,
                        isSorted: !!currentSort,
                        sortDirection: currentSort?.direction,
                        onSort: isSortable ? () => handleSortingChange(column.id) : undefined,
                      })
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{column.displayName}</span>
                        {isSortable && (
                          <div className="flex flex-col">
                            {currentSort?.direction === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : currentSort?.direction === 'desc' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => {
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
                        onChange={(e) => handleRowSelection(rowId, e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => {
                    const value = column.accessor(row);

                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
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
                          <span>{getFormatterForType(column.type, value, column.meta)}</span>
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
          totalItems={totalCount ?? paginationState.totalPages * paginationState.limit}
        />
      )}
    </div>
  );
}
