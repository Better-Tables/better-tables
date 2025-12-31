/**
 * @fileoverview Export manager for handling table data export operations.
 *
 * This module provides comprehensive export management with batch processing,
 * progress tracking, and support for multiple formats (CSV, Excel, JSON).
 *
 * @module managers/export-manager
 */

import ExcelJS from 'exceljs';
import type { ColumnDefinition } from '../types/column';
import type {
  CsvExportOptions,
  ExcelExportOptions,
  ExportBatchConfig,
  ExportConfig,
  ExportDataFetcher,
  ExportEvent,
  ExportEventSubscriber,
  ExportFormat,
  ExportProgress,
  ExportResult,
  ExportValueTransformer,
  JsonExportOptions,
} from '../types/export';
import {
  DEFAULT_BATCH_CONFIG,
  DEFAULT_CSV_OPTIONS,
  DEFAULT_EXCEL_OPTIONS,
  EXPORT_EXTENSIONS,
  EXPORT_MIME_TYPES,
} from '../types/export';

/**
 * Export manager for handling table data export with batch processing.
 *
 * Provides efficient export of large datasets by processing data in batches,
 * supporting progress tracking, cancellation, and multiple output formats.
 *
 * @template TData - The type of data being exported
 *
 * @example
 * ```typescript
 * const exportManager = new ExportManager<User>(columns, {
 *   dataFetcher: async ({ offset, limit }) => {
 *     const result = await adapter.fetchData({ pagination: { page: Math.floor(offset / limit) + 1, limit } });
 *     return { data: result.data, total: result.total };
 *   },
 *   valueTransformer: (value, row, column) => {
 *     if (column.type === 'date' && value) return new Date(value).toISOString();
 *     return String(value ?? '');
 *   }
 * });
 *
 * // Subscribe to progress
 * const unsubscribe = exportManager.subscribe((event) => {
 *   if (event.type === 'progress') {
 *     console.log(`Export progress: ${event.progress.percentage}%`);
 *   }
 * });
 *
 * // Start export
 * const result = await exportManager.export({
 *   format: 'csv',
 *   filename: 'users-export',
 *   batch: { batchSize: 500 }
 * });
 *
 * if (result.success && result.data) {
 *   downloadBlob(result.data, result.filename);
 * }
 * ```
 */
export class ExportManager<TData = unknown> {
  private columns: ColumnDefinition<TData>[];
  private dataFetcher: ExportDataFetcher<TData>;
  private valueTransformer?: ExportValueTransformer<TData>;
  private subscribers: ExportEventSubscriber[] = [];
  private abortController: AbortController | null = null;
  private currentProgress: ExportProgress | null = null;

  /**
   * Create a new export manager instance.
   *
   * @param columns - Column definitions for the table
   * @param options - Export manager options
   */
  constructor(
    columns: ColumnDefinition<TData>[],
    options: {
      dataFetcher: ExportDataFetcher<TData>;
      valueTransformer?: ExportValueTransformer<TData>;
    }
  ) {
    this.columns = columns;
    this.dataFetcher = options.dataFetcher;
    this.valueTransformer = options.valueTransformer;
  }

  /**
   * Export data with the specified configuration.
   *
   * @param config - Export configuration
   * @returns Promise resolving to export result
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const signal = config.signal ?? this.abortController.signal;
    try {
      // Get initial data to determine total count
      const initialResult = await this.dataFetcher({
        offset: 0,
        limit: 1,
        filters: config.filters,
        sorting: config.sorting,
        signal,
      });
      const totalRows = initialResult.total;
      if (totalRows === 0) {
        return this.createResult({
          success: true,
          format: config.format,
          filename: config.filename,
          rowCount: 0,
          duration: Date.now() - startTime,
        });
      }
      // Initialize progress
      const batchConfig = this.getBatchConfig(config.batch);
      const totalBatches = Math.ceil(totalRows / batchConfig.batchSize);
      this.initializeProgress(totalRows, totalBatches, startTime);
      this.notifySubscribers({ type: 'start', totalRows });
      // Fetch all data in batches
      const allData = await this.fetchAllDataInBatches(
        totalRows,
        batchConfig,
        config,
        signal,
        startTime
      );
      if (signal.aborted) {
        this.notifySubscribers({ type: 'cancelled' });
        return this.createResult({
          success: false,
          format: config.format,
          filename: config.filename,
          rowCount: 0,
          error: 'Export cancelled',
        });
      }
      // Generate export data
      const exportColumns = this.getExportColumns(config);
      const blob = await this.generateExportBlob(allData, exportColumns, config);
      const result = this.createResult({
        success: true,
        format: config.format,
        filename: config.filename,
        rowCount: allData.length,
        duration: Date.now() - startTime,
        data: blob,
        fileSize: blob.size,
      });
      this.updateProgress(
        'completed',
        allData.length,
        totalRows,
        totalBatches,
        totalBatches,
        startTime
      );
      this.notifySubscribers({ type: 'complete', result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      this.notifySubscribers({
        type: 'error',
        error: error instanceof Error ? error : new Error(errorMessage),
      });
      return this.createResult({
        success: false,
        format: config.format,
        filename: config.filename,
        rowCount: 0,
        error: errorMessage,
        duration: Date.now() - startTime,
      });
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel the current export operation.
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get the current export progress.
   */
  getProgress(): ExportProgress | null {
    return this.currentProgress;
  }

