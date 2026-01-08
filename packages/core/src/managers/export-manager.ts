/**
 * @fileoverview Export manager for handling table data export operations.
 *
 * This module provides comprehensive export management with batch processing,
 * progress tracking, and support for multiple formats (CSV, Excel, JSON).
 *
 * @module managers/export-manager
 */

import ExcelJS from 'exceljs';
import pako from 'pako';
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
  SqlDialect,
  SqlExportOptions,
} from '../types/export';
import {
  DEFAULT_BATCH_CONFIG,
  DEFAULT_CSV_OPTIONS,
  DEFAULT_EXCEL_OPTIONS,
  DEFAULT_SQL_OPTIONS,
  EXPORT_EXTENSIONS,
  EXPORT_MIME_TYPES,
} from '../types/export';
import { schemaTableToColumnDefinitions } from '../utils/schema-to-columns';

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
      // Handle "tables" mode specially - export each selected table
      if (config.mode === 'tables' && config.selectedTables && config.selectedTables.length > 0) {
        return this.exportTables(config, startTime, signal);
      }

      // Get initial data to determine total count
      // Extract column IDs to ensure relations are loaded
      const exportColumnsForFetch = this.getExportColumns(config);
      const columnIds = exportColumnsForFetch.map((col) => col.id);
      const initialResult = await this.dataFetcher({
        offset: 0,
        limit: 1,
        filters: config.filters,
        sorting: config.sorting,
        signal,
        columns: columnIds,
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
        sqlCompressed: config.format === 'sql' && config.sql?.compressWithGzip,
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
   * Export multiple tables in "tables" mode.
   * Each table is exported separately using its schema-derived columns.
   */
  private async exportTables(
    config: ExportConfig,
    startTime: number,
    signal: AbortSignal
  ): Promise<ExportResult> {
    if (!config.schemaInfo || !config.selectedTables || config.selectedTables.length === 0) {
      throw new Error('Schema info and selected tables are required for tables mode');
    }

    const { schemaInfo, selectedTables } = config;

    // For SQL format, export all tables in one file
    if (config.format === 'sql') {
      return this.exportTablesAsSql(config, schemaInfo, selectedTables, startTime, signal);
    }

    // For Excel format, export all tables in one file with multiple sheets
    if (config.format === 'excel') {
      return this.exportTablesAsExcel(config, schemaInfo, selectedTables, startTime, signal);
    }

    // For CSV/JSON formats, export each table as a separate file
    return this.exportTablesAsMultipleFiles(config, schemaInfo, selectedTables, startTime, signal);
  }

  /**
   * Export multiple tables as separate files (CSV/JSON formats).
   */
  private async exportTablesAsMultipleFiles(
    config: ExportConfig,
    schemaInfo: import('../types/export').SchemaInfo,
    selectedTables: string[],
    startTime: number,
    signal: AbortSignal
  ): Promise<ExportResult> {
    const batchConfig = this.getBatchConfig(config.batch);
    const files: Array<{
      data: Blob;
      filename: string;
      mimeType: string;
      rowCount: number;
      fileSize?: number;
    }> = [];
    let totalRows = 0;

    for (let tableIndex = 0; tableIndex < selectedTables.length; tableIndex++) {
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

      const tableName = selectedTables[tableIndex];
      const tableInfo = schemaInfo.tables.find((t) => t.name === tableName);
      if (!tableInfo) continue;

      // Create columns from schema
      const tableColumns = schemaTableToColumnDefinitions<Record<string, unknown>>(tableInfo);
      const columnNames = tableInfo.columns.map((col) => col.name);

      // Get initial data to determine total count
      const initialResult = await this.dataFetcher({
        offset: 0,
        limit: 1,
        filters: undefined,
        sorting: undefined,
        signal,
        primaryTable: tableName,
        columns: columnNames,
      });

      const tableTotalRows = initialResult.total;
      if (tableTotalRows === 0) {
        // Create empty file for empty table
        const emptyBlob = await this.generateExportBlob(
          [],
          tableColumns as unknown as ColumnDefinition<TData>[],
          config
        );
        const extension = EXPORT_EXTENSIONS[config.format];
        const filename = `${tableName}${extension}`;
        files.push({
          data: emptyBlob,
          filename,
          mimeType: EXPORT_MIME_TYPES[config.format],
          rowCount: 0,
          fileSize: emptyBlob.size,
        });
        continue;
      }

      totalRows += tableTotalRows;

      // Update progress for this table
      const totalBatches = Math.ceil(tableTotalRows / batchConfig.batchSize);
      if (tableIndex === 0) {
        this.initializeProgress(totalRows, totalBatches, startTime);
        this.notifySubscribers({ type: 'start', totalRows });
      }

      // Fetch all data in batches
      const allData = await this.fetchAllDataInBatchesForTable(
        tableTotalRows,
        batchConfig,
        config,
        tableName,
        columnNames,
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

      // Generate export blob for this table
      const blob = await this.generateExportBlob(
        allData as unknown as TData[],
        tableColumns as unknown as ColumnDefinition<TData>[],
        config
      );

      const extension = EXPORT_EXTENSIONS[config.format];
      const filename = `${tableName}${extension}`;
      files.push({
        data: blob,
        filename,
        mimeType: EXPORT_MIME_TYPES[config.format],
        rowCount: allData.length,
        fileSize: blob.size,
      });
    }

    const result = this.createResult({
      success: true,
      format: config.format,
      filename: config.filename,
      rowCount: totalRows,
      duration: Date.now() - startTime,
      files,
    });

    this.updateProgress(
      'completed',
      totalRows,
      totalRows,
      selectedTables.length,
      selectedTables.length,
      startTime
    );
    this.notifySubscribers({ type: 'complete', result });
    return result;
  }

  /**
   * Export multiple tables as Excel with separate sheets.
   */
  private async exportTablesAsExcel(
    config: ExportConfig,
    schemaInfo: import('../types/export').SchemaInfo,
    selectedTables: string[],
    startTime: number,
    signal: AbortSignal
  ): Promise<ExportResult> {
    const batchConfig = this.getBatchConfig(config.batch);
    const opts = { ...DEFAULT_EXCEL_OPTIONS, ...config.excel };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Better Tables';
    workbook.created = new Date();

    let totalRows = 0;
    const allTableData: Array<{
      tableName: string;
      data: Record<string, unknown>[];
      columns: ColumnDefinition<Record<string, unknown>>[];
    }> = [];

    // Fetch data for all tables
    for (let tableIndex = 0; tableIndex < selectedTables.length; tableIndex++) {
      if (signal.aborted) {
        this.notifySubscribers({ type: 'cancelled' });
        return this.createResult({
          success: false,
          format: 'excel',
          filename: config.filename,
          rowCount: 0,
          error: 'Export cancelled',
        });
      }

      const tableName = selectedTables[tableIndex];
      const tableInfo = schemaInfo.tables.find((t) => t.name === tableName);
      if (!tableInfo) continue;

      const tableColumns = schemaTableToColumnDefinitions<Record<string, unknown>>(tableInfo);
      const columnNames = tableInfo.columns.map((col) => col.name);

      // Get initial data to determine total count
      const initialResult = await this.dataFetcher({
        offset: 0,
        limit: 1,
        filters: undefined,
        sorting: undefined,
        signal,
        primaryTable: tableName,
        columns: columnNames,
      });

      const tableTotalRows = initialResult.total;
      if (tableTotalRows === 0) {
        // Still create a sheet for empty table
        allTableData.push({ tableName, data: [], columns: tableColumns });
        continue;
      }

      totalRows += tableTotalRows;

      // Update progress
      if (tableIndex === 0) {
        const totalBatches = Math.ceil(tableTotalRows / batchConfig.batchSize);
        this.initializeProgress(totalRows, totalBatches, startTime);
        this.notifySubscribers({ type: 'start', totalRows });
      }

      // Fetch all data in batches
      const tableData = await this.fetchAllDataInBatchesForTable(
        tableTotalRows,
        batchConfig,
        config,
        tableName,
        columnNames,
        signal,
        startTime
      );

      if (signal.aborted) {
        this.notifySubscribers({ type: 'cancelled' });
        return this.createResult({
          success: false,
          format: 'excel',
          filename: config.filename,
          rowCount: 0,
          error: 'Export cancelled',
        });
      }

      allTableData.push({ tableName, data: tableData, columns: tableColumns });
    }

    // Create worksheets for each table
    for (const { tableName, data, columns } of allTableData) {
      // Sanitize sheet name (Excel has restrictions on sheet names)
      const sheetName = this.sanitizeSheetName(tableName);
      const worksheet = workbook.addWorksheet(sheetName, {
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
          // Type assertion is safe here - we're in tables mode with Record<string, unknown> data
          const rawValue = col.accessor(row);
          // For transformValue, we need to cast since it expects TData but we have Record<string, unknown>
          const value = this.transformValue(
            rawValue,
            row as unknown as TData,
            col as unknown as ColumnDefinition<TData>
          );
          rowData[col.id] = value;
        }
        worksheet.addRow(rowData);
      }

      // Apply auto-filter if enabled
      if (opts.autoFilter && columns.length > 0 && data.length > 0) {
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
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: EXPORT_MIME_TYPES.excel });

    const result = this.createResult({
      success: true,
      format: 'excel',
      filename: config.filename,
      rowCount: totalRows,
      duration: Date.now() - startTime,
      data: blob,
      fileSize: blob.size,
    });

    this.updateProgress(
      'completed',
      totalRows,
      totalRows,
      selectedTables.length,
      selectedTables.length,
      startTime
    );
    this.notifySubscribers({ type: 'complete', result });
    return result;
  }

  /**
   * Sanitize sheet name for Excel (max 31 chars, no special characters).
   */
  private sanitizeSheetName(name: string): string {
    // Excel sheet name restrictions:
    // - Max 31 characters
    // - Cannot contain: [ ] * ? : / \
    let sanitized = name.replace(/[[\]*?:/\\]/g, '_');
    if (sanitized.length > 31) {
      sanitized = sanitized.substring(0, 31);
    }
    return sanitized || 'Sheet';
  }

  /**
   * Export tables as SQL (handles multiple tables).
   */
  private async exportTablesAsSql(
    config: ExportConfig,
    schemaInfo: import('../types/export').SchemaInfo,
    selectedTables: string[],
    startTime: number,
    signal: AbortSignal
  ): Promise<ExportResult> {
    // SQL export already handles multiple tables in generateSqlBlob
    // We just need to fetch data for each table and combine them
    const allTableData: Array<{
      tableName: string;
      data: Record<string, unknown>[];
      columns: ColumnDefinition<Record<string, unknown>>[];
    }> = [];
    const batchConfig = this.getBatchConfig(config.batch);

    let totalRows = 0;
    for (const tableName of selectedTables) {
      const tableInfo = schemaInfo.tables.find((t) => t.name === tableName);
      if (!tableInfo) continue;

      const tableColumns = schemaTableToColumnDefinitions<Record<string, unknown>>(tableInfo);
      // Extract column names from schema for explicit fetching
      const columnNames = tableInfo.columns.map((col) => col.name);

      // Get initial data to determine total count
      // For table dumps, we don't apply filters or sorting - we want ALL raw table data
      const initialResult = await this.dataFetcher({
        offset: 0,
        limit: 1,
        filters: undefined,
        sorting: undefined,
        signal,
        primaryTable: tableName,
        columns: columnNames,
      });

      const tableTotalRows = initialResult.total;
      totalRows += tableTotalRows;

      if (tableTotalRows > 0) {
        const tableData = await this.fetchAllDataInBatchesForTable(
          tableTotalRows,
          batchConfig,
          config,
          tableName,
          columnNames,
          signal,
          startTime
        );
        allTableData.push({ tableName, data: tableData, columns: tableColumns });
      }
    }

    // Generate SQL blob with all tables
    const blob = await this.generateSqlBlobForTables(allTableData, config.sql || {});
    const result = this.createResult({
      success: true,
      format: 'sql',
      filename: config.filename,
      rowCount: totalRows,
      duration: Date.now() - startTime,
      data: blob,
      fileSize: blob.size,
      sqlCompressed: config.sql?.compressWithGzip,
    });

    this.notifySubscribers({ type: 'complete', result });
    return result;
  }

  /**
   * Fetch all data in batches for a specific table.
   * For table dumps, this method does not apply filters or sorting to ensure we get ALL raw table data.
   */
  private async fetchAllDataInBatchesForTable(
    totalRows: number,
    batchConfig: ExportBatchConfig,
    _config: ExportConfig,
    tableName: string,
    columnNames: string[],
    signal: AbortSignal,
    startTime: number
  ): Promise<Record<string, unknown>[]> {
    const allData: Record<string, unknown>[] = [];
    const totalBatches = Math.ceil(totalRows / batchConfig.batchSize);
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (signal.aborted) {
        break;
      }
      const offset = batchIndex * batchConfig.batchSize;
      const limit = Math.min(batchConfig.batchSize, totalRows - offset);
      // For table dumps, we don't apply filters or sorting - we want ALL raw table data
      // Pass explicit column names to ensure we get all columns from the table
      const result = await this.dataFetcher({
        offset,
        limit,
        filters: undefined,
        sorting: undefined,
        signal,
        primaryTable: tableName,
        columns: columnNames,
      });
      allData.push(...(result.data as Record<string, unknown>[]));
      const processedRows = Math.min(offset + limit, totalRows);
      this.updateProgress(
        'exporting',
        processedRows,
        totalRows,
        batchIndex + 1,
        totalBatches,
        startTime
      );
      if (batchConfig.onBatchComplete) {
        batchConfig.onBatchComplete(processedRows, totalRows);
      }
      if (batchConfig.delayBetweenBatches && batchIndex < totalBatches - 1) {
        await this.delay(batchConfig.delayBetweenBatches);
      }
    }
    return allData;
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
    // Extract column IDs from export columns (including relation columns like 'profile.bio')
    const exportColumns = this.getExportColumns(config);
    const columnIds = exportColumns.map((col) => col.id);
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
        columns: columnIds,
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
      case 'sql':
        return this.generateSqlBlob(data, columns, config.sql, config.filename);
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
      return options.nullValue === 'NULL' ? 'NULL' : options.nullValue;
    }
    let stringValue = String(value);

    // Convert line breaks to space if requested
    if (options.convertLineBreaksToSpace) {
      stringValue = stringValue.replace(/\r?\n/g, ' ').replace(/\r/g, ' ');
    }

    // Handle decimal separator for numbers
    if (options.decimalSeparator === ',' && /^\d+\.\d+$/.test(stringValue)) {
      stringValue = stringValue.replace('.', ',');
    }

    // Determine if value needs quoting based on quote style
    let needsQuoting = false;
    let quoteChar = '"';

    switch (options.quoteStyle) {
      case 'double-quote':
        quoteChar = '"';
        needsQuoting = true;
        break;
      case 'single-quote':
        quoteChar = "'";
        needsQuoting = true;
        break;
      case 'space':
        quoteChar = ' ';
        needsQuoting = true;
        break;
      case 'quote-if-needed':
      default:
        quoteChar = '"';
        needsQuoting =
          stringValue.includes(options.delimiter) ||
          stringValue.includes('"') ||
          stringValue.includes("'") ||
          stringValue.includes('\n') ||
          stringValue.includes('\r');
        break;
    }

    if (needsQuoting) {
      if (quoteChar === '"') {
        // Escape existing quotes by doubling them
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
      } else if (quoteChar === "'") {
        // Escape existing single quotes by doubling them
        stringValue = stringValue.replace(/'/g, "''");
        return `'${stringValue}'`;
      } else {
        // For space or other quote chars, just wrap
        return `${quoteChar}${stringValue}${quoteChar}`;
      }
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
   * Generate SQL blob with dialect-specific SQL generation.
   */
  private async generateSqlBlob(
    data: TData[],
    columns: ColumnDefinition<TData>[],
    options?: SqlExportOptions,
    tableName?: string
  ): Promise<Blob> {
    const opts = { ...DEFAULT_SQL_OPTIONS, ...options };
    const dialect = opts.dialect || 'postgres';
    const effectiveTableName = tableName || 'exported_data';

    const sqlLines: string[] = [];

    // Generate DROP TABLE statement if requested
    if (opts.includeDrop) {
      sqlLines.push(this.generateDropTableStatement(effectiveTableName, dialect));
      sqlLines.push('');
    }

    // Generate CREATE TABLE statement if requested
    if (opts.includeStructure) {
      sqlLines.push(this.generateCreateTableStatement(effectiveTableName, columns, dialect));
      sqlLines.push('');
    }

    // Generate INSERT statements if requested and data exists
    if (opts.includeData && data.length > 0) {
      const insertStatements = this.generateInsertStatements(
        effectiveTableName,
        data,
        columns,
        dialect
      );
      sqlLines.push(...insertStatements);
    }

    const sqlContent = sqlLines.join('\n');

    // Compress with gzip if requested
    if (opts.compressWithGzip) {
      const compressed = pako.gzip(sqlContent, { level: 9 });
      return new Blob([compressed], { type: 'application/gzip' });
    }

    return new Blob([sqlContent], { type: EXPORT_MIME_TYPES.sql });
  }

  /**
   * Generate SQL blob for multiple tables.
   */
  private async generateSqlBlobForTables(
    allTableData: Array<{
      tableName: string;
      data: Record<string, unknown>[];
      columns: ColumnDefinition<Record<string, unknown>>[];
    }>,
    options: SqlExportOptions
  ): Promise<Blob> {
    const opts = { ...DEFAULT_SQL_OPTIONS, ...options };
    const dialect = opts.dialect || 'postgres';
    const sqlLines: string[] = [];

    for (const { tableName, data, columns } of allTableData) {
      // Generate DROP TABLE statement if requested
      if (opts.includeDrop) {
        sqlLines.push(this.generateDropTableStatement(tableName, dialect));
        sqlLines.push('');
      }

      // Generate CREATE TABLE statement if requested
      if (opts.includeStructure) {
        // Type assertion is safe here - we're working with Record<string, unknown> in tables mode
        sqlLines.push(
          this.generateCreateTableStatement(
            tableName,
            columns as unknown as ColumnDefinition<TData>[],
            dialect
          )
        );
        sqlLines.push('');
      }

      // Generate INSERT statements if requested and data exists
      if (opts.includeData && data.length > 0) {
        // Type assertion is safe here - we're working with Record<string, unknown> in tables mode
        const insertStatements = this.generateInsertStatements(
          tableName,
          data as unknown as TData[],
          columns as unknown as ColumnDefinition<TData>[],
          dialect
        );
        sqlLines.push(...insertStatements);
        sqlLines.push('');
      }
    }

    const sqlContent = sqlLines.join('\n');

    // Compress with gzip if requested
    if (opts.compressWithGzip) {
      const compressed = pako.gzip(sqlContent, { level: 9 });
      return new Blob([compressed], { type: 'application/gzip' });
    }

    return new Blob([sqlContent], { type: EXPORT_MIME_TYPES.sql });
  }

  /**
   * Generate DROP TABLE statement for the specified dialect.
   */
  private generateDropTableStatement(tableName: string, dialect: SqlDialect): string {
    const escapedTableName = this.escapeTableName(tableName, dialect);
    switch (dialect) {
      case 'postgres':
        return `DROP TABLE IF EXISTS ${escapedTableName} CASCADE;`;
      case 'mysql':
        return `DROP TABLE IF EXISTS ${escapedTableName};`;
      case 'sqlite':
        return `DROP TABLE IF EXISTS ${escapedTableName};`;
      default:
        return `DROP TABLE IF EXISTS ${escapedTableName};`;
    }
  }

  /**
   * Generate CREATE TABLE statement for the specified dialect.
   */
  private generateCreateTableStatement(
    tableName: string,
    columns: ColumnDefinition<TData>[],
    dialect: SqlDialect
  ): string {
    const escapedTableName = this.escapeTableName(tableName, dialect);
    const columnDefinitions: string[] = [];

    for (const col of columns) {
      const escapedColumnName = this.escapeColumnName(col.id, dialect);
      const sqlType = this.getSqlType(col.type, dialect);
      const nullable = col.nullable !== false ? '' : ' NOT NULL';
      columnDefinitions.push(`  ${escapedColumnName} ${sqlType}${nullable}`);
    }

    const columnDefs = columnDefinitions.join(',\n');
    let createStatement = `CREATE TABLE ${escapedTableName} (\n${columnDefs}\n)`;

    // Add dialect-specific options
    if (dialect === 'mysql') {
      createStatement = `${createStatement} ENGINE=InnoDB`;
    }

    return `${createStatement};`;
  }

  /**
   * Generate INSERT statements for the data.
   */
  private generateInsertStatements(
    tableName: string,
    data: TData[],
    columns: ColumnDefinition<TData>[],
    dialect: SqlDialect
  ): string[] {
    const escapedTableName = this.escapeTableName(tableName, dialect);
    const columnNames = columns.map((col) => this.escapeColumnName(col.id, dialect));
    const statements: string[] = [];

    // Batch inserts for better performance (100 rows per statement for most dialects)
    const batchSize = dialect === 'sqlite' ? 500 : 100;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const valueGroups: string[] = [];

      for (const row of batch) {
        const values = columns.map((col) => {
          const rawValue = col.accessor(row);
          const value = this.transformValue(rawValue, row, col);
          return this.escapeSqlValue(value, dialect);
        });
        valueGroups.push(`(${values.join(', ')})`);
      }

      const insertStatement = `INSERT INTO ${escapedTableName} (${columnNames.join(', ')}) VALUES\n${valueGroups.join(',\n')};`;
      statements.push(insertStatement);
    }

    return statements;
  }

  /**
   * Escape table name for SQL.
   */
  private escapeTableName(name: string, dialect: SqlDialect): string {
    switch (dialect) {
      case 'postgres':
      case 'sqlite':
        return `"${name.replace(/"/g, '""')}"`;
      case 'mysql':
        return `\`${name.replace(/`/g, '``')}\``;
      default:
        return `"${name}"`;
    }
  }

  /**
   * Escape column name for SQL.
   */
  private escapeColumnName(name: string, dialect: SqlDialect): string {
    return this.escapeTableName(name, dialect);
  }

  /**
   * Get SQL type from column type.
   */
  private getSqlType(columnType: string, dialect: SqlDialect): string {
    const typeMap: Record<string, Record<SqlDialect, string>> = {
      text: {
        postgres: 'TEXT',
        mysql: 'TEXT',
        sqlite: 'TEXT',
      },
      number: {
        postgres: 'INTEGER',
        mysql: 'INT',
        sqlite: 'INTEGER',
      },
      date: {
        postgres: 'TIMESTAMP',
        mysql: 'DATETIME',
        sqlite: 'TEXT',
      },
      boolean: {
        postgres: 'BOOLEAN',
        mysql: 'BOOLEAN',
        sqlite: 'INTEGER',
      },
      currency: {
        postgres: 'DECIMAL(10, 2)',
        mysql: 'DECIMAL(10, 2)',
        sqlite: 'REAL',
      },
    };

    const normalizedType = columnType.toLowerCase();
    return typeMap[normalizedType]?.[dialect] || 'TEXT';
  }

  /**
   * Escape SQL value for the specified dialect.
   */
  private escapeSqlValue(value: unknown, dialect: SqlDialect): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'boolean') {
      switch (dialect) {
        case 'postgres':
        case 'mysql':
          return value ? 'TRUE' : 'FALSE';
        case 'sqlite':
          return value ? '1' : '0';
        default:
          return value ? 'TRUE' : 'FALSE';
      }
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (value instanceof Date) {
      const isoString = value.toISOString();
      switch (dialect) {
        case 'postgres':
          return `'${isoString}'::TIMESTAMP`;
        case 'mysql':
        case 'sqlite':
          return `'${isoString}'`;
        default:
          return `'${isoString}'`;
      }
    }

    // String value - escape single quotes
    const stringValue = String(value);
    const escaped = stringValue.replace(/'/g, "''");
    return `'${escaped}'`;
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
    // For "tables" mode, columns should be derived from schema info (handled in exportTables)
    // This method is only used for "columns" mode
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
    sqlCompressed?: boolean;
    files?: Array<{
      data: Blob;
      filename: string;
      mimeType: string;
      rowCount: number;
      fileSize?: number;
    }>;
  }): ExportResult {
    let extension = EXPORT_EXTENSIONS[params.format];
    // For SQL exports, if compressed, use .sql.gz extension
    if (params.format === 'sql' && params.sqlCompressed) {
      extension = '.sql.gz';
    }
    const filename = (params.filename ?? `export-${Date.now()}`) + extension;
    let mimeType = EXPORT_MIME_TYPES[params.format];
    // For compressed SQL, use gzip MIME type
    if (params.format === 'sql' && params.sqlCompressed) {
      mimeType = 'application/gzip';
    }
    return {
      success: params.success,
      data: params.data,
      files: params.files,
      filename,
      mimeType,
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
  // Handle multiple files (CSV/JSON multi-table exports)
  if (result.files && result.files.length > 0) {
    for (const file of result.files) {
      const url = URL.createObjectURL(file.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Small delay between downloads to ensure browser processes them
      URL.revokeObjectURL(url);
    }
    return;
  }

  // Handle single file export
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
