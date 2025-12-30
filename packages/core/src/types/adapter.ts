/**
 * @fileoverview Data adapter interface definitions for table data management.
 *
 * This module defines the contract for data adapters that provide data access,
 * filtering, sorting, and real-time updates for table components.
 *
 * @module types/adapter
 */

import type { ColumnType } from './column';
import type { DataEvent } from './common';
import type { ExportResult } from './export';
import type { FilterOperator, FilterOption, FilterState } from './filter';
import type { PaginationParams } from './pagination';
import type { SortingParams } from './sorting';

/**
 * Parameters for fetching data from the adapter.
 *
 * Contains all necessary information for data retrieval including
 * pagination, sorting, filtering, and search parameters.
 *
 * @example
 * ```typescript
 * const fetchParams: FetchDataParams = {
 *   pagination: { page: 1, limit: 20 },
 *   sorting: [{ columnId: 'name', direction: 'asc' }],
 *   filters: [{ columnId: 'status', operator: 'equals', values: ['active'] }],
 *   search: 'john',
 *   columns: ['id', 'name', 'email'],
 *   primaryTable: 'users', // Explicit primary table specification
 *   params: { includeDeleted: false }
 * };
 * ```
 */
export interface FetchDataParams {
  /** Pagination parameters for data retrieval */
  pagination?: PaginationParams;

  /** Sorting configuration for data ordering */
  sorting?: SortingParams[];

  /** Filter conditions for data filtering */
  filters?: FilterState[];

  /** Global search query */
  search?: string;

  /** Specific columns to include in the result */
  columns?: string[];

  /**
   * Explicit primary table specification.
   * When provided, this table will be used as the primary table for the query.
   * When not provided, the adapter will attempt to determine the primary table
   * from the column IDs using heuristics.
   *
   * @example
   * ```typescript
   * // Explicit primary table - recommended for clarity
   * const result = await adapter.fetchData({
   *   primaryTable: 'surveys',
   *   columns: ['title', 'slug'], // 'title' may be from JSONB accessor
   * });
   *
   * // Automatic determination - adapter will infer from columns
   * const result = await adapter.fetchData({
   *   columns: ['id', 'slug', 'status'], // All direct columns
   * });
   * ```
   */
  primaryTable?: string;

  /** Additional custom parameters */
  params?: Record<string, unknown>;
}

/**
 * Result from data fetching operation.
 *
 * Contains the fetched data along with pagination information,
 * faceted values for filtering, and additional metadata.
 *
 * @template TData - The type of data items returned
 *
 * @example
 * ```typescript
 * const result: FetchDataResult<User> = {
 *   data: [
 *     { id: '1', name: 'John Doe', email: 'john@example.com' },
 *     { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
 *   ],
 *   total: 150,
 *   pagination: {
 *     page: 1,
 *     limit: 20,
 *     totalPages: 8,
 *     hasNext: true,
 *     hasPrev: false
 *   },
 *   faceted: {
 *     status: new Map([['active', 120], ['inactive', 30]])
 *   },
 *   meta: { queryTime: 45 }
 * };
 * ```
 */
export interface FetchDataResult<TData = unknown> {
  /** Array of data items for the current page */
  data: TData[];

  /** Total number of items across all pages */
  total: number;

  /** Pagination information for the current request */
  pagination: {
    /** Current page number (1-based) */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNext: boolean;
    /** Whether there is a previous page */
    hasPrev: boolean;
  };

  /** Faceted values for filter options */
  faceted?: Record<string, Map<string, number>>;

  /** Additional metadata about the request/response */
  meta?: Record<string, unknown>;
}

/**
 * Parameters for data export operations.
 *
 * Configures how data should be exported including format,
 * columns, and additional options.
 *
 * @example
 * ```typescript
 * const exportParams: ExportParams = {
 *   format: 'csv',
 *   columns: ['name', 'email', 'status'],
 *   ids: ['1', '2', '3'],
 *   includeHeaders: true,
 *   options: { delimiter: ',' }
 * };
 * ```
 */
export interface ExportParams {
  /** Export format type */
  format: 'csv' | 'json' | 'excel';
  /** Specific columns to include in export */
  columns?: string[];
  /** Specific record IDs to export (if not all) */
  ids?: string[];
  /** Whether to include column headers */
  includeHeaders?: boolean;
  /** Additional format-specific options */
  options?: Record<string, unknown>;
}

