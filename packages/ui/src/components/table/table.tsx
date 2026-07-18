'use client';

import {
  type CellEditAction,
  type ColumnDefinition,
  type ColumnVisibility,
  destroyTableStore,
  type FilterState,
  getFormatterForType,
  getOrCreateTableStore,
  getTableStore,
  type PaginationState,
  resolveTableColumns,
  type SortingState,
  type TableConfig,
  type TableDefinition,
  tableNeedsColumnResolution,
  type UrlSyncAdapter,
  type UrlSyncConfig,
} from '@better-tables/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from 'lucide-react';
import * as React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { TableAdapterProvider } from '../../hooks/use-column-options';
import {
  type CellEditErrorHandler,
  type CellEditHandler,
  useEditableCells,
} from '../../hooks/use-editable-cells';
import {
  useTableColumnOrder,
  useTableColumnVisibility,
  useTableFilters,
  useTablePagination,
  useTableSelection,
  useTableSorting,
} from '../../hooks/use-table-store';
import { useTableUrlSync } from '../../hooks/use-table-url-sync';
import { useVirtualization } from '../../hooks/use-virtualization';
import { cn } from '../../lib/utils';
import { FilterBar } from '../filters/filter-bar';
import { Checkbox } from '../ui/checkbox';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ActionsToolbar } from './actions-toolbar';
import { EditableCell } from './editable-cell';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { TableHeaderContextMenu } from './table-header-context-menu';
import { TablePagination } from './table-pagination';
import { TableProviders } from './table-providers';

/** Tuning for {@link BetterTableProps.virtualized}. */
export interface BetterTableVirtualization {
  /** Scroll viewport height in px. Default `480`. */
  height?: number;
  /** Row height in px (the estimate for dynamic rows). Default `52`. */
  rowHeight?: number;
  /** Extra rows rendered above/below the viewport. Default `5`. */
  overscan?: number;
}

/** Defaults for the `virtualized` prop. */
const VIRTUAL_DEFAULT_HEIGHT = 480;
const VIRTUAL_DEFAULT_ROW_HEIGHT = 52;
const VIRTUAL_DEFAULT_OVERSCAN = 5;

/**
 * Style for a virtualization spacer cell. The height lives on the `<td>` (not
 * the `<tr>`) because an empty row with no cells collapses to zero height in
 * real layout regardless of its `height` — which would leave the scroll height
 * equal to the rendered window instead of the whole dataset. Padding/border are
 * zeroed so the spacer contributes nothing but the space it stands in for.
 */
function virtualSpacerStyle(height: number): React.CSSProperties {
  return { height, padding: 0, border: 0 };
}

/**
 * UI-specific props for the BetterTable component
 * Data fetching is handled by parent component
 * State is now managed internally with Zustand
 */
