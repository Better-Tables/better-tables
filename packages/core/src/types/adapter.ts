import type { FilterState, FilterOption } from './filter';
import type { PaginationParams } from './pagination';
import type { SortingParams } from './sorting';
import type { ColumnType } from './column';
import type { FilterOperator } from './filter';
import type { DataEvent } from './common';

/**
 * Parameters for fetching data
 */
export interface FetchDataParams {
  /** Pagination parameters */
  pagination?: PaginationParams;

  /** Sorting parameters */
  sorting?: SortingParams[];

  /** Filter parameters */
  filters?: FilterState[];

  /** Search query */
  search?: string;

  /** Columns to include */
  columns?: string[];

  /** Additional parameters */
  params?: Record<string, any>;
}

/**
 * Result from data fetching
 */
export interface FetchDataResult<TData = any> {
  /** Data items */
  data: TData[];

  /** Total count */
  total: number;

  /** Pagination info */
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  /** Faceted values */
  faceted?: Record<string, Map<string, number>>;

  /** Additional metadata */
  meta?: Record<string, any>;
}

/**
 * Parameters for data export
 */
export interface ExportParams {
  /** Format to export */
  format: 'csv' | 'json' | 'excel';

  /** Columns to include */
  columns?: string[];

  /** IDs to export (if not all) */
  ids?: string[];

  /** Include headers */
  includeHeaders?: boolean;

  /** Additional options */
  options?: Record<string, any>;
}

/**
 * Result from data export
 */
export interface ExportResult {
  /** Export data */
  data: Blob | string;

  /** File name */
  filename: string;

  /** MIME type */
  mimeType: string;
}

/**
 * Table adapter interface
 */
export interface TableAdapter<TData = any> {
  /** Fetch data with filtering, sorting, and pagination */
  fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>>;

  /** Get available filter options for a column */
  getFilterOptions(columnId: string): Promise<FilterOption[]>;

  /** Get faceted values for a column */
  getFacetedValues(columnId: string): Promise<Map<string, number>>;

  /** Get min/max values for number columns */
  getMinMaxValues(columnId: string): Promise<[number, number]>;

  /** Create new record */
  createRecord?(data: Partial<TData>): Promise<TData>;

  /** Update existing record */
  updateRecord?(id: string, data: Partial<TData>): Promise<TData>;

  /** Delete record */
  deleteRecord?(id: string): Promise<void>;

  /** Bulk operations */
  bulkUpdate?(ids: string[], data: Partial<TData>): Promise<TData[]>;
  bulkDelete?(ids: string[]): Promise<void>;

  /** Export data */
  exportData?(params: ExportParams): Promise<ExportResult>;

  /** Subscribe to real-time updates */
  subscribe?(callback: (event: DataEvent<TData>) => void): () => void;

  /** Adapter metadata */
  meta: AdapterMeta;
}

/**
 * Adapter metadata
 */
export interface AdapterMeta {
  /** Adapter name */
  name: string;

  /** Adapter version */
  version: string;

  /** Supported features */
  features: AdapterFeatures;

  /** Supported column types */
  supportedColumnTypes: ColumnType[];

  /** Supported filter operators */
  supportedOperators: Record<ColumnType, FilterOperator[]>;
}

/**
 * Features supported by the adapter
 */
export interface AdapterFeatures {
  /** Create operations */
  create: boolean;

  /** Read operations */
  read: boolean;

  /** Update operations */
  update: boolean;

  /** Delete operations */
  delete: boolean;

  /** Bulk operations */
  bulkOperations: boolean;

  /** Real-time updates */
  realTimeUpdates: boolean;

  /** Export functionality */
  export: boolean;

  /** Transaction support */
  transactions: boolean;
}

/**
 * Configuration for adapters
 */
export interface AdapterConfig {
  /** Connection configuration */
  connection?: any;

  /** Caching configuration */
  cache?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };

  /** Logging configuration */
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };

  /** Performance configuration */
  performance?: {
    maxPageSize: number;
    defaultPageSize: number;
    enableVirtualScrolling: boolean;
  };
}
