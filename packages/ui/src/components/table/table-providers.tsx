'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { TooltipProvider } from '../ui/tooltip';

interface TableDndProviderProps {
  /** Child components to wrap with DnD context */
  children: ReactNode;

  /** Handle drag end event */
  onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;

  /** Optional function to render the drag overlay preview */
  renderDragOverlay?: (activeId: string) => ReactNode;
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
export function TableDndProvider({
  children,
  onDragEnd,
  renderDragOverlay,
}: TableDndProviderProps) {
  // Track the currently dragging item
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    onDragEnd?.({
      active: { id: String(event.active.id) },
      over: event.over ? { id: String(event.over.id) } : null,
    });
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay>
        {activeId && renderDragOverlay ? renderDragOverlay(activeId) : null}
      </DragOverlay>
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

interface TableProvidersProps {
  children: ReactNode;
  enableTooltip?: boolean;
  enableDnd?: boolean;
  onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
  renderDragOverlay?: (activeId: string) => ReactNode;
}

/**
 * Unified providers wrapper for table features.
 * Includes TooltipProvider and TableDndProvider, both enabled by default.
 * Can be disabled via props if app already provides them at root level.
 */
export function TableProviders({
  children,
  enableTooltip = true,
  enableDnd = true,
  onDragEnd,
  renderDragOverlay,
}: TableProvidersProps) {
  let content = children;

  // Wrap with DND provider if enabled
  if (enableDnd) {
    content = (
      <TableDndProvider onDragEnd={onDragEnd} renderDragOverlay={renderDragOverlay}>
        {content}
      </TableDndProvider>
    );
  }

  // Wrap with Tooltip provider if enabled
  if (enableTooltip) {
    content = <TooltipProvider delayDuration={0}>{content}</TooltipProvider>;
  }

  return <>{content}</>;
}
