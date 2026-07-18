'use client';

import type { ColumnDefinition, ColumnOrder, ColumnVisibility } from '@better-tables/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ColumnOrderDropIndicator } from './column-order-drop-indicator';
import { DndSortableContext } from './table-providers';

/** Matches SortOrderList / context-menu reorder row spacing (gap-2, px-2 py-1.5). */
const COLUMN_ORDER_ROW_LAYOUT = {
  gap: 8,
  paddingTop: 6,
  paddingBottom: 6,
  paddingLeft: 8,
  paddingRight: 8,
} as const;

const COLUMN_ORDER_ICON_SIZE = 14;

interface ColumnOrderListProps<TData = unknown> {
  /** Current column order */
  order: ColumnOrder;

  /** All column definitions */
  columns: ColumnDefinition<TData>[];

  /** Current column visibility state */
  columnVisibility: ColumnVisibility;

  /** Handler for toggling column visibility */
  onToggleVisibility: (columnId: string) => void;

  /** Whether column reordering is enabled */
  enableReordering?: boolean;
}

/**
 * Draggable column order list component.
 *
 * Displays columns with their visibility state and allows drag-and-drop
 * reordering. Shows visibility toggles alongside drag handles.
 *
 * @example
 * ```tsx
 * <ColumnOrderList
 *   order={['name', 'email', 'age']}
 *   columns={columns}
 *   columnVisibility={visibility}
 *   onToggleVisibility={(id) => toggleVisibility(id)}
 *   enableReordering
 * />
 * ```
 */
export function ColumnOrderList<TData = unknown>({
  order,
  columns,
  columnVisibility,
  onToggleVisibility,
  enableReordering = false,
}: ColumnOrderListProps<TData>) {
  const getColumn = (columnId: string): ColumnDefinition<TData> | undefined => {
    return columns.find((col) => col.id === columnId);
  };

  const orderedColumns = order
    .map((id) => getColumn(id))
    .filter((col): col is ColumnDefinition<TData> => col !== undefined);

  return (
    <DndSortableContext items={order} idExtractor={(id) => String(id)}>
      <div className="space-y-0.5">
        {/* Drop zone before first item */}
        {enableReordering && <DropZone id={`column-drop-before-0`} />}

        {orderedColumns.map((column, index) => {
          const isVisible = columnVisibility[column.id] !== false;
          const canHide = column.hideable !== false;

          return (
            <ColumnOrderItem
              key={column.id}
              column={column}
              index={index}
              isVisible={isVisible}
              canHide={canHide}
              onToggleVisibility={onToggleVisibility}
              enableReordering={enableReordering}
            />
          );
        })}

        {/* Drop zone after last item */}
        {enableReordering && <DropZone id={`column-drop-after-${order.length - 1}`} />}
      </div>
    </DndSortableContext>
  );
}

interface ColumnOrderItemProps<TData = unknown> {
  column: ColumnDefinition<TData>;
  index: number;
  isVisible: boolean;
  canHide: boolean;
  onToggleVisibility: (columnId: string) => void;
  enableReordering: boolean;
}

function ColumnOrderItem<TData = unknown>({
  column,
  index,
  isVisible,
  canHide,
  onToggleVisibility,
  enableReordering,
}: ColumnOrderItemProps<TData>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: {
      type: 'column-item',
      column,
      index,
    },
    disabled: !enableReordering,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: COLUMN_ORDER_ROW_LAYOUT.gap,
    paddingTop: COLUMN_ORDER_ROW_LAYOUT.paddingTop,
    paddingBottom: COLUMN_ORDER_ROW_LAYOUT.paddingBottom,
    paddingLeft: COLUMN_ORDER_ROW_LAYOUT.paddingLeft,
    paddingRight: COLUMN_ORDER_ROW_LAYOUT.paddingRight,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md text-xs',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-opacity duration-200',
        isDragging && 'opacity-30 scale-95'
      )}
    >
      {/* Drag handle */}
      {enableReordering && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag to reorder ${column.displayName}`}
        >
          <GripVertical
            size={COLUMN_ORDER_ICON_SIZE}
            className="text-muted-foreground"
            strokeWidth={2}
          />
        </button>
      )}

      {/* Visibility toggle — h-6 w-6 slot matches sort-order priority badge width */}
      {canHide ? (
        <button
          type="button"
          onClick={() => onToggleVisibility(column.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted-foreground/10"
          aria-label={isVisible ? `Hide ${column.displayName}` : `Show ${column.displayName}`}
        >
          {isVisible ? (
            <Eye size={COLUMN_ORDER_ICON_SIZE} className="text-muted-foreground" strokeWidth={2} />
          ) : (
            <EyeOff
              size={COLUMN_ORDER_ICON_SIZE}
              className="text-muted-foreground"
              strokeWidth={2}
            />
          )}
        </button>
      ) : (
        <span className="h-6 w-6 shrink-0" aria-hidden="true" />
      )}

      {/* Column icon */}
      {column.icon && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
          <column.icon size={COLUMN_ORDER_ICON_SIZE} />
        </span>
      )}

      {/* Column name */}
      <span
        className={cn('min-w-0 flex-1 truncate text-left', !isVisible && 'text-muted-foreground')}
      >
        {column.displayName}
      </span>
    </div>
  );
}

/**
 * Drop zone component for between sortable items
 */
function DropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'drop-zone',
    },
  });

  return (
    <div ref={setNodeRef} className="h-0.5" aria-hidden="true">
      <ColumnOrderDropIndicator isOver={isOver} />
    </div>
  );
}