  /**
   * Check if an export is currently in progress.
   */
  isExporting(): boolean {
    return (
      this.currentProgress?.status === 'exporting' || this.currentProgress?.status === 'preparing'
    );
  }

  /**
   * Subscribe to export events.
   *
   * @param callback - Event callback function
   * @returns Unsubscribe function
   */
  subscribe(callback: ExportEventSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Fetch all data in batches.
   */
  private async fetchAllDataInBatches(
    totalRows: number,
    batchConfig: ExportBatchConfig,
    config: ExportConfig,
    signal: AbortSignal,
    startTime: number
  ): Promise<TData[]> {
    const allData: TData[] = [];
    const totalBatches = Math.ceil(totalRows / batchConfig.batchSize);
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (signal.aborted) {
        break;
      }
      const offset = batchIndex * batchConfig.batchSize;
      const limit = Math.min(batchConfig.batchSize, totalRows - offset);
      const result = await this.dataFetcher({
        offset,
        limit,
        filters: config.filters,
        sorting: config.sorting,
        signal,
      });
      allData.push(...result.data);
      const processedRows = Math.min(offset + limit, totalRows);
      this.updateProgress(
        'exporting',
        processedRows,
        totalRows,
        batchIndex + 1,
        totalBatches,
        startTime
      );
      this.notifySubscribers({
        type: 'batch_complete',
        batchNumber: batchIndex + 1,
        rowsProcessed: processedRows,
      });
      if (batchConfig.onBatchComplete) {
        batchConfig.onBatchComplete(processedRows, totalRows);
      }
      // Add delay between batches for UI responsiveness
      if (batchConfig.delayBetweenBatches && batchIndex < totalBatches - 1) {
        await this.delay(batchConfig.delayBetweenBatches);
      }
    }
    return allData;
  }

