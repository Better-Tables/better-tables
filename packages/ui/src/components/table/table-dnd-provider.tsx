'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

interface TableDndProviderProps {
  /** Child components to wrap with DnD context */
  children: ReactNode;

  /** Handle drag end event */
  onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
}

/**
 * Drag and drop provider for table interactions.
 *
 * Wraps the entire table with DnD context to enable drag-and-drop
 * interactions for multi-sort reordering and future features like
 * column reordering.
 *
 * @example
 * ```tsx
 * <TableDndProvider>
 *   <BetterTable ... />
 * </TableDndProvider>
 * ```
 */
export function TableDndProvider({ children, onDragEnd }: TableDndProviderProps) {
  // Configure sensors for mouse/touch and keyboard interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    onDragEnd?.({
      active: { id: String(event.active.id) },
      over: event.over ? { id: String(event.over.id) } : null,
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

/**
 * Sortable context wrapper for lists of draggable items.
 * Used for sort order lists and future column reordering.
 */
export function DndSortableContext({
  children,
  items,
  idExtractor,
}: {
  children: ReactNode;
  items: unknown[];
  idExtractor?: (item: unknown) => string;
}) {
  // If no items, don't enable sortable
  if (!items.length) {
    return <>{children}</>;
  }

  // If extractor provided, use it
  // Otherwise, check if items have an 'id' property, or use index as fallback
  const ids = idExtractor
    ? items.map(idExtractor)
    : items.map((item, i) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          typeof item.id === 'string'
        ) {
          return item.id;
        }
        // Fallback to index only if no id property exists
        return String(i);
      });

  return <SortableContext items={ids}>{children}</SortableContext>;
}
