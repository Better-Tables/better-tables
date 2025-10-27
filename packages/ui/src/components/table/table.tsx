'use client';

import type { FilterState, PaginationState, SortingState, TableConfig } from '@better-tables/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import {
  useTableColumnVisibility,
  useTableFilters,
  useTablePagination,
  useTableSelection,
  useTableSorting,
} from '../../hooks/use-table-store';
import { getFormatterForType } from '../../lib/format-utils';
import { cn } from '../../lib/utils';
import { destroyTableStore, getOrCreateTableStore } from '../../stores/table-registry';
import { FilterBar } from '../filters/filter-bar';
import { Checkbox } from '../ui/checkbox';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { TableDndProvider } from './table-dnd-provider';
import { TableHeaderContextMenu } from './table-header-context-menu';
import { TablePagination } from './table-pagination';

/**
 * UI-specific props for the BetterTable component
 * Data fetching is handled by parent component
 * State is now managed internally with Zustand
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

  /** Total number of items (for pagination) */
  totalCount?: number;

  /** Initial filter state (only used on mount) */
  initialFilters?: FilterState[];

  /** Initial sorting state (only used on mount) */
  initialSorting?: SortingState;

  /** Initial pagination state (only used on mount) */
  initialPagination?: PaginationState;

  /** Initial selected rows (only used on mount) */
  initialSelectedRows?: Set<string>;

  /** Optional callback when filters change (for side effects) */
  onFiltersChange?: (filters: FilterState[]) => void;

  /** Optional callback when sorting changes (for side effects) */
  onSortingChange?: (sorting: SortingState) => void;

  /** Optional callback when pagination changes (for side effects) */
  onPaginationChange?: (pagination: PaginationState) => void;

  /** Optional callback when page changes (for side effects) */
  onPageChange?: (page: number) => void;

  /** Optional callback when page size changes (for side effects) */
  onPageSizeChange?: (pageSize: number) => void;

  /** Optional callback when selection changes (for side effects) */
  onSelectionChange?: (selected: Set<string>) => void;

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
  id,
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

  // Initial state (only used on mount)
  initialFilters = [],
  initialSorting = [],
  initialPagination = { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
  initialSelectedRows = new Set<string>(),

  // Optional callbacks for side effects
  onFiltersChange,
  onSortingChange,
  onPaginationChange,
  onPageChange,
  onPageSizeChange,
  onSelectionChange,

  // UI props
  className,
  onRowClick,
  emptyMessage,
  onRetry,
  ...props
}: BetterTableProps<TData>) {
  const {
    filtering = true,
    sorting: sortingEnabled = true,
    pagination: paginationEnabled = true,
    rowSelection = false,
    headerContextMenu,
  } = features;

  // Initialize store synchronously during render
  // The store creation is idempotent - it only creates once per ID
  // All state management is delegated to the TableStateManager
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only create once per table ID
  const store = useMemo(() => {
    return getOrCreateTableStore(id, {
      columns,
      filters: initialFilters,
      pagination: initialPagination,
      sorting: initialSorting,
      selectedRows: initialSelectedRows,
    });
  }, [id]); // Only depend on id - we don't want to recreate on every prop change

  // Subscribe to store state
  const { filters, setFilters, clearFilters } = useTableFilters(id);
  const { pagination, setPage, setPageSize } = useTablePagination(id);
  const { sorting: sortingState, toggleSort, setSorting } = useTableSorting(id);
  const { selectedRows, toggleRow, selectAll, clearSelection } = useTableSelection(id);
  const { columnVisibility, toggleColumnVisibility } = useTableColumnVisibility(id);

  // Cleanup store on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      destroyTableStore(id);
    };
  }, [id]);

  // Update pagination totalPages when totalCount changes
  useEffect(() => {
    if (totalCount !== undefined) {
      const state = store.getState();
      state.setTotal(totalCount);
    }
  }, [store, totalCount]);

  // Call optional callbacks when state changes
  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  useEffect(() => {
    onSortingChange?.(sortingState);
  }, [sortingState, onSortingChange]);

  useEffect(() => {
    onPaginationChange?.(pagination);
  }, [pagination, onPaginationChange]);

  useEffect(() => {
    onPageChange?.(pagination.page);
  }, [pagination.page, onPageChange]);

  useEffect(() => {
    onPageSizeChange?.(pagination.limit);
  }, [pagination.limit, onPageSizeChange]);

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [selectedRows, onSelectionChange]);

  // Get row ID function from rowConfig or use default
  const getRowId = useMemo(() => {
    return rowConfig?.getId || ((_row: TData, index: number) => `row-${index}`);
  }, [rowConfig?.getId]);

  // Handle filter changes - just update store
  const handleFiltersChange = useCallback(
    (newFilters: FilterState[]) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Handle sorting changes - use store's toggleSort
  const handleSortingChange = useCallback(
    (columnId: string) => {
      toggleSort(columnId);
    },
    [toggleSort]
  );

  // Handle row selection
  const handleRowSelection = useCallback(
    (rowId: string, _selected: boolean) => {
      toggleRow(rowId);
    },
    [toggleRow]
  );

  // Handle select all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const allIds = data.map((row, index) => getRowId(row, index));
        selectAll(allIds);
      } else {
        clearSelection();
      }
    },
    [data, getRowId, selectAll, clearSelection]
  );

  // Clear filters handler
  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  // Check if context menu is enabled
  const contextMenuEnabled = headerContextMenu?.enabled ?? false;

  // Filter columns by visibility (must be before any early returns)
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => columnVisibility[col.id] !== false);
  }, [columns, columnVisibility]);

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

  // Get sorting config to check multi-sort
  const sortingConfig = props.sorting;
  const multiSortEnabled = sortingConfig?.multiSort ?? false;

  // Determine if context menu should be enabled
  const shouldShowContextMenu =
    contextMenuEnabled &&
    (headerContextMenu?.showSortToggle || headerContextMenu?.showColumnVisibility);

  const tableContent = (
    <div className={cn('space-y-4', className)} {...props}>
      {filtering && (
        <FilterBar columns={columns} filters={filters} onFiltersChange={handleFiltersChange} />
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {rowSelection && (
                <TableHead
                  className="w-8 min-w-8 max-w-8 sticky left-0 z-30 bg-background rounded-l-md"
                  style={{ boxShadow: 'inset -1px 0 0 0 hsl(var(--border))' }}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {visibleColumns.map((column) => {
                const currentSort = sortingState.find((s) => s.columnId === column.id);
                const isSortable = sortingEnabled && column.sortable !== false;

                const headerContent = column.headerRenderer ? (
                  column.headerRenderer({
                    column,
                    isSorted: !!currentSort,
                    sortDirection: currentSort?.direction,
                    onSort: isSortable ? () => handleSortingChange(column.id) : undefined,
                  })
                ) : (
                  <div key={`header-${column.id}`} className="flex items-center gap-2">
                    <span>{column.displayName}</span>
                    {isSortable && (
                      <span className="flex flex-col">
                        {currentSort?.direction === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : currentSort?.direction === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                );

                return shouldShowContextMenu ? (
                  <TableHeaderContextMenu
                    key={column.id}
                    column={column}
                    contextMenuConfig={headerContextMenu || {}}
                    currentSort={currentSort}
                    allSorts={sortingState}
                    multiSortEnabled={multiSortEnabled}
                    isVisible={columnVisibility[column.id] !== false}
                    onSetSortAsc={() => {
                      const newSorts = [...sortingState];
                      const existingIndex = newSorts.findIndex((s) => s.columnId === column.id);
                      if (existingIndex >= 0) {
                        newSorts[existingIndex] = { columnId: column.id, direction: 'asc' };
                      } else {
                        newSorts.push({ columnId: column.id, direction: 'asc' });
                      }
                      setSorting(newSorts);
                    }}
                    onSetSortDesc={() => {
                      const newSorts = [...sortingState];
                      const existingIndex = newSorts.findIndex((s) => s.columnId === column.id);
                      if (existingIndex >= 0) {
                        newSorts[existingIndex] = { columnId: column.id, direction: 'desc' };
                      } else {
                        newSorts.push({ columnId: column.id, direction: 'desc' });
                      }
                      setSorting(newSorts);
                    }}
                    onClearSort={() => {
                      const newSorts = sortingState.filter((s) => s.columnId !== column.id);
                      setSorting(newSorts);
                    }}
                    onSortReorder={setSorting}
                    onToggleVisibility={() => toggleColumnVisibility(column.id)}
                    columns={columns}
                  >
                    <TableHead
                      className={cn(
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        isSortable && 'cursor-pointer hover:bg-muted/50'
                      )}
                      onClick={isSortable ? () => handleSortingChange(column.id) : undefined}
                      onKeyDown={
                        isSortable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSortingChange(column.id);
                              }
                            }
                          : undefined
                      }
                      tabIndex={isSortable ? 0 : undefined}
                      role="columnheader"
                      aria-sort={
                        currentSort?.direction === 'asc'
                          ? 'ascending'
                          : currentSort?.direction === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                    >
                      {headerContent}
                    </TableHead>
                  </TableHeaderContextMenu>
                ) : (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      isSortable && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={isSortable ? () => handleSortingChange(column.id) : undefined}
                    onKeyDown={
                      isSortable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSortingChange(column.id);
                            }
                          }
                        : undefined
                    }
                    tabIndex={isSortable ? 0 : undefined}
                  >
                    {headerContent}
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
                    <TableCell
                      className="w-8 min-w-8 max-w-8 sticky left-0 z-30 bg-background rounded-l-md"
                      style={{ boxShadow: 'inset -1px 0 0 0 hsl(var(--border))' }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleRowSelection(rowId, checked === true)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => {
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

      {paginationEnabled && (
        <TablePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          pageSize={pagination.limit}
          onPageSizeChange={setPageSize}
          totalItems={totalCount ?? pagination.totalPages * pagination.limit}
        />
      )}
    </div>
  );

  // Wrap with DnD provider if context menu is enabled
  const handleDragEnd = (event: { active: { id: string }; over: { id: string } | null }) => {
    if (!event.over) return;

    const overId = event.over.id;

    // Find indices by columnId matching
    const oldIndex = sortingState.findIndex((s) => s.columnId === event.active.id);
    const newIndex = sortingState.findIndex((s) => s.columnId === overId);

    // Handle drop zones (they have IDs like "sort-drop-before-0")
    if (oldIndex >= 0 && newIndex < 0) {
      // Dropped on a drop zone - check if it's a valid zone
      if (overId.startsWith('sort-drop-')) {
        // Extract target index from drop zone ID
        const dropMatch = overId.match(/sort-drop-(before|after)-(\d+)/);
        if (dropMatch) {
          const position = dropMatch[1];
          const targetIndex = parseInt(dropMatch[2], 10);

          const newSorts = [...sortingState];
          const [removed] = newSorts.splice(oldIndex, 1);

          // Insert before or after the target index
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          newSorts.splice(insertIndex, 0, removed);

          setSorting(newSorts);
          return;
        }
      }
      return;
    }

    // Normal reordering between items
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      const newSorts = arrayMove(sortingState, oldIndex, newIndex);
      setSorting(newSorts);
    }
  };

  // Render function for drag overlay preview
  const renderDragOverlay = (activeId: string) => {
    const sort = sortingState.find((s) => s.columnId === activeId);
    if (!sort) return null;

    const column = columns.find((col) => col.id === sort.columnId);
    const columnName = column?.displayName || sort.columnId;
    const index = sortingState.findIndex((s) => s.columnId === activeId);

    return (
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm bg-background shadow-lg border"
        style={{ opacity: 0.8 }}
      >
        <div className="cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {index + 1}
        </span>
        <span className="flex-1 truncate">{columnName}</span>
        {sort.direction === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ArrowDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    );
  };

  return shouldShowContextMenu ? (
    <TableDndProvider onDragEnd={handleDragEnd} renderDragOverlay={renderDragOverlay}>
      {tableContent}
    </TableDndProvider>
  ) : (
    tableContent
  );
}
