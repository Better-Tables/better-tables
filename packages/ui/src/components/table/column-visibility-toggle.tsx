'use client';

import type { ColumnDefinition, ColumnVisibility } from '@better-tables/core';
import { Columns2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';

export interface ColumnVisibilityToggleProps<TData = unknown> {
  /** All column definitions */
  columns: ColumnDefinition<TData>[];

  /** Current column visibility state */
  columnVisibility: ColumnVisibility;

  /** Handler to toggle column visibility */
  onToggleVisibility: (columnId: string) => void;

  /** Whether the toggle is disabled */
  disabled?: boolean;
}

/**
 * Column visibility toggle component.
 *
 * Provides a button that opens a dropdown menu with checkboxes to show/hide columns.
 * Only shows columns that are hideable (hideable !== false).
 *
 * @example
 * ```tsx
 * <ColumnVisibilityToggle
 *   columns={columns}
 *   columnVisibility={columnVisibility}
 *   onToggleVisibility={(id) => toggleColumnVisibility(id)}
 * />
 * ```
 */
export function ColumnVisibilityToggle<TData = unknown>({
  columns,
  columnVisibility,
  onToggleVisibility,
  disabled,
}: ColumnVisibilityToggleProps<TData>) {
  // Only show columns that are hideable (default to true if not specified)
  const hideableColumns = columns.filter((col) => col.hideable !== false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 px-2 lg:px-3"
          aria-label="Toggle column visibility"
        >
          <Columns2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Column Visibility</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea
          className="h-60"
          maskHeight={40}
          maskClassName="before:from-popover after:from-popover"
        >
          {hideableColumns.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
              No hideable columns
            </div>
          ) : (
            hideableColumns.map((column) => {
              const isVisible = columnVisibility[column.id] !== false;
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={isVisible}
                  onCheckedChange={() => onToggleVisibility(column.id)}
                  onSelect={(e) => e.preventDefault()}
                  disabled={disabled}
                >
                  {column.displayName}
                </DropdownMenuCheckboxItem>
              );
            })
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
