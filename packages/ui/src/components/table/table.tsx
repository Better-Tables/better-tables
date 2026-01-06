'use client';

import type { ExportFormat, ExportProgress, ExportResult } from '@better-tables/core';
import {
  type ColumnDefinition,
  type ColumnVisibility,
  createApiExportAdapter,
  createInMemoryExportAdapter,
  destroyTableStore,
  type FilterState,
  getFormatterForType,
  getOrCreateTableStore,
  getTableStore,
  type PaginationState,
  type SortingState,
  type TableAdapter,
  type TableConfig,
  type UrlSyncAdapter,
  type UrlSyncConfig,
} from '@better-tables/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, GripVertical } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useExport } from '../../hooks/use-export';
import {
  useTableColumnOrder,
  useTableColumnVisibility,
  useTableFilters,
  useTablePagination,
  useTableSelection,
  useTableSorting,
} from '../../hooks/use-table-store';
import { useTableUrlSync } from '../../hooks/use-table-url-sync';
import { cn } from '../../lib/utils';
import { FilterBar } from '../filters/filter-bar';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ActionsToolbar } from './actions-toolbar';
import { ColumnManagement } from './column-management';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { ExportButton } from './export-button';
import { ExportDialog } from './export-dialog';
import { TableHeaderContextMenu } from './table-header-context-menu';
import { TablePagination } from './table-pagination';
import { TableProviders } from './table-providers';

/**
 * UI-specific props for the BetterTable component
 * Data fetching is handled by parent component
 * State is now managed internally with Zustand
 */
// Type for columns with mixed value types (e.g., string, number, Date, boolean)
// TypeScript cannot express a heterogeneous generic array, so we use 'any' here

// biome-ignore lint/suspicious/noExplicitAny: Need to accept columns with mixed value types
type MixedColumnDefinition<TData> = ColumnDefinition<TData, any>;

