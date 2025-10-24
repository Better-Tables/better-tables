import type { ColumnDefinition, ScrollInfo } from '@better-tables/core';
import { getColumnStyle } from '@better-tables/core';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { type UseVirtualizationConfig, useVirtualization } from '../../hooks/use-virtualization';
import { cn } from '../../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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

  /** Custom cell renderer */
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
  columns: ColumnDefinition<T>[];
  style: React.CSSProperties;
  renderCell?: (
    value: unknown,
    column: ColumnDefinition<T>,
    item: T,
    rowIndex: number
  ) => React.ReactNode;
  onRowClick?: (item: T, index: number) => void;
  onMeasure: (height: number) => void;
}

function VirtualizedRow<T>({
  item,
  index,
  columns,
  style,
  renderCell,
  onRowClick,
  onMeasure,
}: VirtualizedRowProps<T>) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Measure row height when content changes
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onMeasure(entry.contentRect.height);
      }
    });

    resizeObserver.observe(row);

    // Initial measurement
    onMeasure(row.offsetHeight);

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
        const value = item[column.id as keyof T];
        const colStyle = getColumnStyle(column.meta);
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
            {renderCell ? renderCell(value, column, item, index) : String(value || '')}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

/**
 * High-performance virtualized table component for large datasets
 */
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
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: VirtualizedTableProps<T>) {
  // Virtualization configuration
  const virtualizationConfig: UseVirtualizationConfig = useMemo(
    () => ({
      totalRows: data.length,
      defaultRowHeight: rowHeight,
      dynamicRowHeight,
      containerHeight: typeof height === 'number' ? height : 400,
      containerWidth: typeof width === 'number' ? width : undefined,
      overscan: 5,
      smoothScrolling: true,
      ...virtualization,
      onScroll,
      onViewportChange,
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

  // Handle row measurements for dynamic heights
  const handleRowMeasure = (rowIndex: number) => (height: number) => {
    if (dynamicRowHeight) {
      actions.measureRow(rowIndex, height);
    }
  };

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
    <div className={cn('border rounded-md overflow-hidden', className)} style={{ height, width }}>
      {/* Performance metrics (dev mode only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground p-2 border-b bg-muted/50">
          Rendering {metrics.renderedRows}/{metrics.totalRows} rows ({metrics.efficiency.toFixed(1)}
          % efficiency)
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

                return (
                  <VirtualizedRow
                    key={virtualRow.index}
                    item={item}
                    index={virtualRow.index}
                    columns={columns}
                    style={rowStyle}
                    renderCell={renderCell}
                    onRowClick={onRowClick}
                    onMeasure={handleRowMeasure(virtualRow.index)}
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
              ? `${virtualRows[0].index}-${virtualRows[virtualRows.length - 1].index}`
              : 'None'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Export default component
 */
export default VirtualizedTable;