export interface BetterTableProps<TData = unknown>
  extends Omit<TableConfig<TData>, 'adapter' | 'columns' | 'id' | 'name'> {
  /**
   * Unique identifier for the table instance. Optional when `table` is
   * provided -- defaults to `table.tableName`. One of `id`/`table` is
   * required.
   */
  id?: string;

  /**
   * Human-readable display name. Optional when `table` is provided --
   * defaults to `table.tableName`.
   */
  name?: string;

  /**
   * Column definitions with mixed value types (string, number, Date, etc.).
   *
   * `ColumnDefinition` is invariant in its value type, so a heterogeneous array
   * of differently-typed columns is not directly assignable to
   * `ColumnDefinition<TData, unknown>[]`. Build the array with
   * `defineColumns<TData>()([...])` from `@better-tables/core`, which infers each
   * column's value type independently and erases it to `unknown` in one audited
   * place.
   *
   * Optional when `table` is provided -- defaults to `table.columns`. One of
   * `columns`/`table` is required.
   */
  columns?: ColumnDefinition<TData, unknown>[];

  /**
   * A `defineTable()`/`tables.define()` table definition. Sugar for
   * `columns={table.columns}`, and defaults `id`/`name` to
   * `table.tableName` when they're unset. An explicit `columns`/`id`/`name`
   * prop still wins over `table`'s values when both are given.
   *
   * @example
   * ```tsx
   * const usersTable = defineTable<typeof tables>()('users', (t) => ({
   *   columns: [t.text('name'), t.text('email')],
   * }));
   *
   * <BetterTable table={usersTable} data={data} adapter={adapter} />
   * ```
   */
  table?: TableDefinition<string, TData>;

  /**
   * Render only the rows in view instead of all of `data`, so a large `data`
   * array stays fast. Everything else — filtering, sorting, selection, column
   * visibility/reordering, URL sync — is unchanged: virtualization is purely a
   * rendering detail here, not a separate component or data path.
   *
   * `true` uses the defaults; pass an object to tune them. Typically combined
   * with `features.pagination: false` and one large fetch, since windowing
   * already handles arbitrarily many rows.
   *
   * @example
   * ```tsx
   * <BetterTable table={ticketsTable} data={allTickets} virtualized />
   * <BetterTable table={ticketsTable} data={allTickets}
   *   virtualized={{ height: 640, rowHeight: 56 }} />
   * ```
   */
  virtualized?: boolean | BetterTableVirtualization;

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

  /**
   * Persist a cell edit. When provided, wins over the adapter `updateRecord`
   * path (required for `httpAdapter` and custom writes). See plan 053.
   */
  onCellEdit?: CellEditHandler<TData>;

  /** Called when a cell save fails after optimistic update + rollback. */
  onCellEditError?: CellEditErrorHandler<TData>;

  /**
   * Serializable cell-save function (plan 055) — typically the app's
   * `'use server'` wrapper around `tables.cellEditAction(def)`. Save
   * resolution order: `onCellEdit` → `saveAction` → direct adapter.
   */
  saveAction?: CellEditAction;

  /**
   * Table-level master switch for inline editing. Default `true`. Set `false`
   * to render every cell read-only without changing column defs.
   */
  editing?: boolean;
}

/** Ref-latch a frequently-changing callback/value prop so a `useEffect` (or
 * memoized callback) depending on it only needs `[ref]`/no deps at all,
 * rather than re-running whenever the caller passes a new function
 * identity for the same logical callback. */
function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

interface TableRowComponentProps<TData> {
  row: TData;
  rowId: string;
  index: number;
  isSelected: boolean;
  visibleColumns: ColumnDefinition<TData, unknown>[];
  shouldShowRowSelection: boolean;
  clickable: boolean;
  onActivate: (row: TData) => void;
  onToggleSelection: (rowId: string, selected: boolean) => void;
  /** Column ids that can edit when a save path exists (stable Set), or null when none. */
  editableColumnIds: ReadonlySet<string> | null;
  /** Row-level gate: `editable.when` + related-row-id presence (plan 055). */
  isRowCellEditable: (column: ColumnDefinition<TData, unknown>, row: TData) => boolean;
  rowOverlay: Readonly<Record<string, unknown>>;
  rowErrors: Readonly<Record<string, string>>;
  rowSavingColumns: ReadonlySet<string>;
  /** Column id currently being edited in this row, or null. */
  editingColumnId: string | null;
  onBeginCellEdit: (rowId: string, columnId: string) => void;
  onCancelCellEdit: (rowId: string, columnId: string) => void;
  onCommitCellEdit: (args: {
    row: TData;
    rowId: string;
    column: ColumnDefinition<TData, unknown>;
    value: unknown;
    previousValue: unknown;
  }) => void;
}