export interface BetterTableProps<TData = unknown>
  extends Omit<TableConfig<TData>, 'adapter' | 'columns'> {
  /** Column definitions - may have mixed value types (string, number, Date, etc.) */
  columns: MixedColumnDefinition<TData>[];

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

  /** Initial column visibility (only used on mount) */
  initialColumnVisibility?: ColumnVisibility;

  /** Default visible column IDs - if provided, computes initialColumnVisibility automatically */
  defaultVisibleColumns?: string[];

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

  /** URL synchronization configuration (optional) */
  urlSync?: {
    /** URL adapter for reading/writing URL parameters */
    adapter: UrlSyncAdapter;
    /** Configuration for which state to sync to URL */
    config?: UrlSyncConfig;
  };

  /** Automatically show/hide columns based on active filters.
   * When a filter is applied to a column, that column becomes visible.
   * When the filter is removed, the column is hidden if it's not in defaultVisibleColumns.
   * @default false
   */
  autoShowFilteredColumns?: boolean;

  /** Callback to check if a filter is protected (can't be removed/modified)
   * Protected filters will be shown with a lock icon and cannot be removed.
   */
  isFilterProtected?: (filter: FilterState) => boolean;

  /** Export configuration */
  export?: {
    /** Enable export functionality */
    enabled?: boolean;

    /**
     * API endpoint for fetching export data.
     * Simplifies configuration - no need to create an adapter.
     * The endpoint should accept POST with {offset, limit, filters, sorting}
     * and return {data: TData[], total: number}.
     */
    url?: string;

    /** Table adapter for fetching data during export (alternative to url) */
    adapter?: TableAdapter<TData>;

    /** Available export formats (default: ['csv', 'excel', 'json']) */
    formats?: ExportFormat[];
    /** Default filename for exports (without extension) */
    filename?: string;
    /** Custom value transformer for export */
    valueTransformer?: (
      value: unknown,
      row: TData,
      column: ColumnDefinition<TData>
    ) => string | number | boolean | Date | null;
    /** Callback when export completes */
    onComplete?: (result: ExportResult) => void;
    /** Callback when export fails */
    onError?: (error: Error) => void;
    /** Callback for export progress updates */
    onProgress?: (progress: ExportProgress) => void;
    /** Whether to automatically download on completion (default: true) */
    autoDownload?: boolean;
    /** Batch size for export processing (default: 1000) */
    batchSize?: number;
    /** Show advanced export dialog with column selection (default: true) */
    showDialog?: boolean;
  };
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
  initialColumnVisibility,
  defaultVisibleColumns,

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

  // URL sync props
  urlSync,
  autoShowFilteredColumns = true,

  // Filter protection
  isFilterProtected,

  // Export props
  export: exportConfig,
  ...props
}: BetterTableProps<TData>) {
  const {
    filtering = true,
    sorting: sortingEnabled = true,
    pagination: paginationEnabled = true,
    rowSelection = false,
    headerContextMenu,
    columnReordering = false,
  } = features;

  // Get actions from props
  const actions = props.actions || [];

  // Get groups and autoGroupFilters from props
  const groups = props.groups;
  const autoGroupFilters = props.autoGroupFilters;

  // Enable row selection automatically if actions are provided
  const shouldShowRowSelection = actions.length > 0 || rowSelection;

  // Set defaultVisible on columns based on defaultVisibleColumns if provided
  // This ensures mergeColumnVisibility in URL sync uses the correct defaults
  const columnsWithDefaults = useMemo(() => {
    if (!defaultVisibleColumns) return columns;

    return columns.map((col) => ({
      ...col,
      defaultVisible: defaultVisibleColumns.includes(col.id),
    }));
  }, [columns, defaultVisibleColumns]);

  // Compute initial column visibility from defaultVisibleColumns if provided
  // Priority: initialColumnVisibility > defaultVisibleColumns > undefined (all visible)
  const computedColumnVisibility = useMemo<ColumnVisibility | undefined>(() => {
    // If initialColumnVisibility is explicitly provided, use it
    if (initialColumnVisibility) return initialColumnVisibility;

    // If defaultVisibleColumns is provided, compute from it
    if (defaultVisibleColumns) {
      const visibility: ColumnVisibility = {};
      columnsWithDefaults.forEach((col) => {
        visibility[col.id] = defaultVisibleColumns.includes(col.id);
      });
      return visibility;
    }

    // Default: all columns visible (undefined)
    return undefined;
  }, [columnsWithDefaults, defaultVisibleColumns, initialColumnVisibility]);

  // Initialize store synchronously during render
  // The store creation is idempotent - it only creates once per ID
  // All state management is delegated to the TableStateManager
  // Create store synchronously (not in useMemo) to ensure it exists before hooks run
  // This fixes React Strict Mode issues where useMemo may not execute on first render
  const store = getOrCreateTableStore(id, {
    columns: columnsWithDefaults,
    filters: initialFilters,
    pagination: initialPagination,
    sorting: initialSorting,
    selectedRows: initialSelectedRows,
    columnVisibility: computedColumnVisibility,
  });

  // Subscribe to store state
  // Store is guaranteed to exist now since we created it synchronously above
  const { filters, setFilters, clearFilters } = useTableFilters(id);
  const { pagination, setPage, setPageSize } = useTablePagination(id);
  const { sorting: sortingState, toggleSort, setSorting } = useTableSorting(id);
  const { selectedRows, toggleRow, selectAll, clearSelection } = useTableSelection(id);
  const { columnVisibility, toggleColumnVisibility, setColumnVisibility } =
    useTableColumnVisibility(id);
  const { columnOrder, setColumnOrder } = useTableColumnOrder(id);

  // Set up URL synchronization if adapter is provided
  // Compression/decompression is handled automatically by useTableUrlSync
  // Always call the hook (React rules), but use a no-op adapter if urlSync is not provided
  const urlAdapter = useMemo(
    () =>
      urlSync?.adapter || {
        getParam: () => null,
        setParams: () => {},
      },
    [urlSync?.adapter]
  );

  useTableUrlSync(
    id,
    urlSync?.config || {
      filters: false,
      pagination: false,
      sorting: false,
      columnVisibility: false,
      columnOrder: false,
    },
    urlAdapter
  );

  // Set up export functionality
  // Export is enabled if: enabled=true AND (adapter OR url OR data is provided)
  const hasExportDataSource = Boolean(
    exportConfig?.adapter || exportConfig?.url || (data && data.length > 0)
  );
  const exportEnabled = Boolean(exportConfig?.enabled && hasExportDataSource);

  // Auto-create adapter from url or data if no adapter provided
  const exportAdapter = useMemo((): TableAdapter<TData> | null => {
    if (!exportConfig?.enabled) return null;
    // Use provided adapter first
    if (exportConfig.adapter) return exportConfig.adapter;
    // Create adapter from URL
    if (exportConfig.url) {
      return createApiExportAdapter<TData>({ url: exportConfig.url });
    }
    // Use table data directly (for small datasets already in memory)
    if (data && data.length > 0) {
      return createInMemoryExportAdapter<TData>(data);
    }
    return null;
  }, [exportConfig?.enabled, exportConfig?.adapter, exportConfig?.url, data]);

  // Export hook - only meaningful when adapter is available
  const exportHook = useExport({
    columns: columnsWithDefaults,
    adapter: exportAdapter as TableAdapter<TData>,
    filters,
    sorting: sortingState,
    valueTransformer: exportConfig?.valueTransformer,
    onComplete: exportConfig?.onComplete,
    onError: exportConfig?.onError,
    onProgress: exportConfig?.onProgress,
    autoDownload: exportConfig?.autoDownload ?? true,
  });

  // Handle simple export action (format only)
  const handleExportFormat = useCallback(
    (format: ExportFormat) => {
      if (!exportEnabled) return;
      exportHook.startExport({
        format,
        filename: exportConfig?.filename ?? `${id}-export`,
        filters,
        sorting: sortingState,
        batch: { batchSize: exportConfig?.batchSize ?? 1000 },
      });
    },
    [
      exportHook,
      exportConfig?.filename,
      exportConfig?.batchSize,
      id,
      filters,
      sortingState,
      exportEnabled,
    ]
  );

  // Handle advanced export action (full config with column selection)
  const handleExportConfig = useCallback(
    (config: {
      format: ExportFormat;
      filename?: string;
      columns?: Array<{ columnId: string }>;
      batch?: { batchSize?: number };
      exportSelectedOnly?: boolean;
    }) => {
      if (!exportEnabled) return;
      exportHook.startExport({
        format: config.format,
        filename: config.filename ?? exportConfig?.filename ?? `${id}-export`,
        columns: config.columns,
        filters,
        sorting: sortingState,
        batch: {
          batchSize: config.batch?.batchSize ?? exportConfig?.batchSize ?? 1000,
        },
        // If exporting selected only, pass the selected IDs
        selectedIds: config.exportSelectedOnly ? Array.from(selectedRows) : undefined,
        scope: config.exportSelectedOnly ? 'selected' : 'all',
      });
    },
    [
      exportHook,
      exportConfig?.filename,
      exportConfig?.batchSize,
      id,
      filters,
      sortingState,
      exportEnabled,
      selectedRows,
    ]
  );

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

  // Auto-show/hide columns based on filters
  const previousFiltersRef = React.useRef<FilterState[]>([]);
  useEffect(() => {
    if (!autoShowFilteredColumns) {
      return;
    }

    const previousFilters = previousFiltersRef.current;
    const currentFilteredColumns = new Set(filters.map((f) => f.columnId));
    const previousFilteredColumns = new Set(previousFilters.map((f) => f.columnId));

    // Find columns that were just filtered (added to filters)
    const newlyFilteredColumns = Array.from(currentFilteredColumns).filter(
      (col) => !previousFilteredColumns.has(col)
    );

    // Find columns that had filters removed
    const unfilteredColumns = Array.from(previousFilteredColumns).filter(
      (col) => !currentFilteredColumns.has(col)
    );

    // Show newly filtered columns
    if (newlyFilteredColumns.length > 0) {
      const newVisibility = { ...columnVisibility };
      for (const columnId of newlyFilteredColumns) {
        newVisibility[columnId] = true;
      }
      setColumnVisibility(newVisibility);
    }

    // Hide columns that had filters removed (only if not in defaultVisibleColumns)
    if (unfilteredColumns.length > 0 && defaultVisibleColumns) {
      const newVisibility = { ...columnVisibility };
      for (const columnId of unfilteredColumns) {
        // Only hide if it's not in defaultVisibleColumns
        if (!defaultVisibleColumns.includes(columnId)) {
          newVisibility[columnId] = false;
        }
      }
      setColumnVisibility(newVisibility);
    }

    // Update ref for next comparison
    previousFiltersRef.current = filters;
  }, [
    autoShowFilteredColumns,
    filters,
    columnVisibility,
    setColumnVisibility,
    defaultVisibleColumns,
  ]);

  // Get row ID function from rowConfig or use default
  const getRowId = useMemo(() => {
    return (
      rowConfig?.getId ||
      ((row: TData, _index: number) => {
        // Try to find an id field using common patterns
        if (typeof row === 'object' && row !== null) {
          const obj = row as Record<string, unknown>;
          if ('id' in obj && obj.id != null) {
            return String(obj.id);
          }
          if ('_id' in obj && obj._id != null) {
            return String(obj._id);
          }
          if ('uuid' in obj && obj.uuid != null) {
            return String(obj.uuid);
          }
        }
        // Fallback to index only if no ID field found
        return `row-${_index}`;
      })
    );
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

  // Reset all table state handler
  const handleReset = useCallback(() => {
    const state = store.getState();
    state.reset();
  }, [store]);

  // Check if context menu is enabled
  const contextMenuEnabled = headerContextMenu?.enabled ?? false;

  // Screen reader announcement for sort changes
  const sortAnnouncement = React.useMemo(() => {
    if (sortingState.length === 0) return '';
    return sortingState
      .map((sort) => {
        const column = columnsWithDefaults.find((c) => c.id === sort.columnId);
        return `${column?.displayName} sorted ${sort.direction === 'asc' ? 'ascending' : 'descending'}`;
      })
      .join(', ');
  }, [sortingState, columnsWithDefaults]);

  // Filter columns by visibility and apply column order (must be before any early returns)
  const visibleColumns = useMemo(() => {
    const visible = columnsWithDefaults.filter((col) => columnVisibility[col.id] !== false);

    // If we have a custom column order, apply it
    if (columnOrder.length > 0) {
      // Create a map of column IDs to columns for quick lookup
      const columnMap = new Map(visible.map((col) => [col.id, col]));

      // Apply the order from columnOrder, filtering to only include visible columns
      const ordered = columnOrder
        .map((id) => columnMap.get(id))
        .filter((col): col is (typeof columnsWithDefaults)[0] => col !== undefined);

      // Add any columns that are visible but not in columnOrder (shouldn't happen, but defensive)
      const unorderedIds = new Set(ordered.map((col) => col.id));
      const remaining = visible.filter((col) => !unorderedIds.has(col.id));

      return [...ordered, ...remaining];
    }

    return visible;
  }, [columnsWithDefaults, columnVisibility, columnOrder]);

  // Render loading state
  if (loading) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Fine for live regions
      <div
        className={cn('space-y-4', className)}
        role="status"
        aria-live="polite"
        aria-label="Loading table data"
      >
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
                {shouldShowRowSelection && (
                  <TableHead className="w-[50px]">
                    <Skeleton className="h-4 w-4" />
                  </TableHead>
                )}
                {columnsWithDefaults.map((column) => (
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
                    {shouldShowRowSelection && (
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    )}
                    {columnsWithDefaults.map((column) => (
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
        <div className="flex items-center gap-2">
          {filtering && (
            <FilterBar
              columns={columnsWithDefaults}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              groups={groups}
              autoGroupFilters={autoGroupFilters}
              onReset={handleReset}
              searchable={false}
              isFilterProtected={isFilterProtected}
            />
          )}
          <ColumnManagement
            columns={columnsWithDefaults}
            columnVisibility={columnVisibility}
            onToggleVisibility={toggleColumnVisibility}
            columnOrder={columnOrder}
            onResetColumnOrder={() => {
              const store = getTableStore(id);
              if (store) store.getState().resetColumnOrder();
            }}
            enableReordering={columnReordering}
            show={features.columnVisibility !== false}
          />
        </div>
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
      {/* Screen reader announcement for sort changes */}
      {sortAnnouncement && (
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {sortAnnouncement}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Actions Toolbar - render independently of filtering */}
        {actions.length > 0 && (
          <ActionsToolbar
            actions={actions}
            selectedIds={Array.from(selectedRows)}
            selectedData={data.filter((row, index) => selectedRows.has(getRowId(row, index)))}
            onActionMake={() => {
              // Action executed - could trigger data refresh
              // This callback can be used by parent to refetch data
            }}
          />
        )}

        {/* Filter Bar - only show when filtering is enabled */}
        {filtering && (
          <FilterBar
            columns={columnsWithDefaults}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            groups={groups}
            autoGroupFilters={autoGroupFilters}
            onReset={handleReset}
            searchable={false}
            isFilterProtected={isFilterProtected}
          />
        )}

        {/* Export - show when export is enabled */}
        {exportEnabled &&
          (exportConfig?.showDialog !== false ? (
            <ExportDialog
              columns={columnsWithDefaults}
              totalRows={totalCount ?? 0}
              onExport={handleExportConfig}
              isExporting={exportHook.isExporting}
              progress={exportHook.progress}
              lastResult={exportHook.lastResult}
              onCancel={exportHook.cancelExport}
              onReset={exportHook.clearLastResult}
              formats={exportConfig?.formats ?? ['csv', 'excel', 'json']}
              defaultFilename={exportConfig?.filename ?? `${id}-export`}
              selectedRowCount={selectedRows.size}
              trigger={
                <Button variant="outline" size="default" className='h-8'>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              }
            />
          ) : (
            <ExportButton
              onExport={handleExportFormat}
              isExporting={exportHook.isExporting}
              progress={exportHook.progress}
              onCancel={exportHook.cancelExport}
              formats={exportConfig?.formats ?? ['csv', 'excel', 'json']}
              totalRows={totalCount}
            />
          ))}

        {/* Column Management - separate from filter bar */}
        <ColumnManagement
          columns={columnsWithDefaults}
          columnVisibility={columnVisibility}
          onToggleVisibility={toggleColumnVisibility}
          columnOrder={columnOrder}
          onResetColumnOrder={() => {
            const store = getTableStore(id);
            if (store) store.getState().resetColumnOrder();
          }}
          enableReordering={columnReordering}
          show={features.columnVisibility !== false}
        />
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {shouldShowRowSelection && (
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
                    columns={columnsWithDefaults}
                  >
                    <TableHead
                      className={cn(
                        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
                      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
                  onKeyDown={(e) => {
                    if (onRowClick || rowConfig?.onClick) {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick?.(row);
                        rowConfig?.onClick?.(row);
                      }
                    }
                  }}
                  tabIndex={onRowClick || rowConfig?.onClick ? 0 : undefined}
                  role={onRowClick || rowConfig?.onClick ? 'button' : undefined}
                  aria-label={
                    onRowClick || rowConfig?.onClick
                      ? `Row ${index + 1}: Click to view details`
                      : undefined
                  }
                >
                  {shouldShowRowSelection && (
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
                        {column.cellRenderer
                          ? column.cellRenderer({
                              value,
                              row,
                              column,
                              rowIndex: index,
                            })
                          : (() => {
                              const formatted = getFormatterForType(
                                column.type,
                                value,
                                column.meta
                              );
                              const truncateConfig = column.meta?.truncate as
                                | { maxLength?: number; suffix?: string; showTooltip?: boolean }
                                | undefined;

                              // Show tooltip for truncated text if showTooltip is enabled
                              if (truncateConfig?.showTooltip && value != null) {
                                const originalValue = String(value);
                                const maxLen = truncateConfig.maxLength || 50;
                                const isTruncated = originalValue.length > maxLen;

                                if (isTruncated) {
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help truncate max-w-full inline-block">
                                          {formatted}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs" showArrow>
                                        <div className="wrap-break-word whitespace-pre-wrap text-pretty">
                                          {originalValue}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                }
                              }

                              return <span>{formatted}</span>;
                            })()}
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
    const activeId = event.active.id;

    // Handle sort reordering first (check if this is a sort drag)
    const oldIndex = sortingState.findIndex((s) => s.columnId === activeId);
    const newIndex = sortingState.findIndex((s) => s.columnId === overId);

    // Handle drop zones (they have IDs like "sort-drop-before-0")
    if (oldIndex >= 0 && newIndex < 0) {
      // Dropped on a drop zone - check if it's a valid sort zone
      if (overId.startsWith('sort-drop-')) {
        // Extract target index from drop zone ID
        const dropMatch = overId.match(/sort-drop-(before|after)-(\d+)/);
        if (dropMatch?.[1] && dropMatch[2]) {
          const position = dropMatch[1];
          const targetIndex = parseInt(dropMatch[2], 10);

          const newSorts = [...sortingState];
          const [removed] = newSorts.splice(oldIndex, 1);

          // Insert before or after the target index
          if (removed) {
            const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
            newSorts.splice(insertIndex, 0, removed);
          }

          setSorting(newSorts);
          return;
        }
      }
    }

    // Normal sort reordering between items
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      const newSorts = arrayMove(sortingState, oldIndex, newIndex);
      setSorting(newSorts);
      return;
    }

    // Handle column reordering (check for column-drop-* zones or column IDs in columnOrder)
    const columnOrderIndex = columnOrder.indexOf(activeId);
    const columnOrderTargetIndex = columnOrder.indexOf(overId);

    if (columnOrderIndex >= 0 || columnOrderTargetIndex >= 0 || overId.startsWith('column-drop-')) {
      let newOrder: string[];

      if (overId.startsWith('column-drop-')) {
        // Dropped on a column drop zone
        const dropMatch = overId.match(/column-drop-(before|after)-(\d+)/);
        if (dropMatch?.[1] && dropMatch[2]) {
          const position = dropMatch[1];
          const targetIndex = parseInt(dropMatch[2], 10);

          newOrder = [...columnOrder];
          const [removed] = newOrder.splice(columnOrderIndex, 1);

          if (removed) {
            const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
            newOrder.splice(insertIndex, 0, removed);
          }
          setColumnOrder(newOrder);
        }
      } else if (
        columnOrderIndex >= 0 &&
        columnOrderTargetIndex >= 0 &&
        columnOrderIndex !== columnOrderTargetIndex
      ) {
        // Normal column reordering between items
        newOrder = arrayMove(columnOrder, columnOrderIndex, columnOrderTargetIndex);
        setColumnOrder(newOrder);
      }
      return;
    }
  };

  // Render function for drag overlay preview
  const renderDragOverlay = (activeId: string) => {
    const sort = sortingState.find((s) => s.columnId === activeId);
    if (!sort) return null;

    const column = columnsWithDefaults.find((col) => col.id === sort.columnId);
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

  return (
    <TableProviders
      enableTooltip={true}
      enableDnd={shouldShowContextMenu}
      onDragEnd={handleDragEnd}
      renderDragOverlay={renderDragOverlay}
    >
      {tableContent}
    </TableProviders>
  );
}
