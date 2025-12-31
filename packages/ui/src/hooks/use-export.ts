'use client';

/**
 * @fileoverview React hook for table data export functionality.
 *
 * This module provides a React hook for managing export operations including
 * progress tracking, cancellation, and automatic downloads.
 *
 * @module hooks/use-export
 */

import type { ExportConfig, ExportResult } from '@better-tables/core';
import {
  type ColumnDefinition,
  type ExportEvent,
  ExportManager,
  type ExportProgress,
  type FilterState,
  type SortingParams,
  type TableAdapter,
  triggerDownload,
} from '@better-tables/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Options for the useExport hook.
 *
 * @template TData - The type of data being exported
 */
export interface UseExportOptions<TData = unknown> {
  /** Column definitions for export */
  columns: ColumnDefinition<TData>[];

  /** Table adapter for data fetching */
  adapter: TableAdapter<TData>;

  /** Current filters to apply during export */
  filters?: FilterState[];

  /** Current sorting to apply during export */
  sorting?: SortingParams[];

  /** Custom value transformer for export */
  valueTransformer?: (
    value: unknown,
    row: TData,
    column: ColumnDefinition<TData>
  ) => string | number | boolean | Date | null;

  /** Callback when export completes */
  onComplete?: (result: ExportResult) => void;

  /** Callback when export fails */
  onError?: (error: Error) => void;

  /** Callback for export progress updates */
  onProgress?: (progress: ExportProgress) => void;

  /** Whether to automatically download on completion */
  autoDownload?: boolean;
}

/**
 * Return type for the useExport hook.
 */
export interface UseExportReturn {
  /** Start an export operation */
  startExport: (config: Partial<ExportConfig>) => Promise<ExportResult>;

  /** Cancel the current export */
  cancelExport: () => void;

  /** Current export progress */
  progress: ExportProgress | null;

  /** Whether an export is in progress */
  isExporting: boolean;

  /** Last export result */
  lastResult: ExportResult | null;

  /** Export error if any */
  error: Error | null;

  /** Clear the current error */
  clearError: () => void;

  /** Clear the last result to start a new export */
  clearLastResult: () => void;

  /** Download the last export result */
  downloadResult: () => void;

  /** Get estimated export time based on data size */
  getEstimatedTime: (totalRows: number) => number;
}

