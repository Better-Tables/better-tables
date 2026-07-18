'use client';

import type {
  CellEditAction,
  ColumnDefinition,
  ScrollInfo,
  TableAdapter,
} from '@better-tables/core';
import { getColumnStyle, getFormatterForType } from '@better-tables/core';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { TableAdapterProvider } from '../../hooks/use-column-options';
import {
  type CellEditErrorHandler,
  type CellEditHandler,
  useEditableCells,
} from '../../hooks/use-editable-cells';
import { type UseVirtualizationConfig, useVirtualization } from '../../hooks/use-virtualization';
import { cn } from '../../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { EditableCell } from './editable-cell';

/**
 * Props for the VirtualizedTable component
 */
export interface VirtualizedTableProps<T = unknown> {
  /** Array of data to display */
  data: T[];

  /** Array of column definitions */
  columns: ColumnDefinition<T>[];

  /** Virtualization configuration */
  virtualization?: Partial<UseVirtualizationConfig>;

  /** Custom row renderer */
  renderRow?: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;

  /**
   * Custom cell renderer. When provided, built-in inline editing is skipped
   * for that cell path (v1 — opt out; use `<BetterTable virtualized />` for
   * full editable support).
   */
  renderCell?: (
    value: unknown,
    column: ColumnDefinition<T>,
    item: T,
    rowIndex: number
  ) => React.ReactNode;

  /** Row height (static) */
  rowHeight?: number;

  /** Enable dynamic row heights */
  dynamicRowHeight?: boolean;

  /** Container height */
  height?: number | string;

  /** Container width */
  width?: number | string;

  /** Additional CSS classes */
  className?: string;

  /** Loading state */
  loading?: boolean;

  /** Empty state component */
  emptyState?: React.ReactNode;

  /** Callbacks */
  onRowClick?: (item: T, index: number) => void;
  onScroll?: (scrollInfo: ScrollInfo) => void;
  onViewportChange?: (startIndex: number, endIndex: number) => void;

  /** Adapter for the default cell-edit save path (plan 053). */
  adapter?: TableAdapter<T>;
  tableName?: string;
  onCellEdit?: CellEditHandler<T>;
  onCellEditError?: CellEditErrorHandler<T>;
  /** Serializable cell-save function (plan 055) — see `BetterTableProps.saveAction`. */
  saveAction?: CellEditAction;
  /** Table-level master switch for inline editing. Default true. */
  editing?: boolean;
  getRowId?: (item: T, index: number) => string;

  /** Accessibility props */
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Individual virtualized row component
 */
interface VirtualizedRowProps<T> {
  item: T;
  index: number;
  rowId: string;
  columns: ColumnDefinition<T>[];
  style: React.CSSProperties;
  renderCell?: (
    value: unknown,
    column: ColumnDefinition<T>,
    item: T,
    rowIndex: number
  ) => React.ReactNode;
  onRowClick?: (item: T, index: number) => void;
  /** Stable across parent re-renders — takes the row's own index so a
   * single top-level callback can serve every row (see `onMeasure` in
   * `VirtualizedTable`). */
  onMeasure: (rowIndex: number, height: number) => void;
  editableColumnIds: ReadonlySet<string> | null;
  /** Row-level gate: `editable.when` + related-row-id presence (plan 055). */
  isRowCellEditable: (column: ColumnDefinition<T, unknown>, row: T) => boolean;
  rowOverlay: Readonly<Record<string, unknown>>;
  rowErrors: Readonly<Record<string, string>>;
  rowSavingColumns: ReadonlySet<string>;
  editingColumnId: string | null;
  onBeginCellEdit: (rowId: string, columnId: string) => void;
  onCancelCellEdit: (rowId: string, columnId: string) => void;
  onCommitCellEdit: (args: {
    row: T;
    rowId: string;
    column: ColumnDefinition<T, unknown>;
    value: unknown;
    previousValue: unknown;
  }) => void;
}

function VirtualizedRow<T>({
  item,
  index,
  rowId,
  columns,
  style,
  renderCell,
  onRowClick,
  onMeasure,
  editableColumnIds,
  isRowCellEditable,
  rowOverlay,
  rowErrors,
  rowSavingColumns,
  editingColumnId,
  onBeginCellEdit,
  onCancelCellEdit,
  onCommitCellEdit,
}: VirtualizedRowProps<T>) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Ref-latch `index` so the measurement effect's only dependency is
  // `onMeasure`. Without this, a recycled row slot's changing `index`
  // would tear down and reconstruct the ResizeObserver on every scroll.
  const indexRef = useRef(index);
  indexRef.current = index;