/**
 * Core table adapter interface for data management.
 *
 * Defines the contract that all data adapters must implement to provide
 * data access, filtering, sorting, pagination, and real-time updates.
 *
 * @template TData - The type of data managed by the adapter
 *
 * @example
 * ```typescript
 * class DatabaseAdapter implements TableAdapter<User> {
 *   async fetchData(params: FetchDataParams): Promise<FetchDataResult<User>> {
 *     // Implementation for fetching users with filters, sorting, pagination
 *   }
 *
 *   async getFilterOptions(columnId: string): Promise<FilterOption[]> {
 *     // Implementation for getting filter options
 *   }
 *
 *   // ... other required methods
 * }
 * ```
 */
export interface TableAdapter<TData = unknown> {
  /**
   * Fetch data with filtering, sorting, and pagination.
   *
   * @param params - Parameters for data fetching
   * @returns Promise resolving to fetched data result
   *
   * @example
   * ```typescript
   * const result = await adapter.fetchData({
   *   pagination: { page: 1, limit: 20 },
   *   filters: [{ columnId: 'status', operator: 'equals', values: ['active'] }]
   * });
   * ```
   */
  fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>>;

  /**
   * Get available filter options for a specific column.
   *
   * @param columnId - The column identifier
   * @returns Promise resolving to filter options
   *
   * @example
   * ```typescript
   * const options = await adapter.getFilterOptions('status');
   * // Returns: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]
   * ```
   */
  getFilterOptions(columnId: string): Promise<FilterOption[]>;

  /**
   * Get faceted values for a column (count of each unique value).
   *
   * @param columnId - The column identifier
   * @returns Promise resolving to faceted values map
   *
   * @example
   * ```typescript
   * const faceted = await adapter.getFacetedValues('status');
   * // Returns: Map { 'active' => 120, 'inactive' => 30 }
   * ```
   */
  getFacetedValues(columnId: string): Promise<Map<string, number>>;

  /**
   * Get minimum and maximum values for numeric columns.
   *
   * @param columnId - The column identifier
   * @returns Promise resolving to [min, max] tuple
   *
   * @example
   * ```typescript
   * const [min, max] = await adapter.getMinMaxValues('age');
   * // Returns: [18, 65]
   * ```
   */
  getMinMaxValues(columnId: string): Promise<[number, number]>;

  /**
   * Create a new record (optional operation).
   *
   * @param data - Partial data for the new record
   * @returns Promise resolving to the created record
   *
   * @example
   * ```typescript
   * const newUser = await adapter.createRecord({
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * });
   * ```
   */
  createRecord?(data: Partial<TData>): Promise<TData>;

  /**
   * Update an existing record (optional operation).
   *
   * @param id - Record identifier
   * @param data - Partial data to update
   * @returns Promise resolving to the updated record
   *
   * @example
   * ```typescript
   * const updatedUser = await adapter.updateRecord('1', {
   *   name: 'John Smith'
   * });
   * ```
   */
  updateRecord?(id: string, data: Partial<TData>): Promise<TData>;

  /**
   * Delete a record (optional operation).
   *
   * @param id - Record identifier
   * @returns Promise resolving when deletion is complete
   *
   * @example
   * ```typescript
   * await adapter.deleteRecord('1');
   * ```
   */
  deleteRecord?(id: string): Promise<void>;

  /**
   * Bulk update multiple records (optional operation).
   *
   * @param ids - Array of record identifiers
   * @param data - Partial data to update
   * @returns Promise resolving to updated records
   *
   * @example
   * ```typescript
   * const updatedUsers = await adapter.bulkUpdate(['1', '2', '3'], {
   *   status: 'inactive'
   * });
   * ```
   */
  bulkUpdate?(ids: string[], data: Partial<TData>): Promise<TData[]>;

  /**
   * Bulk delete multiple records (optional operation).
   *
   * @param ids - Array of record identifiers
   * @returns Promise resolving when deletion is complete
   *
   * @example
   * ```typescript
   * await adapter.bulkDelete(['1', '2', '3']);
   * ```
   */
  bulkDelete?(ids: string[]): Promise<void>;

  /**
   * Export data in various formats (optional operation).
   *
   * @param params - Export parameters
   * @returns Promise resolving to export result
   *
   * @example
   * ```typescript
   * const exportResult = await adapter.exportData({
   *   format: 'csv',
   *   columns: ['name', 'email']
   * });
   * ```
   */
  exportData?(params: ExportParams): Promise<ExportResult>;