  /**
   * Generate export blob based on format.
   */
  private async generateExportBlob(
    data: TData[],
    columns: ColumnDefinition<TData>[],
    config: ExportConfig
  ): Promise<Blob> {
    switch (config.format) {
      case 'csv':
        return this.generateCsvBlob(data, columns, config.csv);
      case 'excel':
        return this.generateExcelBlob(data, columns, config.excel);
      case 'json':
        return this.generateJsonBlob(data, columns, config.json);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  /**
   * Generate CSV blob.
   */
  private generateCsvBlob(
    data: TData[],
    columns: ColumnDefinition<TData>[],
    options?: CsvExportOptions
  ): Blob {
    const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
    const lines: string[] = [];
    // Add BOM for UTF-8 compatibility with Excel
    const bom = opts.includeBom ? '\uFEFF' : '';
    // Add headers
    if (opts.includeHeaders) {
      const headerRow = columns
        .map((col) => this.escapeCsvValue(col.displayName, opts))
        .join(opts.delimiter);
      lines.push(headerRow);
    }
    // Add data rows
    for (const row of data) {
      const values = columns.map((col) => {
        const rawValue = col.accessor(row);
        const value = this.transformValue(rawValue, row, col);
        return this.escapeCsvValue(value, opts);
      });
      lines.push(values.join(opts.delimiter));
    }
    const csvContent = bom + lines.join(opts.lineEnding);
    return new Blob([csvContent], { type: EXPORT_MIME_TYPES.csv });
  }

  /**
   * Escape CSV value.
   */
  private escapeCsvValue(value: unknown, options: Required<CsvExportOptions>): string {
    if (value === null || value === undefined) {
      return options.nullValue;
    }
    let stringValue = String(value);
    // Check if value needs quoting
    const needsQuoting =
      options.quoteStrings &&
      (stringValue.includes(options.delimiter) ||
        stringValue.includes('"') ||
        stringValue.includes('\n') ||
        stringValue.includes('\r'));
    if (needsQuoting) {
      // Escape existing quotes by doubling them
      stringValue = stringValue.replace(/"/g, '""');
      return `"${stringValue}"`;
    }
    return stringValue;
  }

  /**
   * Generate Excel blob using ExcelJS for proper XLSX format.
   */
  private async generateExcelBlob(
    data: TData[],
    columns: ColumnDefinition<TData>[],
    options?: ExcelExportOptions
  ): Promise<Blob> {
    const opts = { ...DEFAULT_EXCEL_OPTIONS, ...options };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Better Tables';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(opts.sheetName, {
      views: opts.freezeHeader ? [{ state: 'frozen', ySplit: 1 }] : undefined,
    });
    // Define columns with headers and widths
    worksheet.columns = columns.map((col) => ({
      header: col.displayName,
      key: col.id,
      width: col.width ?? 15,
    }));
    // Style header row
    const headerRow = worksheet.getRow(1);
    if (opts.headerStyle) {
      headerRow.font = {
        bold: opts.headerStyle.bold ?? true,
        color: opts.headerStyle.fontColor
          ? { argb: opts.headerStyle.fontColor.replace('#', 'FF') }
          : undefined,
      };
      if (opts.headerStyle.backgroundColor) {
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: opts.headerStyle.backgroundColor.replace('#', 'FF') },
        };
      }
      headerRow.alignment = { vertical: 'middle' };
    } else {
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      headerRow.alignment = { vertical: 'middle' };
    }
    // Add data rows
    for (const row of data) {
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        const rawValue = col.accessor(row);
        const value = this.transformValue(rawValue, row, col);
        rowData[col.id] = value;
      }
      worksheet.addRow(rowData);
    }
    // Apply auto-filter if enabled
    if (opts.autoFilter && columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: data.length + 1, column: columns.length },
      };
    }
    // Format number and date columns
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx];
      const wsColumn = worksheet.getColumn(colIdx + 1);
      if (col.type === 'number' || col.type === 'currency') {
        wsColumn.numFmt = col.type === 'currency' ? '"$"#,##0.00' : '#,##0.00';
      } else if (col.type === 'percentage') {
        wsColumn.numFmt = '0.00%';
      } else if (col.type === 'date') {
        wsColumn.numFmt = 'yyyy-mm-dd';
      }
    }
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: EXPORT_MIME_TYPES.excel });
  }

  /**
   * Generate JSON blob.
   */
  private generateJsonBlob(
    data: TData[],
    columns: ColumnDefinition<TData>[],
    options?: JsonExportOptions
  ): Blob {
    const opts = { ...{ pretty: false, indentation: 2, includeMetadata: false }, ...options };
    const exportData = data.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const col of columns) {
        const rawValue = col.accessor(row);
        obj[col.id] = this.transformValue(rawValue, row, col);
      }
      return obj;
    });
    const output = opts.includeMetadata
      ? {
          exportedAt: new Date().toISOString(),
          rowCount: data.length,
          columns: columns.map((c) => ({ id: c.id, name: c.displayName, type: c.type })),
          data: exportData,
        }
      : exportData;
    const jsonContent = opts.pretty
      ? JSON.stringify(output, null, opts.indentation)
      : JSON.stringify(output);
    return new Blob([jsonContent], { type: EXPORT_MIME_TYPES.json });
  }

  /**
   * Transform a cell value for export.
   */
  private transformValue(value: unknown, row: TData, column: ColumnDefinition<TData>): unknown {
    if (this.valueTransformer) {
      return this.valueTransformer(value, row, column);
    }
    // Default transformations
    if (value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Get columns to export based on configuration.
   */
  private getExportColumns(config: ExportConfig): ColumnDefinition<TData>[] {
    if (!config.columns || config.columns.length === 0) {
      // Export all visible columns
      return this.columns.filter((col) => col.defaultVisible !== false);
    }
    // Filter and order columns based on config
    const columnMap = new Map(this.columns.map((col) => [col.id, col]));
    return config.columns
      .filter((ec) => ec.include !== false)
      .map((ec) => {
        const col = columnMap.get(ec.columnId);
        if (!col) return null;
        // Apply custom header if specified
        if (ec.header) {
          return { ...col, displayName: ec.header };
        }
        return col;
      })
      .filter((col): col is ColumnDefinition<TData> => col !== null);
  }

  /**
   * Get batch configuration with defaults.
   */
  private getBatchConfig(config?: Partial<ExportBatchConfig>): ExportBatchConfig {
    return {
      ...DEFAULT_BATCH_CONFIG,
      ...config,
    };
  }

  /**
   * Initialize progress state.
   */
  private initializeProgress(totalRows: number, totalBatches: number, startTime: number): void {
    this.currentProgress = {
      status: 'preparing',
      processedRows: 0,
      totalRows,
      percentage: 0,
      currentBatch: 0,
      totalBatches,
      startTime,
    };
  }

  /**
   * Update progress state.
   */
  private updateProgress(
    status: ExportProgress['status'],
    processedRows: number,
    totalRows: number,
    currentBatch: number,
    totalBatches: number,
    startTime: number
  ): void {
    const percentage = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;
    const elapsedTime = Date.now() - startTime;
    const estimatedTimeRemaining =
      percentage > 0 ? Math.round((elapsedTime / percentage) * (100 - percentage)) : undefined;
    this.currentProgress = {
      status,
      processedRows,
      totalRows,
      percentage,
      currentBatch,
      totalBatches,
      startTime,
      estimatedTimeRemaining,
    };
    this.notifySubscribers({ type: 'progress', progress: this.currentProgress });
  }

  /**
   * Create export result object.
   */
  private createResult(params: {
    success: boolean;
    format: ExportFormat;
    filename?: string;
    rowCount: number;
    duration?: number;
    data?: Blob;
    fileSize?: number;
    error?: string;
  }): ExportResult {
    const extension = EXPORT_EXTENSIONS[params.format];
    const filename = (params.filename ?? `export-${Date.now()}`) + extension;
    return {
      success: params.success,
      data: params.data,
      filename,
      mimeType: EXPORT_MIME_TYPES[params.format],
      rowCount: params.rowCount,
      fileSize: params.fileSize,
      duration: params.duration,
      error: params.error,
    };
  }

  /**
   * Notify all subscribers of an event.
   */
  private notifySubscribers(event: ExportEvent): void {
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch {
        // Error in subscriber callback - silently ignore to prevent export failure
      }
    }
  }

  /**
   * Utility delay function.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Trigger browser download for an export result.
 *
 * @param result - Export result from ExportManager
 *
 * @example
 * ```typescript
 * const result = await exportManager.export({ format: 'csv' });
 * if (result.success && result.data) {
 *   downloadExportResult(result);
 * }
 * ```
 */
export function downloadExportResult(result: ExportResult): void {
  if (!result.data) {
    throw new Error('No data to download');
  }
  const url = URL.createObjectURL(result.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create an export manager with a TableAdapter.
 *
 * @param columns - Column definitions
 * @param adapter - Table adapter for data fetching
 * @param valueTransformer - Optional value transformer
 *
 * @example
 * ```typescript
 * const exportManager = createExportManager(columns, adapter, (value, row, column) => {
 *   if (column.type === 'date') return new Date(value).toLocaleDateString();
 *   return value;
 * });
 * ```
 */
export function createExportManager<TData>(
  columns: ColumnDefinition<TData>[],
  adapter: {
    fetchData: (params: {
      pagination?: { page: number; limit: number };
      filters?: unknown[];
      sorting?: unknown[];
    }) => Promise<{ data: TData[]; total: number }>;
  },
  valueTransformer?: ExportValueTransformer<TData>
): ExportManager<TData> {
  return new ExportManager(columns, {
    dataFetcher: async ({ offset, limit, filters, sorting }) => {
      const page = Math.floor(offset / limit) + 1;
      const result = await adapter.fetchData({
        pagination: { page, limit },
        filters: filters as unknown[],
        sorting: sorting as unknown[],
      });
      return { data: result.data, total: result.total };
    },
    valueTransformer,
  });
}
