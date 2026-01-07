/**
 * @fileoverview Export type definitions for table data export functionality.
 *
 * This module provides comprehensive type definitions for exporting table data
 * in various formats (CSV, Excel, JSON) with support for batch processing,
 * progress tracking, and customization options.
 *
 * @module types/export
 */

import type { ColumnDefinition } from './column';
import type { FilterState } from './filter';
import type { SortingParams } from './sorting';

/**
 * Supported export formats.
 */
export type ExportFormat = 'csv' | 'excel' | 'json' | 'sql';

/**
 * SQL database dialects supported for export.
 */
export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

/**
 * Export mode for determining what to export.
 */
export type ExportMode = 'tables' | 'columns';

/**
 * Export status for tracking progress.
 */
export type ExportStatus = 'idle' | 'preparing' | 'exporting' | 'completed' | 'error' | 'cancelled';

/**
 * Configuration for batch processing during export.
 *
 * Enables efficient export of large datasets by processing data in chunks,
 * reducing memory usage and allowing progress tracking.
 *
 * @example
 * ```typescript
 * const batchConfig: ExportBatchConfig = {
 *   batchSize: 1000,
 *   delayBetweenBatches: 10,
 *   onBatchComplete: (processed, total) => {
 *     console.log(`Exported ${processed}/${total} rows`);
 *   }
 * };
 * ```
 */
export interface ExportBatchConfig {
  /** Number of rows to process per batch (default: 1000) */
  batchSize: number;

  /** Delay in milliseconds between batches for UI responsiveness (default: 0) */
  delayBetweenBatches?: number;

  /** Callback invoked after each batch is processed */
  onBatchComplete?: (processedRows: number, totalRows: number) => void;
}

/**
 * Column configuration for export.
 *
 * Allows customization of how each column is exported, including
 * custom formatting and header names.
 *
 * @example
 * ```typescript
 * const columnConfig: ExportColumnConfig = {
 *   columnId: 'createdAt',
 *   header: 'Created Date',
 *   formatter: (value) => new Date(value).toLocaleDateString(),
 *   width: 20
 * };
 * ```
 */
export interface ExportColumnConfig {
  /** Column identifier */
  columnId: string;

  /** Custom header name for export (overrides displayName) */
  header?: string;

  /** Custom value formatter for export */
  formatter?: (value: unknown, row: unknown) => string | number | boolean | null;

  /** Column width for Excel export */
  width?: number;

  /** Whether to include this column in export (default: true) */
  include?: boolean;
}

/**
 * CSV-specific export options.
 *
 * @example
 * ```typescript
 * const csvOptions: CsvExportOptions = {
 *   delimiter: ',',
 *   includeHeaders: true,
 *   quoteStrings: true,
 *   lineEnding: '\r\n',
 *   nullValue: '',
 *   convertLineBreaksToSpace: false,
 *   quoteStyle: 'quote-if-needed',
 *   decimalSeparator: '.'
 * };
 * ```
 */
export interface CsvExportOptions {
  /** Field delimiter (default: ',') */
  delimiter?: string;

  /** Whether to include column headers (default: true) */
  includeHeaders?: boolean;

  /** Whether to quote string values (default: true) */
  quoteStrings?: boolean;

  /** Line ending character(s) (default: '\r\n') */
  lineEnding?: string;

  /** Value to use for null/undefined (default: '') */
  nullValue?: string;

  /** Encoding for the output file (default: 'utf-8') */
  encoding?: string;

  /** Whether to include BOM for UTF-8 (default: true for Excel compatibility) */
  includeBom?: boolean;

  /** Whether to convert line breaks to spaces (default: false) */
  convertLineBreaksToSpace?: boolean;

  /** Quote style: 'quote-if-needed', 'double-quote', 'single-quote', 'space' (default: 'quote-if-needed') */
  quoteStyle?: 'quote-if-needed' | 'double-quote' | 'single-quote' | 'space';

  /** Decimal separator for numbers: '.' or ',' (default: '.') */
  decimalSeparator?: '.' | ',';
}

/**
 * Excel cell styling options.
 */
export interface ExcelCellStyle {
  /** Bold text */
  bold?: boolean;

  /** Italic text */
  italic?: boolean;

  /** Font size */
  fontSize?: number;

  /** Font color (hex) */
  fontColor?: string;

  /** Background color (hex) */
  backgroundColor?: string;

  /** Text alignment */
  alignment?: 'left' | 'center' | 'right';

  /** Number format (e.g., '0.00', 'yyyy-mm-dd') */
  numberFormat?: string;

  /** Border style */
  border?: boolean;
}

/**
 * Excel-specific export options.
 *
 * @example
 * ```typescript
 * const excelOptions: ExcelExportOptions = {
 *   sheetName: 'Users',
 *   freezeHeader: true,
 *   autoFilter: true,
 *   headerStyle: {
 *     bold: true,
 *     backgroundColor: '#4F81BD',
 *     fontColor: '#FFFFFF'
 *   }
 * };
 * ```
 */
