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
import type { AdapterCapabilities, DerivedFetchSpec } from './derived';
import type { FilterGroupNode, FilterOperator, FilterOption, FilterState } from './filter';
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

  /**
   * Filter conditions for data filtering.
   *
   * A bare `FilterState[]` means **implicit AND** (the ergonomic default for
   * the overwhelmingly common "a few ANDed filters" case). A
   * {@link FilterGroupNode} is how a caller expresses OR or nesting (design
   * `plans/design/core-contract-v2.md` §1.1). Core does **not** wrap a bare
   * array before dispatch — adapters must accept both the flat array
   * (implicit AND) and a {@link FilterGroupNode} tree.
   */
  filters?: FilterState[] | FilterGroupNode;

  /** Global search query */
  search?: string;

  /** Specific columns to include in the result */
  columns?: string[];

  /**
   * Server-derived column specs (plan 060). Attached by the instance fetch
   * path / UI from column definitions — not adapter-constructor config.
   * Adapters validate each spec against schema/relationships.
   */
  derived?: DerivedFetchSpec[];

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

  /**
   * Optional abort signal for in-flight request cancellation.
   * Adapters SHOULD honor abort when possible; they may ignore it.
   */
  signal?: AbortSignal;
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
 * Optional parameters for the three facet-query methods on {@link TableAdapter}
 * (`getFilterOptions`, `getFacetedValues`, `getMinMaxValues`).
 *
 * @description
 * A facet describes the distribution of values in a column -- the options a
 * multi-select filter offers, how many rows match each option, or the
 * numeric range a slider spans. Without `filters`, a facet describes the
 * WHOLE table, independent of whatever the user has currently filtered by.
 * Passing the caller's active filter state here makes the facet
 * FILTER-AWARE: the returned options/counts/range reflect only rows that
 * would match those filters -- the standard behavior users expect from a
 * filtering UI (e.g. faceted search sidebars).
 *
 * **Self-exclusion is mandatory for conforming implementations.** When
 * computing the facet for `columnId` (the method's first argument), every
 * filter leaf targeting that SAME column must be excluded from the filters
 * applied here -- apply every other leaf, but never a leaf whose own
 * `columnId` equals the facet's `columnId`. This is what lets a multi-select
 * facet on the column you're actively filtering keep showing its sibling
 * options (and their counts) instead of collapsing to only the option(s)
 * already selected. For a {@link FilterGroupNode} tree, self-exclusion means
 * pruning matching leaves out of the tree (dropping a group that becomes
 * empty as a result, and unwrapping a group left with a single child) --
 * not rejecting the whole tree. `getMinMaxValues` and `getFilterOptions`
 * follow the identical rule.
 *
 * @example
 * ```typescript
 * // User has filtered status = 'active'. Fetching facets for the 'role'
 * // column should only count roles among active users...
 * const roleFacets = await adapter.getFacetedValues('role', {
 *   filters: [{ columnId: 'status', operator: 'equals', values: ['active'], type: 'option' }],
 * });
 * // ...but fetching facets for 'status' itself must ignore its own filter
 * // (self-exclusion), so every status option still shows its true count:
 * const statusFacets = await adapter.getFacetedValues('status', {
 *   filters: [{ columnId: 'status', operator: 'equals', values: ['active'], type: 'option' }],
 * });
 * ```
 */
export interface FacetQueryParams {
  /**
   * The caller's current filter state, in either shape
   * {@link FetchDataParams.filters} accepts (a flat implicit-AND array or a
   * {@link FilterGroupNode} tree). Pass your full active filter state
   * unmodified -- self-exclusion (see interface docs) is the adapter's
   * responsibility, not the caller's.
   */
  filters?: FilterState[] | FilterGroupNode;

  /**
   * Transport-level cancellation for this read. Never serialized by wire
   * adapters; in-process adapters may ignore it.
   */
  signal?: AbortSignal;

  /**
   * Cap distinct facet values returned, ordered by count descending.
   * Default: `100`. Pass `null` to disable the cap (return all values).
   * A positive integer overrides the default.
   *
   * Invalid values (`0`, negatives, `NaN`/`Infinity`, or non-integers) are
   * treated as omitted: adapters SHOULD fall back to the default `100`, not
   * return an empty list or silently floor (e.g. `1.9` → `1`).
   */
  limit?: number | null;
}

/**
 * Schema-derived column description — the raw material for auto columns
 * (plan 054). Returned by {@link TableAdapter.describeColumns}; consumed by
 * `resolveTableColumns` (core) to enrich explicit column definitions and to
 * build inferred ones for `t.auto()` / no-factory `define`.
 */
export interface InferredColumnSpec {
  /** Storage field name (own-table). Doubles as the auto column id. */
  field: string;
  /** Mapped Better Tables column type. */
  columnType: ColumnType;
  /** Humanized display label. */
  label: string;
  /** Declared enum choices, when the schema knows them. */
  options?: Array<{ value: string; label: string }>;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey: boolean;
  /** False for PKs and anything the adapter cannot write back. */
  writable: boolean;
}

/**
 * Where a single cell edit for a column actually lands (plan 055) — resolved
 * by {@link TableAdapter.resolveCellWriteTarget}. For a flat column this is
 * the primary table itself; for a relationship-path column
 * (`'customer.company'`) it is the RELATED table, plus the row-data path to
 * the related row's id so the caller can address the write.
 */
export interface CellWriteTarget {
  /** JS schema key of the table the write lands in. */
  table: string;
  /** Storage field on that table. */
  field: string;
  /** Row-data path to the target row's id (e.g. 'customer.id'), or null for own-table. */
  relatedIdPath: string | null;
  /** False for one-to-many paths — never cell-editable. */
  single: boolean;
  /** Schema-level writability (PK/unknown → false). */
  writable: boolean;
}

/**
 * Optional per-call options for adapter write methods. The instance surface
 * (`tables.createRecord(table, data)`) injects `{ table: table.tableName }`
 * so multi-table schemas don't rely on `defaultMutationTable`.
 */
export interface MutationOptions {
  /** Explicit mutation target — JS schema key of the table to write. */
  table?: string;
  /**
   * The originating COLUMN id for a single-cell edit (plan 055 bug fix),
   * e.g. `'customer.company'` for a relationship-path column whose
   * `data` key is the RELATED table's storage field (`'company'`). Direct
   * DB adapters (Drizzle, etc.) ignore this — they key `data` by storage
   * field already. Wire adapters (`httpAdapter`) MUST prefer it over the
   * `data` key when present: allow-lists and `resolveCellWriteTarget` are
   * keyed by column id, not storage field, so sending the storage field on
   * the wire lets it collide with an unrelated column/table that happens
   * to share the same field name.
   */
  columnId?: string;
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
  /**
   * Filter conditions to apply — so an export reflects the CURRENT view, not
   * the whole table. Same shape as {@link FetchDataParams.filters} (a flat
   * `FilterState[]` is implicit AND; a {@link FilterGroupNode} nests). Omit to
   * export unfiltered.
   */
  filters?: FilterState[] | FilterGroupNode;
  /** Sort order to apply, matching the current view. */
  sorting?: SortingParams[];
  /**
   * Maximum rows to export. Bounds the in-memory fetch so a large table can't
   * OOM the export. Adapters default to a safe cap
   * ({@link DEFAULT_EXPORT_ROW_CAP}) when omitted; pass a larger value to opt
   * into a bigger (costlier) export.
   */
  maxRows?: number;
  /** Additional format-specific options */
  options?: Record<string, unknown>;
}

/**
 * Default upper bound on rows an `exportData` implementation fetches when
 * {@link ExportParams.maxRows} is not given. Keeps "Export all" from pulling an
 * unbounded result set into memory; override per-call for larger exports.
 */
export const DEFAULT_EXPORT_ROW_CAP = 50_000;

/**
 * Result from data export operation.
 *
 * Contains the exported data as a blob or string along with
 * metadata about the export file.
 *
 * @example
 * ```typescript
 * const exportResult: ExportResult = {
 *   data: new Blob(['name,email\nJohn,john@example.com'], { type: 'text/csv' }),
 *   filename: 'users.csv',
 *   mimeType: 'text/csv'
 * };
 * ```
 */
export interface ExportResult {
  /** Exported data as blob or string */
  data: Blob | string;
  /** Suggested filename for the export */
  filename: string;
  /** MIME type of the exported data */
  mimeType: string;
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
   * @param params - Optional facet parameters. See {@link FacetQueryParams}
   *   for the filter-aware, self-exclusion semantics an implementation must
   *   follow when `params.filters` is provided.
   * @returns Promise resolving to filter options
   *
   * @example
   * ```typescript
   * const options = await adapter.getFilterOptions('status');
   * // Returns: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]
   *
   * // Filter-aware: options for 'role' among currently-active users only.
   * const activeRoleOptions = await adapter.getFilterOptions('role', {
   *   filters: [{ columnId: 'status', operator: 'equals', values: ['active'], type: 'option' }],
   * });
   * ```
   */
  getFilterOptions(columnId: string, params?: FacetQueryParams): Promise<FilterOption[]>;

  /**
   * Get faceted values for a column (count of each unique value).
   *
   * @param columnId - The column identifier
   * @param params - Optional facet parameters. See {@link FacetQueryParams}
   *   for the filter-aware, self-exclusion semantics an implementation must
   *   follow when `params.filters` is provided.
   * @returns Promise resolving to faceted values map
   *
   * @example
   * ```typescript
   * const faceted = await adapter.getFacetedValues('status');
   * // Returns: Map { 'active' => 120, 'inactive' => 30 }
   * ```
   */
  getFacetedValues(columnId: string, params?: FacetQueryParams): Promise<Map<string, number>>;

  /**
   * Get minimum and maximum values for numeric columns.
   *
   * @param columnId - The column identifier
   * @param params - Optional facet parameters. See {@link FacetQueryParams}
   *   for the filter-aware, self-exclusion semantics an implementation must
   *   follow when `params.filters` is provided.
   * @returns Promise resolving to [min, max] tuple
   *
   * @example
   * ```typescript
   * const [min, max] = await adapter.getMinMaxValues('age');
   * // Returns: [18, 65]
   * ```
   */
  getMinMaxValues(columnId: string, params?: FacetQueryParams): Promise<[number, number]>;

  /**
   * Optional: describe a table's columns from the underlying schema —
   * powers auto column inference (`t.auto()` / no-factory `define`).
   * `table` follows the same resolution as {@link FetchDataParams.primaryTable}.
   *
   * @param table - Explicit table to describe. When omitted, the adapter
   *   resolves it exactly like a read with no `columns`/`primaryTable`
   *   (single-table schemas stay zero-config; multi-table schemas need the
   *   argument or a configured default).
   * @returns Promise resolving to one {@link InferredColumnSpec} per
   *   own-table column, in stable schema order.
   */
  describeColumns?(table?: string): Promise<InferredColumnSpec[]>;

  /**
   * Optional: resolve where a cell edit for `columnId` actually lands
   * (plan 055) — the own table for flat ids, the RELATED table for
   * relationship-path ids ('customer.company'). Returns `null` when the
   * column cannot be cell-written (unknown id, JSON accessor, bare alias,
   * composite related PK). `table` follows the same resolution as
   * {@link FetchDataParams.primaryTable}.
   *
   * This is a READ (pure schema/relationship introspection) — wire adapters
   * proxy it like {@link TableAdapter.describeColumns}, independent of any
   * write opt-in.
   */
  resolveCellWriteTarget?(columnId: string, table?: string): Promise<CellWriteTarget | null>;

  /**
   * Create a new record (optional operation).
   *
   * Prefer the instance surface `tables.createRecord(table, data)` which
   * injects `{ table: table.tableName }` via {@link MutationOptions}. Direct
   * adapter callers without `options.table` keep using
   * `defaultMutationTable` / single-table inference.
   *
   * @param data - Partial data for the new record
   * @param options - Optional `{ table }` mutation target
   * @returns Promise resolving to the created record
   */
  createRecord?(data: Partial<TData>, options?: MutationOptions): Promise<TData>;

  /**
   * Update an existing record (optional operation).
   *
   * @param id - Record identifier
   * @param data - Partial data to update
   * @param options - Optional `{ table }` mutation target
   * @returns Promise resolving to the updated record
   */
  updateRecord?(id: string, data: Partial<TData>, options?: MutationOptions): Promise<TData>;

  /**
   * Delete a record (optional operation).
   *
   * @param id - Record identifier
   * @param options - Optional `{ table }` mutation target
   * @returns Promise resolving when deletion is complete
   */
  deleteRecord?(id: string, options?: MutationOptions): Promise<void>;

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

  /**
   * Whether the adapter can execute {@link FilterGroupNode} trees (nested
   * AND/OR). Optional so existing adapters compile unchanged; absence means
   * "no group support" (design §1.2). Enforcement (rejecting unsupported
   * group payloads) is a downstream plan -- this field is types-only here.
   */
  supportsFilterGroups?: boolean;

  /**
   * Maximum filter-group nesting depth the adapter accepts. Optional;
   * defaults to 3 when `supportsFilterGroups` is true (design §1.2, mirrors
   * plan 011's `Paths<T>` depth cap).
   */
  maxGroupDepth?: number;

  /**
   * Optional capability contributions (plan 060). Adapters that support
   * server-derived aggregates declare `capabilities.aggregates`.
   */
  capabilities?: AdapterCapabilities;
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