  /**
   * Subscribe to real-time data updates (optional operation).
   *
   * @param callback - Function to call when data changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = adapter.subscribe((event) => {
   *   console.log('Data changed:', event);
   * });
   *
   * // Later...
   * unsubscribe();
   * ```
   */
  subscribe?(callback: (event: DataEvent<TData>) => void): () => void;

  /** Adapter metadata and capabilities */
  meta: AdapterMeta;
}

/**
 * Adapter metadata interface.
 *
 * Describes the capabilities and supported features of a data adapter,
 * enabling the table to understand what operations are available.
 *
 * @example
 * ```typescript
 * const adapterMeta: AdapterMeta = {
 *   name: 'PostgreSQL Adapter',
 *   version: '1.2.0',
 *   features: {
 *     create: true,
 *     read: true,
 *     update: true,
 *     delete: true,
 *     bulkOperations: true,
 *     realTimeUpdates: false,
 *     export: true,
 *     transactions: true
 *   },
 *   supportedColumnTypes: ['text', 'number', 'date', 'boolean'],
 *   supportedOperators: {
 *     text: ['contains', 'equals', 'startsWith'],
 *     number: ['equals', 'greaterThan', 'lessThan']
 *   }
 * };
 * ```
 */
export interface AdapterMeta {
  /** Human-readable adapter name */
  name: string;

  /** Adapter version string */
  version: string;

  /** Supported feature flags */
  features: AdapterFeatures;

  /** Column types supported by this adapter */
  supportedColumnTypes: ColumnType[];

  /** Filter operators supported for each column type */
  supportedOperators: Record<ColumnType, FilterOperator[]>;
}

/**
 * Feature flags for adapter capabilities.
 *
 * Defines which operations and features are supported by the adapter.
 *
 * @example
 * ```typescript
 * const features: AdapterFeatures = {
 *   create: true,
 *   read: true,
 *   update: false,
 *   delete: false,
 *   bulkOperations: false,
 *   realTimeUpdates: true,
 *   export: true,
 *   transactions: false
 * };
 * ```
 */
export interface AdapterFeatures {
  /** Whether the adapter supports creating new records */
  create: boolean;

  /** Whether the adapter supports reading/fetching data */
  read: boolean;

  /** Whether the adapter supports updating existing records */
  update: boolean;

  /** Whether the adapter supports deleting records */
  delete: boolean;

  /** Whether the adapter supports bulk operations */
  bulkOperations: boolean;

  /** Whether the adapter supports real-time data updates */
  realTimeUpdates: boolean;

  /** Whether the adapter supports data export */
  export: boolean;

  /** Whether the adapter supports database transactions */
  transactions: boolean;
}

/**
 * Configuration options for adapters.
 *
 * Provides configuration for connection, caching, logging, and performance
 * settings that adapters can use for optimization.
 *
 * @example
 * ```typescript
 * const config: AdapterConfig = {
 *   connection: {
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'mydb'
 *   },
 *   cache: {
 *     enabled: true,
 *     ttl: 300,
 *     maxSize: 1000
 *   },
 *   logging: {
 *     enabled: true,
 *     level: 'info'
 *   },
 *   performance: {
 *     maxPageSize: 1000,
 *     defaultPageSize: 20,
 *     enableVirtualScrolling: true
 *   }
 * };
 * ```
 */
export interface AdapterConfig {
  /** Connection configuration for the data source */
  connection?: Record<string, unknown>;

  /** Caching configuration for performance optimization */
  cache?: {
    /** Whether caching is enabled */
    enabled: boolean;
    /** Cache time-to-live in seconds */
    ttl: number;
    /** Maximum number of items to cache */
    maxSize: number;
  };

  /** Logging configuration for debugging and monitoring */
  logging?: {
    /** Whether logging is enabled */
    enabled: boolean;
    /** Log level threshold */
    level: 'debug' | 'info' | 'warn' | 'error';
  };

  /** Performance configuration for optimization */
  performance?: {
    /** Maximum allowed page size */
    maxPageSize: number;
    /** Default page size for requests */
    defaultPageSize: number;
    /** Whether to enable virtual scrolling support */
    enableVirtualScrolling: boolean;
  };
}