export interface ExcelExportOptions {
  /** Worksheet name (default: 'Sheet1') */
  sheetName?: string;

  /** Whether to freeze the header row (default: true) */
  freezeHeader?: boolean;

  /** Whether to add auto-filter to columns (default: true) */
  autoFilter?: boolean;

  /** Whether to auto-fit column widths (default: true) */
  autoFitColumns?: boolean;

  /** Header row style */
  headerStyle?: ExcelCellStyle;

  /** Data cell style */
  dataStyle?: ExcelCellStyle;

  /** Alternate row style for zebra striping */
  alternateRowStyle?: ExcelCellStyle;

  /** Whether to use streaming for large datasets (default: true) */
  useStreaming?: boolean;
}

/**
 * JSON-specific export options.
 *
 * @example
 * ```typescript
 * const jsonOptions: JsonExportOptions = {
 *   pretty: true,
 *   includeMetadata: true
 * };
 * ```
 */
export interface JsonExportOptions {
  /** Whether to format with indentation (default: false) */
  pretty?: boolean;

  /** Indentation spaces when pretty is true (default: 2) */
  indentation?: number;

  /** Whether to include export metadata (default: false) */
  includeMetadata?: boolean;
}

/**
 * SQL-specific export options.
 *
 * @example
 * ```typescript
 * const sqlOptions: SqlExportOptions = {
 *   dialect: 'postgres',
 *   includeStructure: true,
 *   includeDrop: true,
 *   includeData: true,
 *   compressWithGzip: false,
 *   selectedTables: ['users', 'profiles']
 * };
 * ```
 */
export interface SqlExportOptions {
  /** SQL dialect to use (default: auto-detected from adapter) */
  dialect?: SqlDialect;

  /** Whether to include CREATE TABLE statements (default: true) */
  includeStructure?: boolean;

  /** Whether to include DROP TABLE IF EXISTS statements (default: false) */
  includeDrop?: boolean;

  /** Whether to include INSERT statements for data (default: true) */
  includeData?: boolean;

  /** Whether to compress the output with gzip (default: false) */
  compressWithGzip?: boolean;

  /** Selected table names to export (if empty, exports all tables) */
  selectedTables?: string[];
}

/**
 * Column information for schema metadata.
 */
export interface SchemaColumnInfo {
  /** Column name */
  name: string;

  /** Column data type */
  type: string;

  /** Whether the column is nullable */
  nullable: boolean;

  /** Whether the column is a primary key */
  isPrimaryKey: boolean;

  /** Whether the column is a foreign key */
  isForeignKey: boolean;

  /** Default value if any */
  defaultValue?: unknown;
}

/**
 * Table information for schema metadata.
 */
export interface SchemaTableInfo {
  /** Table name */
  name: string;

  /** Schema name (if applicable, e.g., 'public' for PostgreSQL) */
  schema?: string;

  /** Column information */
  columns: SchemaColumnInfo[];

  /** Number of columns */
  columnCount: number;
}

/**
 * Schema information for export operations.
 */
export interface SchemaInfo {
  /** Tables grouped by schema name */
  schemas: Record<string, SchemaTableInfo[]>;

  /** All tables flattened (for schemas that don't support schema grouping) */
  tables: SchemaTableInfo[];

  /** Detected SQL dialect from adapter */
  dialect?: SqlDialect;
}

/**
 * Comprehensive export configuration.
 *
 * @template TData - The type of data being exported
 *
 * @example
 * ```typescript
 * const config: ExportConfig<User> = {
 *   format: 'excel',
 *   filename: 'users-export',
 *   columns: [
 *     { columnId: 'name', header: 'Full Name' },
 *     { columnId: 'email', header: 'Email Address' },
 *     { columnId: 'createdAt', formatter: (v) => new Date(v).toISOString() }
 *   ],
 *   batch: { batchSize: 500 },
 *   excel: { sheetName: 'Active Users', freezeHeader: true }
 * };
 * ```
 */
export interface ExportConfig {
  /** Export format */
  format: ExportFormat;

  /** Output filename (without extension) */
  filename?: string;

  /** Column configurations for export */
  columns?: ExportColumnConfig[];

  /** Filter to apply when fetching data */
  filters?: FilterState[];

  /** Sorting to apply when fetching data */
  sorting?: SortingParams[];

  /** Specific row IDs to export (if not all) */
  selectedIds?: string[];

  /** Whether to export all data or just current page (default: 'all') */
  scope?: 'all' | 'page' | 'selected';

  /** Batch processing configuration */
  batch?: Partial<ExportBatchConfig>;

  /** CSV-specific options */
  csv?: CsvExportOptions;

  /** Excel-specific options */
  excel?: ExcelExportOptions;

  /** JSON-specific options */
  json?: JsonExportOptions;

  /** SQL-specific options */
  sql?: SqlExportOptions;

  /** Export mode: 'tables' for full table export, 'columns' for column selection (default: 'columns') */
  mode?: ExportMode;

  /** Schema information for tables mode (required when mode === 'tables') */
  schemaInfo?: SchemaInfo;

