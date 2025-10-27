'use client';

import type { SortingParams, SortingState } from '@better-tables/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SortOrderDropIndicator } from './sort-order-drop-indicator';
import { DndSortableContext } from './table-dnd-provider';

interface SortOrderListProps {
  /** Current sort state */
  sorts: SortingState;

  /** Column definitions for display names */
  columns: Array<{ id: string; displayName: string }>;

  /** Callback when a sort is removed */
  onRemoveSort?: (columnId: string) => void;

  /** Callback when sort order changes - not yet used */
  onReorder?: (oldIndex: number, newIndex: number) => void;
}

/**
 * Draggable sort order list component.
 *
 * Displays current sorts in priority order and allows drag-and-drop
 * reordering. Shows direction icons and priority numbers.
 *
 * @example
 * ```tsx
 * <SortOrderList
 *   sorts={[{ columnId: 'name', direction: 'asc' }, { columnId: 'age', direction: 'desc' }]}
 *   onReorder={(newOrder) => handleSortReorder(newOrder)}
 *   columns={columns}
 * />
 * ```
 */
export function SortOrderList({ sorts, columns, onRemoveSort }: SortOrderListProps) {
  const getColumnName = (columnId: string): string => {
    return columns.find((col) => col.id === columnId)?.displayName || columnId;
  };

  return (
    <DndSortableContext items={sorts} idExtractor={(sort) => (sort as SortingParams).columnId}>
      <div className="space-y-0.5">
        {/* Drop zone before first item */}
        <DropZone id={`sort-drop-before-0`} />

        {sorts.map((sort, index) => (
          <SortOrderItem
            key={sort.columnId}
            sort={sort}
            index={index}
            columnName={getColumnName(sort.columnId)}
            onRemove={onRemoveSort}
          />
        ))}

        {/* Drop zone after last item */}
        <DropZone id={`sort-drop-after-${sorts.length - 1}`} />
      </div>
    </DndSortableContext>
  );
}

interface SortOrderItemProps {
  sort: SortingParams;
  index: number;
  columnName: string;
  onRemove?: (columnId: string) => void;
}

function SortOrderItem({ sort, index, columnName, onRemove }: SortOrderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sort.columnId,
    data: {
      type: 'sort-item',
      sort,
      index,
    },
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
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Drag to reorder sort for ${columnName}`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Priority number */}
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {index + 1}
      </span>

      {/* Column name */}
      <span className="flex-1 truncate">{columnName}</span>

      {/* Direction icon */}
      {sort.direction === 'asc' ? (
        <div className="flex items-center">
          <ArrowUp className="h-3 w-3 text-muted-foreground" aria-label="Ascending" />
          <span className="sr-only">Ascending</span>
        </div>
      ) : (
        <div className="flex items-center">
          <ArrowDown className="h-3 w-3 text-muted-foreground" aria-label="Descending" />
          <span className="sr-only">Descending</span>
        </div>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(sort.columnId);
          }}
          className="ml-1 rounded-md p-0.5 hover:bg-muted"
          aria-label={`Remove sort for ${columnName}`}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
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
      <SortOrderDropIndicator isOver={isOver} />
    </div>
  );
}
