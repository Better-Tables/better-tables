'use client';

import type {
  ColumnDefinition,
  FilterGroupNode,
  FilterState,
  SortingState,
} from '@better-tables/core';
import { Download, Loader2 } from 'lucide-react';
import {
  type ExportableAdapter,
  type ExportFormat,
  useTableExport,
} from '../../hooks/use-table-export';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/**
 * Props for {@link ExportButton}. Structurally a superset of the table's
 * `toolbarExtra` slot props (adapter widened to the minimal export surface), so
 * it drops straight into `slots={{ toolbarExtra: ExportButton }}`.
 */
export interface ExportButtonProps<TData = unknown> {
  /** Columns to include — their ids are exported. */
  columns: ColumnDefinition<TData, unknown>[];
  /** The active adapter (export renders only when it can export). */
  adapter?: ExportableAdapter | undefined;
  /** The current filter tree, so the export matches the on-screen view. */
  filters: FilterState[] | FilterGroupNode;
  /** The current sort order. */
  sorting: SortingState;
  /** Total row count if known (unused today; kept for slot-shape parity). */
  totalCount?: number;
  /** Override the row cap forwarded to the adapter (`maxRows`). */
  maxRows?: number;
  /** Called if an export fails, in addition to the hook's `error` state. */
  onError?: (error: Error) => void;
}

/**
 * The formats the button offers. Excel is intentionally excluded — the current
 * adapters don't produce it yet, and offering a control that fails is worse
 * than not offering it. Add it here once an adapter implements Excel export.
 */
const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'csv', label: 'Export CSV' },
  { format: 'json', label: 'Export JSON' },
];

/**
 * A toolbar control that exports the table's current (filtered, sorted) view.
 * Renders nothing when the adapter can't export, so it's safe to always wire.
 *
 * The `export` UI module (`better-tables add export`); occupies the
 * `toolbarExtra` slot.
 */
export function ExportButton<TData = unknown>({
  adapter,
  columns,
  filters,
  sorting,
  maxRows,
  onError,
}: ExportButtonProps<TData>) {
  const { exportData, exporting, canExport } = useTableExport<TData>({
    adapter,
    columns,
    filters,
    sorting,
    ...(maxRows !== undefined && { maxRows }),
    ...(onError !== undefined && { onError }),
  });

  // Nothing to render when the adapter has no export capability.
  if (!canExport) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={exporting} className="h-8 border-dashed" />
        }
      >
        {exporting ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1 h-4 w-4" />
        )}
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {FORMATS.map(({ format, label }) => (
          <DropdownMenuItem
            key={format}
            onSelect={() => {
              void exportData(format);
            }}
            disabled={exporting}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