  /** Selected table names for tables mode (required when mode === 'tables') */
  selectedTables?: string[];

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Export progress information.
 *
 * @example
 * ```typescript
 * const progress: ExportProgress = {
 *   status: 'exporting',
 *   processedRows: 5000,
 *   totalRows: 10000,
 *   percentage: 50,
 *   currentBatch: 5,
 *   totalBatches: 10,
 *   startTime: Date.now() - 5000,
 *   estimatedTimeRemaining: 5000
 * };
 * ```
 */
export interface ExportProgress {
  /** Current export status */
  status: ExportStatus;

  /** Number of rows processed */
  processedRows: number;

  /** Total number of rows to export */
  totalRows: number;

  /** Percentage complete (0-100) */
  percentage: number;

  /** Current batch number */
  currentBatch: number;

  /** Total number of batches */
  totalBatches: number;

  /** Export start timestamp */
  startTime?: number;

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Result from export operation.
 *
 * @example
 * ```typescript
 * const result: ExportResult = {
 *   success: true,
 *   data: new Blob(['...'], { type: 'text/csv' }),
 *   filename: 'users-export.csv',
 *   mimeType: 'text/csv',
 *   rowCount: 1500,
 *   fileSize: 45678,
 *   duration: 2345
 * };
 * ```
 */
export interface ExportResult {
  /** Whether export was successful */
  success: boolean;

  /** Exported data as Blob */
  data?: Blob;

  /** Suggested filename with extension */
  filename: string;

  /** MIME type of the exported data */
  mimeType: string;

  /** Number of rows exported */
  rowCount: number;

  /** File size in bytes */
  fileSize?: number;

  /** Export duration in milliseconds */
  duration?: number;

  /** Error message if not successful */
  error?: string;
}

/**
 * Data fetcher function type for export operations.
 *
 * Allows the export manager to fetch data in batches from any source.
 *
 * @template TData - The type of data being fetched
 *
 * @example
 * ```typescript
 * const fetcher: ExportDataFetcher<User> = async ({ offset, limit, signal, columns }) => {
 *   const response = await fetch(`/api/users?offset=${offset}&limit=${limit}`, { signal });
 *   const data = await response.json();
 *   return { data: data.items, total: data.total };
 * };
 * ```
 */
export type ExportDataFetcher<TData = unknown> = (params: {
  offset: number;
  limit: number;
  filters?: FilterState[];
  sorting?: SortingParams[];
  signal?: AbortSignal;
  primaryTable?: string;
  columns?: string[];
}) => Promise<{ data: TData[]; total: number }>;

/**
 * Value transformer for converting cell values during export.
 *
 * @template TData - The type of row data being exported
 */
export type ExportValueTransformer<TData> = (
  value: unknown,
  row: TData,
  column: ColumnDefinition<TData>
) => string | number | boolean | Date | null;

/**
 * Export event types for progress tracking.
 */
export type ExportEvent =
  | { type: 'start'; totalRows: number }
  | { type: 'progress'; progress: ExportProgress }
  | { type: 'batch_complete'; batchNumber: number; rowsProcessed: number }
  | { type: 'complete'; result: ExportResult }
  | { type: 'error'; error: Error }
  | { type: 'cancelled' };

/**
 * Export event subscriber function type.
 */
export type ExportEventSubscriber = (event: ExportEvent) => void;

/**
 * MIME types for export formats.
 */
export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  sql: 'application/sql',
} as const;

/**
 * File extensions for export formats.
 */
export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: '.csv',
  excel: '.xlsx',
  json: '.json',
  sql: '.sql',
} as const;

/**
 * Default batch configuration.
 */
export const DEFAULT_BATCH_CONFIG: ExportBatchConfig = {
  batchSize: 1000,
  delayBetweenBatches: 0,
} as const;

/**
 * Default CSV export options.
 */
export const DEFAULT_CSV_OPTIONS: Required<CsvExportOptions> = {
  delimiter: ',',
  includeHeaders: true,
  quoteStrings: true,
  lineEnding: '\r\n',
  nullValue: '',
  encoding: 'utf-8',
  includeBom: true,
  convertLineBreaksToSpace: false,
  quoteStyle: 'quote-if-needed',
  decimalSeparator: '.',
} as const;

/**
 * Default SQL export options.
 */
export const DEFAULT_SQL_OPTIONS: Required<Omit<SqlExportOptions, 'dialect' | 'selectedTables'>> = {
  includeStructure: true,
  includeDrop: false,
  includeData: true,
  compressWithGzip: false,
} as const;

/**
 * Default Excel export options.
 */
export const DEFAULT_EXCEL_OPTIONS: Required<ExcelExportOptions> = {
  sheetName: 'Sheet1',
  freezeHeader: true,
  autoFilter: true,
  autoFitColumns: true,
  headerStyle: {
    bold: true,
    backgroundColor: '#4472C4',
    fontColor: '#FFFFFF',
    alignment: 'center',
  },
  dataStyle: {},
  alternateRowStyle: {
    backgroundColor: '#F2F2F2',
  },
  useStreaming: true,
} as const;
