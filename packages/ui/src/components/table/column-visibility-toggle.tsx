'use client';

import type { ColumnDefinition, ColumnOrder, ColumnVisibility } from '@better-tables/core';
import { Columns2, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { ColumnOrderList } from './column-order-list';

export interface ColumnVisibilityToggleProps<TData = unknown> {
  /** All column definitions */
  columns: ColumnDefinition<TData>[];

  /** Current column visibility state */
  columnVisibility: ColumnVisibility;

  /** Handler to toggle column visibility */
  onToggleVisibility: (columnId: string) => void;

  /** Whether the toggle is disabled */
  disabled?: boolean;

  /** Current column order */
  columnOrder?: ColumnOrder;

  /** Handler for resetting column order */
  onResetColumnOrder?: () => void;

  /** Whether column reordering is enabled */
  enableReordering?: boolean;
}

/**
 * Column management dropdown component.
 *
 * Provides a button that opens a dropdown menu with column visibility toggles
 * and drag-and-drop column reordering (if enabled). Replaces ColumnVisibilityToggle
 * with enhanced functionality.
 *
 * @example
 * ```tsx
 * <ColumnVisibilityToggle
 *   columns={columns}
 *   columnVisibility={columnVisibility}
 *   onToggleVisibility={(id) => toggleColumnVisibility(id)}
 *   columnOrder={order}
 *   onReorderColumns={setColumnOrder}
 *   onResetColumnOrder={resetColumnOrder}
 *   enableReordering
 * />
 * ```
 */
export function ColumnVisibilityToggle<TData = unknown>({
  columns,
  columnVisibility,
  onToggleVisibility,
  disabled,
  columnOrder,
  onResetColumnOrder,
  enableReordering = false,
}: ColumnVisibilityToggleProps<TData>) {
  // Use columnOrder if provided, otherwise fall back to column definition order
  const order = columnOrder || columns.map((col) => col.id);
  const hasResetOption = enableReordering && onResetColumnOrder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 px-2 lg:px-3"
          aria-label={enableReordering ? 'Manage columns' : 'Toggle column visibility'}
        >
          <Columns2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel>{enableReordering ? 'Columns' : 'Column Visibility'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea
          className="h-60"
          maskHeight={40}
          maskClassName="before:from-popover after:from-popover"
        >
          {columns.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">No columns</div>
          ) : (
            <ColumnOrderList
              order={order}
              columns={columns}
              columnVisibility={columnVisibility}
              onToggleVisibility={onToggleVisibility}
              enableReordering={enableReordering}
            />
          )}
        </ScrollArea>
        {hasResetOption && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onResetColumnOrder}
              disabled={disabled}
              className="flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Order
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
