'use client';

import type {
  ColumnDefinition,
  HeaderContextMenuConfig,
  SortingParams,
  SortingState,
} from '@better-tables/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, EyeOff, X } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { SortOrderList } from './sort-order-list';

interface TableHeaderContextMenuProps<TData = unknown> {
  /** Column definition */
  column: ColumnDefinition<TData>;

  /** Context menu configuration */
  contextMenuConfig: HeaderContextMenuConfig;

  /** Current sort for this column */
  currentSort?: SortingParams;

  /** All current sorts */
  allSorts: SortingState;

  /** Whether multi-sort is enabled */
  multiSortEnabled: boolean;

  /** Whether this column is visible */
  isVisible: boolean;

  /** Toggle sorting handler */
  onToggleSort: () => void;

  /** Clear sort handler */
  onClearSort: () => void;

  /** Reorder sorts handler */
  onSortReorder: (newOrder: SortingState) => void;

  /** Toggle visibility handler */
  onToggleVisibility: () => void;

  /** Column definitions for sort order display */
  columns: ColumnDefinition<TData>[];

  /** Child content to wrap with context menu */
  children: React.ReactNode;
}

/**
 * Context menu for table headers.
 *
 * Provides right-click menu with:
 * - Sort controls (ascending/descending/clear)
 * - Multi-sort reordering (when active)
 * - Column visibility toggle
 *
 * @example
 * ```tsx
 * <TableHeaderContextMenu
 *   column={column}
 *   contextMenuConfig={config}
 *   currentSort={currentSort}
 *   allSorts={allSorts}
 *   onToggleSort={handleToggleSort}
 *   onClearSort={handleClearSort}
 *   onSortReorder={handleSortReorder}
 *   onToggleVisibility={handleToggleVisibility}
 * >
 *   <div>Header content</div>
 * </TableHeaderContextMenu>
 * ```
 */
export function TableHeaderContextMenu<TData = unknown>({
  column,
  contextMenuConfig,
  currentSort,
  allSorts,
  multiSortEnabled,
  isVisible,
  onToggleSort,
  onClearSort,
  onSortReorder,
  onToggleVisibility,
  columns,
  children,
}: TableHeaderContextMenuProps<TData>) {
  const isSortable = column.sortable !== false;
  const isHideable = column.hideable !== false;
  const hasMultipleSorts = multiSortEnabled && allSorts.length > 1;

  const handleSortReorder = (oldIndex: number, newIndex: number) => {
    const newSorts = arrayMove(allSorts, oldIndex, newIndex);
    onSortReorder(newSorts);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Sorting controls */}
        {isSortable && contextMenuConfig.showSortToggle && (
          <>
            <ContextMenuItem
              onClick={() => {
                // If not sorted, toggle to asc
                // If sorted asc, toggle to desc
                // If sorted desc, we'll clear it
                if (currentSort?.direction === 'asc') {
                  onToggleSort();
                } else if (!currentSort) {
                  onToggleSort();
                } else {
                  // Already desc, clicking should toggle to asc
                  onToggleSort();
                }
              }}
              className="flex items-center gap-2"
            >
              <ArrowUp className="h-4 w-4" />
              Sort Ascending
              {currentSort?.direction === 'asc' && <CheckIcon />}
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                // Set to desc
                if (currentSort?.direction === 'desc') {
                  // Do nothing, already desc
                  return;
                }
                onToggleSort();
              }}
              className="flex items-center gap-2"
            >
              <ArrowDown className="h-4 w-4" />
              Sort Descending
              {currentSort?.direction === 'desc' && <CheckIcon />}
            </ContextMenuItem>

            {currentSort && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onClearSort}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  Clear This Sort
                </ContextMenuItem>
              </>
            )}

            {allSorts.length > 1 && (
              <>
                {!currentSort && <ContextMenuSeparator />}
                <ContextMenuItem
                  onClick={() => {
                    onSortReorder([]);
                  }}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  Clear All Sorting
                </ContextMenuItem>
              </>
            )}
          </>
        )}

        {/* Multi-sort reorder section */}
        {hasMultipleSorts && contextMenuConfig.allowSortReorder && (
          <>
            <ContextMenuSeparator />
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Sort Order
            </div>
            <ContextMenuSeparator />
            <div className="px-2 py-1.5">
              <SortOrderList
                sorts={allSorts}
                onReorder={handleSortReorder}
                onRemoveSort={(columnId) => {
                  const newSorts = allSorts.filter((s) => s.columnId !== columnId);
                  onSortReorder(newSorts);
                }}
                columns={columns.map((col) => ({
                  id: col.id,
                  displayName: col.displayName,
                }))}
              />
            </div>
          </>
        )}

        {/* Column visibility toggle */}
        {isHideable && contextMenuConfig.showColumnVisibility && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onToggleVisibility} className="flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              {isVisible ? 'Hide Column' : 'Show Column'}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function CheckIcon() {
  return (
    <svg
      className="ml-auto h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <title>Checked</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