  // Measure row height when content changes
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onMeasure(indexRef.current, entry.contentRect.height);
      }
    });

    resizeObserver.observe(row);

    // Initial measurement
    onMeasure(indexRef.current, row.offsetHeight);

    return () => resizeObserver.disconnect();
  }, [onMeasure]);

  return (
    <TableRow
      ref={rowRef}
      style={style}
      className={cn('cursor-pointer hover:bg-muted/50 transition-colors', 'border-b border-border')}
      onClick={() => onRowClick?.(item, index)}
      data-row-index={index}
    >
      {columns.map((column) => {
        const accessorValue = column.accessor ? column.accessor(item) : item[column.id as keyof T];
        const value =
          column.id in rowOverlay ? (rowOverlay[column.id] as typeof accessorValue) : accessorValue;
        const colStyle = getColumnStyle(column.meta);
        const cellEditable =
          !renderCell &&
          editableColumnIds?.has(column.id) === true &&
          isRowCellEditable(column as ColumnDefinition<T, unknown>, item);
        const display = renderCell
          ? renderCell(value, column, item, index)
          : getFormatterForType(column.type, value, column.meta);

        return (
          <TableCell
            key={column.id}
            className={cn('p-4 align-middle', colStyle.className)}
            style={{
              width: colStyle.width,
              minWidth: colStyle.minWidth,
              maxWidth: colStyle.maxWidth,
            }}
          >
            {cellEditable ? (
              <EditableCell
                row={item}
                rowId={rowId}
                column={column}
                value={value}
                editing={editingColumnId === column.id}
                saving={rowSavingColumns.has(column.id)}
                error={rowErrors[column.id] ?? null}
                onBeginEdit={() => onBeginCellEdit(rowId, column.id)}
                onCancel={() => onCancelCellEdit(rowId, column.id)}
                onCommit={(next) =>
                  onCommitCellEdit({
                    row: item,
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
 * `styles.getRowStyle()` (`useVirtualization`) allocates a new object on
 * every call, so `style` is never referentially equal across renders even
 * when the row's actual position/height didn't change. Compare it by value
 * instead of falling back to `React.memo`'s default shallow-by-reference
 * check, which would otherwise re-render every row on every parent render
 * regardless of the other props' stability.
 */
function areVirtualizedRowPropsEqual<T>(
  prev: Readonly<VirtualizedRowProps<T>>,
  next: Readonly<VirtualizedRowProps<T>>
): boolean {
  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.rowId === next.rowId &&
    prev.columns === next.columns &&
    prev.renderCell === next.renderCell &&
    prev.onRowClick === next.onRowClick &&
    prev.onMeasure === next.onMeasure &&
    prev.editableColumnIds === next.editableColumnIds &&
    prev.isRowCellEditable === next.isRowCellEditable &&
    prev.rowOverlay === next.rowOverlay &&
    prev.rowErrors === next.rowErrors &&
    prev.rowSavingColumns === next.rowSavingColumns &&
    prev.editingColumnId === next.editingColumnId &&
    prev.onBeginCellEdit === next.onBeginCellEdit &&
    prev.onCancelCellEdit === next.onCancelCellEdit &&
    prev.onCommitCellEdit === next.onCommitCellEdit &&
    prev.style.top === next.style.top &&
    prev.style.left === next.style.left &&
    prev.style.right === next.style.right &&
    prev.style.height === next.style.height
  );
}

/**
 * Memoized so an unrelated parent re-render (e.g. from a scroll-adjacent
 * state update) doesn't re-render every visible row — this only helps if
 * `item`/`columns`/`renderCell`/`onRowClick`/`onMeasure` stay referentially
 * stable across renders where nothing the row actually displays changed.
 */
const MemoizedVirtualizedRow = memo(
  VirtualizedRow,
  areVirtualizedRowPropsEqual
) as typeof VirtualizedRow;

/**
 * High-performance virtualized table component for large datasets.
 *
 * This is a deliberate low-level rendering primitive: it takes a flat
 * `data` array and renders only the visible rows, full stop. Unlike
 * `<BetterTable>`, it has NO adapter/filter/sort/pagination/URL-sync
 * integration of its own and does not read from a `TableStateManager`
 * store -- "bring your own filtering/sorting" is the intended contract
 * (plan 032, finding 6). Its default cell rendering DOES run values through
 * the same `getFormatterForType` formatter `<BetterTable>` uses, and an
 * explicit `renderCell` still overrides that default per cell.
 *
 * To drive `data` from an adapter and a table store's filters/sorting (the
 * same store a sibling `<FilterBar>`/`useTableFilters`/`useTableSorting`
 * consumer reads and writes), see `useVirtualizedTableData` -- it fetches
 * one capped page of matching rows (virtualization already handles
 * rendering arbitrarily many rows; there's no page-by-page UI here) and
 * refetches whenever the store's filters/sorting change.
 *
 * **Most callers should reach for `<BetterTable ... virtualized />` instead**:
 * it windows its own rows under the filter bar, header sort UI, selection,
 * column visibility and URL sync it already owns, so a large dataset needs one
 * prop rather than a separate component and a hand-built toolbar. Prefer THIS
 * primitive only when you need rendering `<BetterTable>` doesn't do -- a
 * non-table layout via `renderRow`, or per-row dynamic height measurement.
 */
function defaultGetRowId<T>(item: T, index: number): string {
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    if ('id' in obj && obj.id != null) return String(obj.id);
    if ('_id' in obj && obj._id != null) return String(obj._id);
  }
  return `row-${index}`;
}

export function VirtualizedTable<T = unknown>({
  data,
  columns,
  virtualization = {},
  renderRow,
  renderCell,
  rowHeight = 52,
  dynamicRowHeight = false,
  height = 400,
  width = '100%',
  className,
  loading = false,
  emptyState,
  onRowClick,
  onScroll,
  onViewportChange,
  adapter,
  tableName,
  onCellEdit,
  onCellEditError,
  saveAction,
  editing = true,
  getRowId = defaultGetRowId,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: VirtualizedTableProps<T>) {
  const editableCells = useEditableCells<T>({
    editing,
    ...(adapter != null ? { adapter } : {}),
    ...(tableName != null ? { tableName } : {}),
    ...(onCellEdit != null ? { onCellEdit } : {}),
    ...(onCellEditError != null ? { onCellEditError } : {}),
    ...(saveAction != null ? { saveAction } : {}),
  });

  const editableColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const column of columns) {
      if (editableCells.isColumnPotentiallyEditable(column)) {
        ids.add(column.id);
      }
    }
    return ids.size > 0 ? ids : null;
  }, [columns, editableCells.isColumnPotentiallyEditable]);

  const handleCommitCellEdit = useCallback(
    (args: {
      row: T;
      rowId: string;
      column: ColumnDefinition<T, unknown>;
      value: unknown;
      previousValue: unknown;
    }) => {
      void editableCells.commitEdit(args);
    },
    [editableCells.commitEdit]
  );
  // Virtualization configuration
  const virtualizationConfig: UseVirtualizationConfig = useMemo(
    () => ({
      totalRows: data.length,
      defaultRowHeight: rowHeight,
      dynamicRowHeight,
      containerHeight: typeof height === 'number' ? height : 400,
      ...(typeof width === 'number' && { containerWidth: width }),
      overscan: 5,
      smoothScrolling: true,
      ...virtualization,
      ...(onScroll !== undefined && { onScroll }),
      ...(onViewportChange !== undefined && { onViewportChange }),
    }),
    [
      data.length,
      rowHeight,
      dynamicRowHeight,
      height,
      width,
      virtualization,
      onScroll,
      onViewportChange,
    ]
  );

  // Use the virtualization hook
  const { virtualRows, containerRef, contentRef, actions, styles, metrics, utils } =
    useVirtualization(virtualizationConfig);

  // Single stable measure callback shared by every row (instead of a new
  // per-row closure on every render) so each row's ResizeObserver effect
  // only depends on an identity that doesn't change across re-renders.
  const onMeasure = useCallback(
    (rowIndex: number, height: number) => {
      if (dynamicRowHeight) {
        actions.measureRow(rowIndex, height);
      }
    },
    [dynamicRowHeight, actions]
  );

  // Calculate column widths for horizontal scrolling
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, column) => {
      const width = column.meta?.width;
      if (typeof width === 'number') return sum + width;
      if (typeof width === 'string' && width.endsWith('px')) {
        return sum + parseInt(width, 10);
      }
      return sum + 150; // Default width
    }, 0);
  }, [columns]);

  // Loading state
  if (loading) {
    return (
      <div className={cn('border rounded-md', className)} style={{ height, width }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('border rounded-md', className)} style={{ height, width }}>
        <div className="flex items-center justify-center h-full">
          {emptyState || <p className="text-muted-foreground">No data available</p>}
        </div>
      </div>
    );
  }

  return (
    // Adapter context powers the option editor's facet fallback (plan 054).
    <TableAdapterProvider adapter={adapter}>
      <div className={cn('border rounded-md overflow-hidden', className)} style={{ height, width }}>
        {/* Performance metrics (dev mode only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground p-2 border-b bg-muted/50">
            Rendering {metrics.renderedRows}/{metrics.totalRows} rows (
            {metrics.efficiency.toFixed(1)}% efficiency)
          </div>
        )}

        {/* Table header - always visible */}
        <div className="border-b bg-background sticky top-0 z-10">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                {columns.map((column) => {
                  const colStyle = getColumnStyle(column.meta);
                  return (
                    <TableHead
                      key={column.id}
                      className={cn(
                        'h-12 px-4 text-left align-middle font-medium',
                        colStyle.headerClassName
                      )}
                      style={{
                        width: colStyle.width,
                        minWidth: colStyle.minWidth,
                        maxWidth: colStyle.maxWidth,
                      }}
                    >
                      {column.displayName}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Virtualized content area */}
        <section
          ref={containerRef}
          className="overflow-auto"
          style={{
            ...styles.container,
            height: typeof height === 'number' ? height - 48 : 'calc(100% - 48px)', // Subtract header height
          }}
          aria-label={ariaLabel || 'Virtualized table content'}
          aria-describedby={ariaDescribedBy}
        >
          <div
            ref={contentRef}
            style={{
              ...styles.content,
              minWidth: totalWidth,
            }}
            role="presentation"
          >
            <Table style={{ tableLayout: 'fixed', width: totalWidth }}>
              <TableBody>
                {virtualRows.map((virtualRow) => {
                  const item = data[virtualRow.index];
                  if (!item) return null;

                  const rowStyle = styles.getRowStyle(virtualRow);

                  if (renderRow) {
                    return (
                      <tr
                        key={virtualRow.index}
                        style={rowStyle}
                        aria-rowindex={virtualRow.index + 1}
                      >
                        {renderRow(item, virtualRow.index, rowStyle)}
                      </tr>
                    );
                  }

                  const rowId = getRowId(item, virtualRow.index);
                  const editingColumnId =
                    editableCells.activeEditKey?.startsWith(`${rowId}:`) === true
                      ? editableCells.activeEditKey.slice(rowId.length + 1)
                      : null;

                  return (
                    <MemoizedVirtualizedRow
                      key={virtualRow.index}
                      item={item}
                      index={virtualRow.index}
                      rowId={rowId}
                      columns={columns}
                      style={rowStyle}
                      {...(renderCell !== undefined && { renderCell })}
                      {...(onRowClick !== undefined && { onRowClick })}
                      onMeasure={onMeasure}
                      editableColumnIds={editableColumnIds}
                      isRowCellEditable={editableCells.isRowCellEditable}
                      rowOverlay={editableCells.getRowOverlay(rowId)}
                      rowErrors={editableCells.getRowErrors(rowId)}
                      rowSavingColumns={editableCells.getRowSavingColumns(rowId)}
                      editingColumnId={editingColumnId}
                      onBeginCellEdit={editableCells.beginEdit}
                      onCancelCellEdit={editableCells.cancelEdit}
                      onCommitCellEdit={handleCommitCellEdit}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Scroll indicators (optional) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground p-2 border-t bg-muted/50 flex justify-between">
            <span>
              Scroll:{' '}
              {Math.round(
                utils.getTotalHeight() > 0
                  ? ((virtualRows[0]?.start || 0) / utils.getTotalHeight()) * 100
                  : 0
              )}
              %
            </span>
            <span>
              Visible:{' '}
              {virtualRows.length > 0
                ? `${virtualRows[0]?.index}-${virtualRows[virtualRows.length - 1]?.index}`
                : 'None'}
            </span>
          </div>
        )}
      </div>
    </TableAdapterProvider>
  );
}

/**
 * Export default component
 */
export default VirtualizedTable;