function TableRowComponent<TData>({
  row,
  rowId,
  index,
  isSelected,
  visibleColumns,
  shouldShowRowSelection,
  clickable,
  onActivate,
  onToggleSelection,
  editableColumnIds,
  isRowCellEditable,
  rowOverlay,
  rowErrors,
  rowSavingColumns,
  editingColumnId,
  onBeginCellEdit,
  onCancelCellEdit,
  onCommitCellEdit,
}: TableRowComponentProps<TData>) {
  return (
    <TableRow
      className={cn(isSelected && 'bg-muted/50', clickable && 'cursor-pointer')}
      onClick={() => onActivate(row)}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onActivate(row);
        }
      }}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? 'button' : undefined}
      aria-label={clickable ? `Row ${index + 1}: Click to view details` : undefined}
    >
      {shouldShowRowSelection && (
        <TableCell
          className="w-8 min-w-8 max-w-8 sticky left-0 z-30 bg-background rounded-l-md"
          style={{ boxShadow: 'inset -1px 0 0 0 hsl(var(--border))' }}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelection(rowId, checked === true)}
          />
        </TableCell>
      )}
      {visibleColumns.map((column) => {
        const accessorValue = column.accessor(row);
        const value =
          column.id in rowOverlay ? (rowOverlay[column.id] as typeof accessorValue) : accessorValue;
        const cellEditable =
          editableColumnIds?.has(column.id) === true &&
          isRowCellEditable(column as ColumnDefinition<TData, unknown>, row);
        const isEditing = editingColumnId === column.id;

        const display = column.cellRenderer
          ? column.cellRenderer({
              value,
              row,
              column,
              rowIndex: index,
            })
          : (() => {
              const formatted = getFormatterForType(column.type, value, column.meta);
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
                      <TooltipTrigger
                        render={<span className="cursor-help truncate max-w-full inline-block" />}
                      >
                        {formatted}
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="wrap-break-word whitespace-pre-wrap text-pretty">
                          {originalValue}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
              }

              return <span>{formatted}</span>;
            })();

        return (
          <TableCell
            key={column.id}
            className={cn(
              // Align digits down numeric/date columns (Geist has true tabular figures).
              (column.type === 'number' ||
                column.type === 'currency' ||
                column.type === 'percentage' ||
                column.type === 'date') &&
                'tabular-nums',
              column.align === 'center' && 'text-center',
              column.align === 'right' && 'text-right'
            )}
          >
            {cellEditable ? (
              <EditableCell
                row={row}
                rowId={rowId}
                column={column}
                value={value}
                editing={isEditing}
                saving={rowSavingColumns.has(column.id)}
                error={rowErrors[column.id] ?? null}
                onBeginEdit={() => onBeginCellEdit(rowId, column.id)}
                onCancel={() => onCancelCellEdit(rowId, column.id)}
                onCommit={(next) =>
                  void onCommitCellEdit({
                    row,
                    rowId,
                    column,
                    value: next,
                    previousValue: accessorValue,
                  })
                }
              >
                {display}
              </EditableCell>
            ) : (
              display
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

/**
 * Memoized so a state change affecting one row (e.g. selection) doesn't
 * re-render every other row. This only bails out when `row`/`visibleColumns`
 * stay referentially stable across renders where nothing the row displays
 * changed — see `BetterTable` for how `onActivate`/`onToggleSelection` are
 * kept stable via `useCallback` (ref-latched for `onActivate`, so an
 * unstable `onRowClick`/`rowConfig.onClick` from the consumer doesn't
 * defeat the memoization either).
 */
const MemoizedTableRow = memo(TableRowComponent) as typeof TableRowComponent;

/**
 * Lazily resolve a `table` definition's columns against the adapter (plan
 * 054): auto columns (`t.auto()` / no-factory `define`) and enrichable gaps
 * (an option column without options) resolve through core's ONE
 * `resolveTableColumns` helper. Returns `null` while a needed resolution is
 * in flight; when `enabled` is false this hook is inert (no state churn, no
 * async hop) so fully-declared tables pay nothing.
 */
function useResolvedTableColumns<TData>(
  enabled: boolean,
  table: TableDefinition<string, TData> | undefined,
  adapter: BetterTableProps<TData>['adapter']
): ColumnDefinition<TData, unknown>[] | null {
  const [resolved, setResolved] = React.useState<ColumnDefinition<TData, unknown>[] | null>(null);

  useEffect(() => {
    if (!enabled || !table) return undefined;
    let cancelled = false;
    // Reset when the definition/adapter changes (no-op on first run: React
    // bails out of a null -> null state update).
    setResolved(null);
    void resolveTableColumns(table, adapter).then((columns) => {
      if (!cancelled) setResolved(columns);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, table, adapter]);

  return enabled ? resolved : null;
}

/** Column count for the columns-resolving skeleton (real columns unknown yet). */
const AUTO_COLUMNS_SKELETON_KEYS = ['first', 'second', 'third'] as const;

/** Skeleton shown while auto columns resolve — mirrors the loading state. */
function AutoColumnsLoading({ className }: { className?: string | undefined }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: Fine for live regions
    <div
      className={cn('space-y-4', className)}
      role="status"
      aria-live="polite"
      aria-label="Loading table columns"
    >
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {AUTO_COLUMNS_SKELETON_KEYS.map((key) => (
                <TableHead key={key}>
                  <Skeleton className="h-4 w-[100px]" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, rowIdx) => {
              const rowKey = `auto-columns-skeleton-${rowIdx}`;
              return (
                <TableRow key={rowKey}>
                  {AUTO_COLUMNS_SKELETON_KEYS.map((key) => (
                    <TableCell key={`${rowKey}-${key}`}>
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

/**
 * The mount seam for auto columns (plan 054): when the `table` definition
 * needs resolution (`t.auto()` / no-factory `define`, or an explicit option
 * column with no options to enrich), resolve columns against the adapter
 * BEFORE mounting the real table — the store is created once, with the
 * final column list. Fully-declared tables (or an explicit `columns` prop,
 * which wins over `table` — existing semantics) skip the async hop entirely
 * and render exactly as before.
 */
export function BetterTable<TData = unknown>(props: BetterTableProps<TData>) {
  const { columns: columnsProp, table, adapter } = props;
  const needsResolution = !columnsProp && !!table && tableNeedsColumnResolution(table);
  const resolvedColumns = useResolvedTableColumns(needsResolution, table, adapter);

  if (needsResolution && resolvedColumns === null) {
    return <AutoColumnsLoading className={props.className} />;
  }

  // The adapter context powers the facet fallback for option dropdowns
  // (plan 054 Step 5) — leaf inputs (option editor, option filter input)
  // lazily fetch choices for option columns that declare none.
  return (
    <TableAdapterProvider adapter={adapter}>
      {needsResolution && resolvedColumns !== null ? (
        <BetterTableInner {...props} columns={resolvedColumns} />
      ) : (
        <BetterTableInner {...props} />
      )}
    </TableAdapterProvider>
  );
}

function BetterTableInner<TData = unknown>({
  // Core table config (minus adapter)
  id: idProp,
  name: nameProp,
  columns: columnsProp,
  table,
  features = {},
  rowConfig,
  emptyState,
  errorState,

  // Data props (handled by parent)
  data,
  adapter,
  virtualized = false,
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

  // Inline editing (plan 053; saveAction — plan 055)
  onCellEdit,
  onCellEditError,
  saveAction,
  editing = true,
  ...props
}: BetterTableProps<TData>) {
  // `table` (a defineTable() result) is sugar for columns={table.columns},
  // and for id/name defaulting to table.tableName -- an explicit
  // columns/id/name prop still wins when both are given (plan 032,
  // finding 5). `columns`/`id` were REQUIRED props before `table` existed;
  // one of columns/table and one of id/table is still required at runtime
  // (now enforced here instead of by the type system, since both became
  // optional to allow `table` to satisfy them).
  const columns = columnsProp ?? table?.columns;
  if (!columns) {
    throw new Error(
      'BetterTable requires either a "columns" prop or a "table" prop (from defineTable()).'
    );
  }

  const id = idProp ?? table?.tableName;
  if (!id) {
    throw new Error(
      'BetterTable requires either an "id" prop or a "table" prop (id defaults to table.tableName).'
    );
  }

  // `name` isn't otherwise read by BetterTable itself -- it flows through
  // to the root element below (same as before `table` existed, via
  // `...props`). Still default it from table.tableName for symmetry with
  // `id`; re-merged into the spread below since it's destructured here.
  const name = nameProp ?? table?.tableName;

  const {
    filtering = true,
    sorting: sortingEnabled = true,
    pagination: paginationEnabled = true,
    rowSelection = false,
    headerContextMenu,
    columnReordering = false,
  } = features;

  // Read before the store is created below: `multiSort` is creation-time
  // config on the state manager (it decides whether `toggleSort` replaces the
  // current sort or accumulates), not per-render state.
  const sortingConfig = props.sorting;
  const multiSortEnabled = sortingConfig?.multiSort ?? false;

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
    ...(computedColumnVisibility !== undefined && {
      columnVisibility: computedColumnVisibility,
    }),
    config: { sorting: { multiSort: multiSortEnabled } },
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

  // Virtualization: purely a rendering concern. The hook is always called
  // (rules of hooks) and simply disabled when `virtualized` is off, so nothing
  // above or below this line branches on it -- filters/sorting/selection/URL
  // sync are identical either way.
  const virtualOptions = typeof virtualized === 'object' ? virtualized : {};
  const isVirtualized = virtualized !== false;
  const virtualHeight = virtualOptions.height ?? VIRTUAL_DEFAULT_HEIGHT;
  const virtualRowHeight = virtualOptions.rowHeight ?? VIRTUAL_DEFAULT_ROW_HEIGHT;
  const {
    state: virtualState,
    virtualRows,
    containerRef: virtualContainerRef,
  } = useVirtualization({
    totalRows: data.length,
    enabled: isVirtualized,
    defaultRowHeight: virtualRowHeight,
    containerHeight: virtualHeight,
    overscan: virtualOptions.overscan ?? VIRTUAL_DEFAULT_OVERSCAN,
  });

  // The rows to actually render, plus the empty space standing in for the ones
  // that aren't. When virtualization is off this is just every row, so the
  // render path below is identical in both modes.
  const {
    rows: virtualBodyRows,
    topPad: virtualTopPad,
    bottomPad: virtualBottomPad,
  } = useMemo(() => {
    if (!isVirtualized) {
      return {
        rows: data.map((row, index) => ({ row, index })),
        topPad: 0,
        bottomPad: 0,
      };
    }

    const windowed = virtualRows
      .map((virtualRow) => ({ row: data[virtualRow.index], index: virtualRow.index }))
      .filter((entry): entry is { row: TData; index: number } => entry.row !== undefined);

    const first = virtualRows[0];
    const last = virtualRows[virtualRows.length - 1];

    return {
      rows: windowed,
      topPad: first ? first.start : 0,
      bottomPad: last ? Math.max(0, virtualState.totalHeight - last.end) : 0,
    };
  }, [isVirtualized, data, virtualRows, virtualState.totalHeight]);

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

  const urlSyncConfig = useMemo(
    () =>
      urlSync?.config ?? {
        filters: false,
        pagination: false,
        sorting: false,
        columnVisibility: false,
        columnOrder: false,
      },
    [
      urlSync?.config?.filters,
      urlSync?.config?.pagination,
      urlSync?.config?.sorting,
      urlSync?.config?.columnVisibility,
      urlSync?.config?.columnOrder,
    ]
  );

  useTableUrlSync(id, urlSyncConfig, urlAdapter);

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

  // Call optional callbacks when state changes. Each callback is
  // ref-latched so the bridge effect's only dependency is the VALUE that
  // changed — an unstable inline callback identity from the consumer (e.g.
  // `onFiltersChange={(f) => ...}` recreated every parent render) no longer
  // refires the bridge on its own.
  const onFiltersChangeRef = useLatest(onFiltersChange);
  const onSortingChangeRef = useLatest(onSortingChange);
  const onPaginationChangeRef = useLatest(onPaginationChange);
  const onPageChangeRef = useLatest(onPageChange);
  const onPageSizeChangeRef = useLatest(onPageSizeChange);
  const onSelectionChangeRef = useLatest(onSelectionChange);

  useEffect(() => {
    onFiltersChangeRef.current?.(filters);
  }, [filters, onFiltersChangeRef]);

  useEffect(() => {
    onSortingChangeRef.current?.(sortingState);
  }, [sortingState, onSortingChangeRef]);

  useEffect(() => {
    onPaginationChangeRef.current?.(pagination);
  }, [pagination, onPaginationChangeRef]);

  useEffect(() => {
    onPageChangeRef.current?.(pagination.page);
  }, [pagination.page, onPageChangeRef]);

  useEffect(() => {
    onPageSizeChangeRef.current?.(pagination.limit);
  }, [pagination.limit, onPageSizeChangeRef]);

  useEffect(() => {
    onSelectionChangeRef.current?.(selectedRows);
  }, [selectedRows, onSelectionChangeRef]);

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

    // Show newly filtered columns and/or hide columns that had filters
    // removed (only if not in defaultVisibleColumns). Read the CURRENT
    // visibility straight from the store instead of the subscribed
    // `columnVisibility` above, and deliberately leave it out of this
    // effect's deps — the store's `setColumnVisibility` action only takes a
    // plain object (no functional-updater form), so reading fresh state at
    // fire-time is how this effect avoids depending on the very value it
    // writes. Depending on `columnVisibility` here previously made this
    // effect re-fire on its own `setColumnVisibility` call.
    if (newlyFilteredColumns.length > 0 || unfilteredColumns.length > 0) {
      const newVisibility = { ...store.getState().columnVisibility };
      for (const columnId of newlyFilteredColumns) {
        newVisibility[columnId] = true;
      }
      if (defaultVisibleColumns) {
        for (const columnId of unfilteredColumns) {
          if (!defaultVisibleColumns.includes(columnId)) {
            newVisibility[columnId] = false;
          }
        }
      }
      setColumnVisibility(newVisibility);
    }

    // Update ref for next comparison
    previousFiltersRef.current = filters;
  }, [autoShowFilteredColumns, filters, defaultVisibleColumns, setColumnVisibility, store]);

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

  // Row activation (click/Enter/Space) bridges to two parent-supplied
  // callbacks. Ref-latch both so this stays a single stable callback across
  // renders — passed straight into `MemoizedTableRow`, whose memoization
  // would otherwise be defeated by a fresh `onClick` closure every render.
  const onRowClickRef = useLatest(onRowClick);
  const rowConfigOnClickRef = useLatest(rowConfig?.onClick);
  const handleRowActivate = useCallback(
    (row: TData) => {
      onRowClickRef.current?.(row);
      rowConfigOnClickRef.current?.(row);
    },
    [onRowClickRef, rowConfigOnClickRef]
  );
  const rowsClickable = Boolean(onRowClick || rowConfig?.onClick);

  const editableCells = useEditableCells<TData>({
    editing,
    ...(adapter != null ? { adapter } : {}),
    ...(table?.tableName != null ? { tableName: table.tableName } : {}),
    ...(onCellEdit != null ? { onCellEdit } : {}),
    ...(onCellEditError != null ? { onCellEditError } : {}),
    ...(saveAction != null ? { saveAction } : {}),
  });

  const editableColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const column of columnsWithDefaults) {
      if (editableCells.isColumnPotentiallyEditable(column)) {
        ids.add(column.id);
      }
    }
    return ids.size > 0 ? ids : null;
  }, [columnsWithDefaults, editableCells.isColumnPotentiallyEditable]);

  const handleBeginCellEdit = editableCells.beginEdit;
  const handleCancelCellEdit = editableCells.cancelEdit;
  const handleCommitCellEdit = useCallback(
    (args: {
      row: TData;
      rowId: string;
      column: ColumnDefinition<TData, unknown>;
      value: unknown;
      previousValue: unknown;
    }) => {
      void editableCells.commitEdit(args);
    },
    [editableCells.commitEdit]
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

  // A spacer row has to span the real columns and carry its height on a CELL:
  // a `<tr>` with a height but no cells collapses to zero, which would leave
  // the scrollbar sized to the rendered window instead of the whole dataset.
  const virtualSpacerColSpan = visibleColumns.length + (shouldShowRowSelection ? 1 : 0);

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
        <ErrorState
          error={error}
          {...(onRetry !== undefined && { onRetry })}
          {...(errorState?.title !== undefined && { title: errorState.title })}
        />
      </div>
    );
  }

  // Render empty state
  if (data.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {filtering && (
          <FilterBar
            columns={columnsWithDefaults}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            {...(groups !== undefined && { groups })}
            {...(autoGroupFilters !== undefined && { autoGroupFilters })}
            showColumnVisibility={features.columnVisibility !== false}
            columnVisibility={columnVisibility}
            onToggleColumnVisibility={toggleColumnVisibility}
            columnOrder={columnOrder}
            onResetColumnOrder={() => {
              const store = getTableStore(id);
              if (store) store.getState().resetColumnOrder();
            }}
            enableColumnReordering={columnReordering}
            onReset={handleReset}
            searchable={false}
            {...(isFilterProtected !== undefined && { isFilterProtected })}
          />
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

  // Determine if context menu should be enabled
  const shouldShowContextMenu =
    contextMenuEnabled &&
    (headerContextMenu?.showSortToggle || headerContextMenu?.showColumnVisibility);

  const tableContent = (
    <div className={cn('space-y-4', className)} {...props} {...(name !== undefined && { name })}>
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
            {...(groups !== undefined && { groups })}
            {...(autoGroupFilters !== undefined && { autoGroupFilters })}
            showColumnVisibility={features.columnVisibility !== false}
            columnVisibility={columnVisibility}
            onToggleColumnVisibility={toggleColumnVisibility}
            columnOrder={columnOrder}
            onResetColumnOrder={() => {
              const store = getTableStore(id);
              if (store) store.getState().resetColumnOrder();
            }}
            enableColumnReordering={columnReordering}
            onReset={handleReset}
            searchable={false}
            {...(isFilterProtected !== undefined && { isFilterProtected })}
          />
        )}
      </div>
      <div
        className="border rounded-md"
        {...(isVirtualized && {
          ref: virtualContainerRef,
          style: { height: virtualHeight, overflowY: 'auto' as const },
        })}
      >
        <Table>
          {/* Pinned while the body scrolls underneath it, so a windowed table
              keeps its header (and its sort UI) in view. */}
          <TableHeader className={isVirtualized ? 'sticky top-0 z-20 bg-background' : undefined}>
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
                    ...(currentSort?.direction !== undefined && {
                      sortDirection: currentSort.direction,
                    }),
                    ...(isSortable && {
                      onSort: () => handleSortingChange(column.id),
                    }),
                  })
                ) : (
                  <div key={`header-${column.id}`} className="flex items-center gap-1.5">
                    <span>{column.displayName}</span>
                    {isSortable && (
                      <span className="inline-flex shrink-0 items-center text-muted-foreground">
                        {currentSort?.direction === 'asc' ? (
                          <ArrowUp size={10} strokeWidth={2} />
                        ) : currentSort?.direction === 'desc' ? (
                          <ArrowDown size={10} strokeWidth={2} />
                        ) : (
                          <ArrowUpDown size={10} strokeWidth={2} className="opacity-50" />
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
                    {...(currentSort !== undefined && { currentSort })}
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
            {/*
              Windowed or not, rows go through the SAME `MemoizedTableRow` with
              the SAME props -- virtualization only changes WHICH indices are
              rendered, so the per-row memoization contract is untouched.
              Off-screen space is held open by two spacer rows rather than by
              absolutely positioning each row, which is what keeps native table
              column alignment (and dynamic row heights) working.
            */}
            {virtualTopPad > 0 && (
              <tr data-virtual-spacer="true">
                <td colSpan={virtualSpacerColSpan} style={virtualSpacerStyle(virtualTopPad)} />
              </tr>
            )}
            {virtualBodyRows.map(({ row, index }) => {
              const rowId = getRowId(row, index);
              const isSelected = selectedRows.has(rowId);
              const editingColumnId =
                editableCells.activeEditKey?.startsWith(`${rowId}:`) === true
                  ? editableCells.activeEditKey.slice(rowId.length + 1)
                  : null;

              return (
                <MemoizedTableRow
                  key={rowId}
                  row={row}
                  rowId={rowId}
                  index={index}
                  isSelected={isSelected}
                  visibleColumns={visibleColumns}
                  shouldShowRowSelection={shouldShowRowSelection}
                  clickable={rowsClickable}
                  onActivate={handleRowActivate}
                  onToggleSelection={handleRowSelection}
                  editableColumnIds={editableColumnIds}
                  isRowCellEditable={editableCells.isRowCellEditable}
                  rowOverlay={editableCells.getRowOverlay(rowId)}
                  rowErrors={editableCells.getRowErrors(rowId)}
                  rowSavingColumns={editableCells.getRowSavingColumns(rowId)}
                  editingColumnId={editingColumnId}
                  onBeginCellEdit={handleBeginCellEdit}
                  onCancelCellEdit={handleCancelCellEdit}
                  onCommitCellEdit={handleCommitCellEdit}
                />
              );
            })}
            {virtualBottomPad > 0 && (
              <tr data-virtual-spacer="true">
                <td colSpan={virtualSpacerColSpan} style={virtualSpacerStyle(virtualBottomPad)} />
              </tr>
            )}
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
          <ArrowUp size={10} className="shrink-0 text-muted-foreground" strokeWidth={2} />
        ) : (
          <ArrowDown size={10} className="shrink-0 text-muted-foreground" strokeWidth={2} />
        )}
      </div>
    );
  };

  return (
    <TableProviders
      enableTooltip={true}
      enableDnd={!!shouldShowContextMenu}
      onDragEnd={handleDragEnd}
      renderDragOverlay={renderDragOverlay}
    >
      {tableContent}
    </TableProviders>
  );
}
