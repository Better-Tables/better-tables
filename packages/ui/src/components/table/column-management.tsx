'use client';

import type { ColumnDefinition, ColumnOrder, ColumnVisibility } from '@better-tables/core';
import { ColumnVisibilityToggle } from './column-visibility-toggle';

export interface ColumnManagementProps<TData = unknown> {
  /** All column definitions */
  columns: ColumnDefinition<TData>[];

  /** Current column visibility state */
  columnVisibility: ColumnVisibility;

  /** Handler to toggle column visibility */
  onToggleVisibility: (columnId: string) => void;

  /** Whether the component is disabled */
  disabled?: boolean;

  /** Current column order */
  columnOrder?: ColumnOrder;

  /** Handler for resetting column order */
  onResetColumnOrder?: () => void;

  /** Whether column reordering is enabled */
  enableReordering?: boolean;

  /** Whether to show the component */
  show?: boolean;
}

/**
 * Column management component for controlling column visibility and reordering.
 *
 * Provides a dropdown interface for toggling column visibility and reordering columns
 * when enabled. This component is separate from the FilterBar to allow independent
 * placement and styling.
 *
 * @example
 * ```tsx
 * <ColumnManagement
 *   columns={columns}
 *   columnVisibility={columnVisibility}
 *   onToggleVisibility={(id) => toggleColumnVisibility(id)}
 *   columnOrder={order}
 *   onResetColumnOrder={resetColumnOrder}
 *   enableReordering
 *   show={features.columnVisibility !== false}
 * />
 * ```
 */
export function ColumnManagement<TData = unknown>({
  columns,
  columnVisibility,
  onToggleVisibility,
  disabled,
  columnOrder,
  onResetColumnOrder,
  enableReordering = false,
  show = true,
}: ColumnManagementProps<TData>) {
  if (!show) {
    return null;
  }

  return (
    <ColumnVisibilityToggle
      columns={columns}
      columnVisibility={columnVisibility}
      onToggleVisibility={onToggleVisibility}
      disabled={disabled}
      columnOrder={columnOrder}
      onResetColumnOrder={onResetColumnOrder}
      enableReordering={enableReordering}
    />
  );
}