/**
 * React hook for managing table data export with progress tracking.
 *
 * Provides a complete export solution with batch processing, progress updates,
 * cancellation support, and automatic downloads.
 *
 * @template TData - The type of data being exported
 *
 * @example
 * ```tsx
 * function ExportSection() {
 *   const {
 *     startExport,
 *     cancelExport,
 *     progress,
 *     isExporting,
 *     lastResult,
 *     error
 *   } = useExport({
 *     columns,
 *     adapter,
 *     filters: currentFilters,
 *     autoDownload: true,
 *     onComplete: (result) => {
 *       toast.success(`Exported ${result.rowCount} rows`);
 *     }
 *   });
 *
 *   const handleExport = (format: ExportFormat) => {
 *     startExport({
 *       format,
 *       filename: 'users-export',
 *       batch: { batchSize: 1000 }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <Button onClick={() => handleExport('csv')} disabled={isExporting}>
 *         Export CSV
 *       </Button>
 *       <Button onClick={() => handleExport('excel')} disabled={isExporting}>
 *         Export Excel
 *       </Button>
 *       {isExporting && progress && (
 *         <ProgressBar value={progress.percentage} />
 *       )}
 *       {error && <ErrorMessage>{error.message}</ErrorMessage>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExport<TData = unknown>(options: UseExportOptions<TData>): UseExportReturn {
  const {
    columns,
    adapter,
    filters,
    sorting,
    valueTransformer,
    onComplete,
    onError,
    onProgress,
    autoDownload = true,
  } = options;

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const exportManagerRef = useRef<ExportManager<TData> | null>(null);

  // Create export manager
  const exportManager = useMemo(() => {
    return new ExportManager<TData>(columns, {
      dataFetcher: async ({ offset, limit, filters: fetchFilters, sorting: fetchSorting }) => {
        const page = Math.floor(offset / limit) + 1;
        const result = await adapter.fetchData({
          pagination: { page, limit },
          filters: fetchFilters,
          sorting: fetchSorting,
        });
        return { data: result.data, total: result.total };
      },
      valueTransformer,
    });
  }, [columns, adapter, valueTransformer]);

  // Store ref for cleanup
  useEffect(() => {
    exportManagerRef.current = exportManager;
    return () => {
      exportManagerRef.current?.cancel();
    };
  }, [exportManager]);

  // Subscribe to export events
  useEffect(() => {
    const handleEvent = (event: ExportEvent) => {
      switch (event.type) {
        case 'start':
          setIsExporting(true);
          setError(null);
          break;
        case 'progress':
          setProgress(event.progress);
          onProgress?.(event.progress);
          break;
        case 'complete':
          setIsExporting(false);
          setLastResult(event.result);
          setProgress(null);
          onComplete?.(event.result);
          if (autoDownload && event.result.success && event.result.data) {
            triggerDownload(event.result.data, event.result.filename);
          }
          break;
        case 'error':
          setIsExporting(false);
          setError(event.error);
          setProgress(null);
          onError?.(event.error);
          break;
        case 'cancelled':
          setIsExporting(false);
          setProgress(null);
          break;
      }
    };

    const unsubscribe = exportManager.subscribe(handleEvent);
    return unsubscribe;
  }, [exportManager, onComplete, onError, onProgress, autoDownload]);

  /**
   * Start an export operation.
   */
  const startExport = useCallback(
    async (config: Partial<ExportConfig>): Promise<ExportResult> => {
      setError(null);
      setLastResult(null);
      const fullConfig: ExportConfig = {
        format: config.format ?? 'csv',
        filename: config.filename ?? 'export',
        filters: config.filters ?? filters,
        sorting: config.sorting ?? sorting,
        ...config,
      };

      return exportManager.export(fullConfig);
    },
    [exportManager, filters, sorting]
  );

  /**
   * Cancel the current export.
   */
  const cancelExport = useCallback(() => {
    exportManager.cancel();
  }, [exportManager]);

  /**
   * Clear the current error.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear the last result to start a new export.
   */
  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);
  /**
   * Download the last export result.
   */
  const downloadResult = useCallback(() => {
    if (lastResult?.success && lastResult.data) {
      triggerDownload(lastResult.data, lastResult.filename);
    }
  }, [lastResult]);

  /**
   * Estimate export time based on row count.
   * Returns estimated time in milliseconds.
   */
  const getEstimatedTime = useCallback((totalRows: number): number => {
    // Rough estimate: ~1000 rows per second for CSV, ~500 for Excel
    const rowsPerSecond = 800;
    return Math.round((totalRows / rowsPerSecond) * 1000);
  }, []);

  return {
    startExport,
    cancelExport,
    progress,
    isExporting,
    lastResult,
    error,
    clearError,
    clearLastResult,
    downloadResult,
    getEstimatedTime,
  };
}

/**
 * Simplified hook for quick exports without full configuration.
 *
 * @example
 * ```tsx
 * function QuickExportButton() {
 *   const { exportToCsv, exportToExcel, isExporting } = useQuickExport({
 *     columns,
 *     adapter,
 *   });
 *
 *   return (
 *     <>
 *       <Button onClick={() => exportToCsv('users')}>CSV</Button>
 *       <Button onClick={() => exportToExcel('users')}>Excel</Button>
 *     </>
 *   );
 * }
 * ```
 */
export function useQuickExport<TData = unknown>(
  options: Omit<UseExportOptions<TData>, 'onComplete' | 'onError' | 'onProgress'>
): {
  exportToCsv: (filename?: string) => Promise<ExportResult>;
  exportToExcel: (filename?: string) => Promise<ExportResult>;
  exportToJson: (filename?: string) => Promise<ExportResult>;
  isExporting: boolean;
  progress: ExportProgress | null;
} {
  const { startExport, isExporting, progress } = useExport(options);

  const exportToCsv = useCallback(
    (filename = 'export') => startExport({ format: 'csv', filename }),
    [startExport]
  );

  const exportToExcel = useCallback(
    (filename = 'export') => startExport({ format: 'excel', filename }),
    [startExport]
  );

  const exportToJson = useCallback(
    (filename = 'export') => startExport({ format: 'json', filename }),
    [startExport]
  );

  return {
    exportToCsv,
    exportToExcel,
    exportToJson,
    isExporting,
    progress,
  };
}
