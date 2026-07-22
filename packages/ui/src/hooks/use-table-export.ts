'use client';

import type {
  ColumnDefinition,
  ExportParams,
  ExportResult,
  FilterGroupNode,
  FilterState,
  SortingState,
} from '@better-tables/core';
import { useCallback, useState } from 'react';

/** The export formats the UI can trigger. Mirrors `ExportParams['format']`. */
export type ExportFormat = ExportParams['format'];

/**
 * The minimal adapter surface this hook needs: an optional `exportData` and the
 * `export` capability flag. A full `TableAdapter` satisfies it, and it keeps
 * the hook decoupled from the whole adapter contract.
 */
export interface ExportableAdapter {
  exportData?: (params: ExportParams) => Promise<ExportResult>;
  meta?: { features?: { export?: boolean } };
}

/** Inputs for {@link useTableExport} — typically the table's current view. */
export interface UseTableExportParams<TData = unknown> {
  /** The active adapter. Export is only possible when it can export (below). */
  adapter?: ExportableAdapter | undefined;
  /** Columns to include — their ids are passed to `exportData`. */
  columns: ColumnDefinition<TData, unknown>[];
  /** The current filter tree, so the export matches the on-screen view. */
  filters: FilterState[] | FilterGroupNode;
  /** The current sort order. */
  sorting: SortingState;
  /** Optional cap override forwarded to `exportData` (`maxRows`). */
  maxRows?: number;
  /** Called when an export fails, in addition to setting `error`. */
  onError?: (error: Error) => void;
}

/** What {@link useTableExport} returns. */
export interface UseTableExportResult {
  /** Fetch the current view in `format` and download it. */
  exportData: (format: ExportFormat) => Promise<void>;
  /** True while an export is in flight. */
  exporting: boolean;
  /** The last export error, or null. Cleared when a new export starts. */
  error: Error | null;
  /** Whether the adapter can export at all (gates the button). */
  canExport: boolean;
}

/** Whether an adapter advertises + implements export. */
function adapterCanExport(adapter: unknown): boolean {
  if (!adapter || typeof adapter !== 'object') return false;
  const a = adapter as { exportData?: unknown; meta?: { features?: { export?: boolean } } };
  return typeof a.exportData === 'function' && a.meta?.features?.export === true;
}

/**
 * Trigger a data export of the current view and download the file. Wraps the
 * adapter's `exportData` and the browser download dance (object URL → click a
 * synthetic anchor → revoke). Gated on the adapter actually supporting export.
 *
 * @example
 * ```tsx
 * const { exportData, exporting, canExport } = useTableExport({
 *   adapter, columns, filters, sorting,
 * });
 * if (canExport) return <button onClick={() => exportData('csv')}>Export CSV</button>;
 * ```
 */
export function useTableExport<TData = unknown>({
  adapter,
  columns,
  filters,
  sorting,
  maxRows,
  onError,
}: UseTableExportParams<TData>): UseTableExportResult {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const canExport = adapterCanExport(adapter);

  const exportData = useCallback(
    async (format: ExportFormat) => {
      const fail = (err: Error) => {
        setError(err);
        onError?.(err);
      };
      if (!adapterCanExport(adapter)) {
        // No-op with a clear error rather than throwing into the click handler.
        fail(new Error('This table cannot be exported.'));
        return;
      }
      setExporting(true);
      setError(null);
      try {
        // Call ON the adapter so `this` is preserved — a class-based adapter
        // (e.g. Drizzle) whose `exportData` calls `this.fetchData` would break
        // if the method were extracted to a bare local. `adapterCanExport`
        // guarantees `exportData` exists.
        if (!adapter?.exportData) throw new Error('This table cannot be exported.');
        const result = await adapter.exportData({
          format,
          columns: columns.map((c) => c.id),
          filters,
          sorting,
          ...(maxRows !== undefined && { maxRows }),
        });
        downloadExportResult(result);
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setExporting(false);
      }
    },
    [adapter, columns, filters, sorting, maxRows, onError]
  );

  return { exportData, exporting, error, canExport };
}

/**
 * Download an {@link ExportResult} in the browser: wrap the payload in a Blob,
 * open an object URL, click a synthetic anchor, and revoke the URL. No-op on
 * the server (guards `document`).
 */
export function downloadExportResult(result: {
  data: Blob | string;
  filename: string;
  mimeType: string;
}): void {
  if (typeof document === 'undefined') return;
  const blob =
    result.data instanceof Blob ? result.data : new Blob([result.data], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
