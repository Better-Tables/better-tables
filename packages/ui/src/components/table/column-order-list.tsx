'use client';

import type { ColumnDefinition, ColumnOrder, ColumnVisibility } from '@better-tables/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ColumnOrderDropIndicator } from './column-order-drop-indicator';
import { DndSortableContext } from './table-providers';

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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
        'bg-muted/50 hover:bg-muted',
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
          className="cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag to reorder ${column.displayName}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {!enableReordering && <div className="w-4" />}

      {/* Visibility toggle */}
      {canHide ? (
        <button
          type="button"
          onClick={() => onToggleVisibility(column.id)}
          className="rounded-md p-0.5 hover:bg-muted-foreground/10"
          aria-label={isVisible ? `Hide ${column.displayName}` : `Show ${column.displayName}`}
        >
          {isVisible ? (
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="w-3.5" />
      )}

      {/* Column icon */}
      {column.icon && <column.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      {!column.icon && <div className="w-3.5" />}

      {/* Column name */}
      <span className={cn('flex-1 truncate text-left', !isVisible && 'text-muted-foreground')}>
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
