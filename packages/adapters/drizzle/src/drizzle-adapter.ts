/**
 * @fileoverview Main Drizzle ORM adapter implementation for Better Tables
 * @module @better-tables/drizzle-adapter/drizzle-adapter
 *
 * @description
 * This is the core adapter class that implements the TableAdapter interface from Better Tables.
 * It provides a complete bridge between Drizzle ORM and the Better Tables framework, handling:
 *
 * - Automatic relationship detection from Drizzle schemas
 * - Type-safe query building with smart joins across multiple tables
 * - Efficient data fetching with filtering, sorting, and pagination
 * - Cross-table filtering and relationship navigation
 * - Data transformation from flat SQL results to nested structures
 * - Query result caching for performance
 * - Full CRUD operations (create, read, update, delete)
 * - Bulk operations support
 * - Export functionality (CSV, JSON)
 * - Real-time event subscriptions
 *
 * Key features:
 * - Works with PostgreSQL, MySQL, and SQLite
 * - Supports complex nested relationships
 * - Optimizes join paths automatically
 * - Provides excellent error messages with suggestions
 * - Thread-safe concurrent request handling
 *
 * @example
 * ```typescript
 * import { DrizzleAdapter } from '@better-tables/drizzle-adapter';
 * import { drizzle } from 'drizzle-orm/node-postgres';
 *
 * // Initialize the adapter
 * const adapter = new DrizzleAdapter({
 *   db: drizzle(connectionString),
 *   schema: { users, profiles, posts },
 *   relations: { usersRelations, profilesRelations },
 *   driver: 'postgres'
 * });
 *
 * // Fetch data with filtering and sorting
 * const result = await adapter.fetchData({
 *   columns: ['id', 'email', 'profile.bio'],
 *   filters: [{ columnId: 'email', operator: 'contains', values: ['@example.com'] }],
 *   sorting: [{ columnId: 'id', direction: 'desc' }],
 *   pagination: { page: 1, limit: 10 }
 * });
 * ```
 *
 * @see {@link TableAdapter} from @better-tables/core
 * @since 1.0.0
 */

import { DataTransformer, PrimaryTableResolver } from '@better-tables/adapters-toolkit';
import type {
  AdapterMeta,
  CellWriteTarget,
  DataEvent,
  ExportParams,
  ExportResult,
  FacetQueryParams,
  FetchDataParams,
  FetchDataResult,
  FilterGroupNode,
  FilterNode,
  FilterOption,
  FilterState,
  InferredColumnSpec,
  TableAdapter,
} from '@better-tables/core';
import {
  DEFAULT_EXPORT_ROW_CAP,
  isFilterGroupNode,
  normalizeFilterNode,
} from '@better-tables/core';
import type { Relations, SQL, SQLWrapper } from 'drizzle-orm';
import { AdapterCache } from './adapter-cache';
import { buildAdapterMeta } from './adapter-meta';
import { convertToExportFormat, getMimeType } from './export-format';
import { collectFilterLeaves, pruneFilterNodeForColumn } from './filter-handler';
import { getOperationsFactory } from './operations';
import { type BaseQueryBuilder, getQueryBuilderFactory } from './query-builders';
import { RelationshipDetector } from './relationship-detector';
import { RelationshipManager } from './relationship-manager';
import type {
  AnyTableType,
  ComputedFieldConfig,
  ComputedFieldContext,
  ComputedFieldWithResolvedSortSql,
  DatabaseDriver,
  DatabaseOperations,
  DrizzleAdapterConfig,
  DrizzleDatabase,
  FilterHandlerHooks,
  FilterTablesFromSchema,
  InferSelectModelFromFilteredSchema,
  RelationshipMap,
  TableWithId,
} from './types';
import { QueryError, SchemaError } from './types';
import {
  describeTableColumns,
  getColumnInfo,
  getColumnNames,
  getForeignKeyColumns,
  getPrimaryKeyColumns,
} from './utils/drizzle-schema-utils';
import { filterTablesFromSchema, findRelationsShapedSchemaKeys } from './utils/schema-extractor';

/**
 * Drizzle adapter implementation for Better Tables.
 *
 * This class serves as the main entry point for integrating Drizzle ORM with
 * the Better Tables framework. It implements all required TableAdapter methods
 * and provides additional functionality for relationship-aware queries.
 *
 * @class DrizzleAdapter
 * @implements {TableAdapter}
 * @template TSchema - The schema type containing all tables
 * @template TDriver - The database driver type (REQUIRED - must be explicitly specified)
 * @description Main adapter class for Drizzle ORM integration with Better Tables
 *
 * @property {DrizzleDatabase<TDriver>} db - The Drizzle database instance
 * @property {TSchema} schema - The schema containing all tables
 * @property {TDriver} driver - The database driver type
 * @property {RelationshipMap} relationships - Map of all relationships
 * @property {RelationshipDetector} relationshipDetector - Detects relationships from schema
 * @property {RelationshipManager} relationshipManager - Manages relationship paths
 * @property {DrizzleQueryBuilder} queryBuilder - Builds SQL queries
 * @property {DataTransformer} dataTransformer - Transforms flat SQL results to nested
 * @property {Map} cache - Query result cache
 * @property {Array} subscribers - Event subscribers
 * @property {object} options - Adapter configuration options
 * @property {AdapterMeta} meta - Adapter metadata including supported features
 *
 * @example
 * ```typescript
 * // REQUIRED: Specify the driver type explicitly for proper type safety
 * const adapter = new DrizzleAdapter<typeof schema, 'postgres'>({
 *   db: postgresDb,
 *   schema: { users, profiles, posts },
 *   relations: { usersRelations },
 *   driver: 'postgres',
 *   options: { cache: { enabled: true, ttl: 300000 } }
 * });
 * ```
 *
 * @see {@link TableAdapter} for the interface contract
 * @since 1.0.0
 */
export class DrizzleAdapter<TSchema extends Record<string, unknown>, TDriver extends DatabaseDriver>
  implements TableAdapter<InferSelectModelFromFilteredSchema<TSchema>>
{
  private db: DrizzleDatabase<TDriver>;
  private schema: FilterTablesFromSchema<TSchema>;
  private operations: DatabaseOperations<InferSelectModelFromFilteredSchema<TSchema>>;
  private relationships: RelationshipMap;
  private relationshipDetector: RelationshipDetector;
  private relationshipManager: RelationshipManager;
  private primaryTableResolver: PrimaryTableResolver<AnyTableType>;
  private queryBuilder: BaseQueryBuilder;
  private dataTransformer: DataTransformer<AnyTableType>;
  private cache: AdapterCache<FetchDataResult<InferSelectModelFromFilteredSchema<TSchema>>>;
  private subscribers: Array<
    (event: DataEvent<InferSelectModelFromFilteredSchema<TSchema>>) => void
  > = [];
  private options: DrizzleAdapterConfig<TSchema, TDriver>['options'];
  // Internal storage uses generic type for runtime flexibility
  // Type safety is enforced at config level via DrizzleAdapterConfig
  private computedFields: Record<string, ComputedFieldConfig[]> = {};
  private hooks?: FilterHandlerHooks;

  public readonly meta: AdapterMeta;

  /**
   * Creates a new instance of the Drizzle adapter.
   *
   * Initializes all internal components including the relationship detector,
   * relationship manager, query builder, and data transformer. Optionally
   * auto-detects relationships from the provided schema or uses manual mappings.
   *
   * @param {DrizzleAdapterConfig<TSchema, TDriver>} config - Configuration object for the adapter
   * @param {DrizzleDatabase<TDriver>} config.db - The Drizzle database instance
   * @param {TSchema} config.schema - The schema containing all Drizzle table definitions
   * @param {TDriver} config.driver - The database driver being used (REQUIRED: 'postgres', 'mysql', or 'sqlite')
   * @param {boolean} [config.autoDetectRelationships=true] - Whether to automatically detect relationships from schema
   * @param {Record<string, unknown>} [config.relations] - Raw Drizzle relations for auto-detection
   * @param {RelationshipMap} [config.relationships] - Manual relationship mappings (overrides auto-detection)
   * @param {DrizzleAdapterOptions} [config.options] - Optional adapter configuration
   * @param {Partial<AdapterMeta>} [config.meta] - Optional custom metadata
   *
   * @throws {SchemaError} If no tables are found in the schema
   *
   * @example
   * ```typescript
   * // REQUIRED: Specify the driver type explicitly for proper type safety
   * const adapter = new DrizzleAdapter<typeof schema, 'postgres'>({
   *   db: postgresDb,
   *   schema: { users, profiles },
   *   driver: 'postgres',
   *   relations: { usersRelations },
   *   options: {
   *     cache: { enabled: true, ttl: 300000 }
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  constructor(config: DrizzleAdapterConfig<TSchema, TDriver>) {
    this.db = config.db;

    // Detect a schema key whose value is a Relations wrapper rather than a
    // table (plan 030, finding 11) -- e.g. `{ ...tables, ...relationsKeyedByTableName }`,
    // where the later spread silently overwrote a real table object with a
    // same-named Relations object. filterTablesFromSchema (below) already
    // tolerates this by dropping such keys entirely, which means the
    // colliding table would otherwise silently vanish from the adapter's
    // schema instead of surfacing the construction mistake. Fail loudly
    // here, naming the colliding key(s), rather than letting it surface
    // far away at a confusing defineTable() type error.
    const relationsShapedKeys = findRelationsShapedSchemaKeys(
      config.schema as Record<string, unknown>
    );
    if (relationsShapedKeys.length > 0) {
      throw new SchemaError(
        `Schema key(s) ${relationsShapedKeys.map((key) => `'${key}'`).join(', ')} contain a ` +
          'Relations object where a table was expected. This usually means a relations map ' +
          '(keyed by table name) was spread over the tables map -- e.g. ' +
          '{ ...tables, ...relationsKeyedByTableName } -- silently overwriting the real table(s). ' +
          'Pass tables in `schema` and relations separately via the `relations` option.',
        { relationsShapedKeys }
      );
    }

    // Filter out relations from schema at runtime - schema may include both tables and relations
    this.schema = filterTablesFromSchema(config.schema) as FilterTablesFromSchema<TSchema>;
    this.options = config.options || {};
    this.cache = new AdapterCache(this.options);
    if (config.hooks !== undefined) {
      this.hooks = config.hooks;
    }
    // Type assertion is safe: config.computedFields is validated at compile time
    // Runtime structure matches Record<string, ComputedFieldConfig[]>
    this.computedFields =
      (config.computedFields as Record<string, ComputedFieldConfig[]> | undefined) || {};

    // Initialize database operations strategy based on driver
    this.operations = this.createOperationsStrategy(config.driver);

    // Initialize relationship detection
    this.relationshipDetector = new RelationshipDetector();

    if (config.autoDetectRelationships !== false) {
      // Auto-detect relationships from provided relations
      if (config.relations) {
        this.relationships = this.relationshipDetector.detectFromSchema(
          config.relations as Record<string, Relations>,
          this.schema as Record<string, unknown>
        );
        // Merge manual relationships to preserve isArray flags and other overrides
        if (config.relationships) {
          // Use mergeManualRelationships to properly merge and preserve manual overrides
          this.relationshipDetector.mergeManualRelationships(config.relationships);
          // Re-detect to get the merged relationships
          this.relationships = this.relationshipDetector.detectFromSchema(
            config.relations as Record<string, Relations>,
            this.schema as Record<string, unknown>
          );
          // Apply manual relationships after detection to override auto-detected ones
          this.relationships = { ...this.relationships, ...config.relationships };
        }
      } else {
        // No relations provided - try to detect from schema columns (e.g., array FKs)
        // This ensures array FK relationships are still detected even without relations config
        this.relationships = this.relationshipDetector.detectFromSchema(
          {},
          this.schema as Record<string, unknown>
        );
        // Merge manual relationships if provided
        if (config.relationships) {
          this.relationshipDetector.mergeManualRelationships(config.relationships);
          this.relationships = { ...this.relationships, ...config.relationships };
        }
      }
    } else {
      this.relationships = config.relationships || {};
    }

    // Initialize managers - they will be configured per query
    this.relationshipManager = new RelationshipManager(this.schema, this.relationships);
    this.primaryTableResolver = new PrimaryTableResolver(this.schema, this.relationships);

    // Initialize query builder using factory pattern based on driver
    // Primary keys are auto-detected from schema
    this.queryBuilder = this.createQueryBuilderStrategy(config.driver);
    this.dataTransformer = new DataTransformer(this.schema, this.relationshipManager, {
      getColumnNames,
      getForeignKeyColumns,
      getPrimaryKeyColumns,
    });

    // Initialize metadata
    this.meta = buildAdapterMeta(this.canResolveMutationTable(), config.meta);
  }

  /**
   * Create the appropriate database operations strategy based on the driver.
   * This uses the Factory Pattern to create the correct operations implementation.
   *
   * @private
   * @param driver - The database driver type
   * @returns The database operations implementation for the driver
   */
  private createOperationsStrategy(
    driver: TDriver
  ): DatabaseOperations<InferSelectModelFromFilteredSchema<TSchema>> {
    const createOperations = getOperationsFactory(driver);
    return createOperations<InferSelectModelFromFilteredSchema<TSchema>>(this.db);
  }

  /**
   * Create the appropriate query builder strategy based on the driver.
   * This uses the Factory Pattern to create the correct query builder implementation.
   * Primary keys are auto-detected from the schema.
   *
   * @private
   * @param driver - The database driver type
   * @returns The query builder implementation for the driver
   */
  private createQueryBuilderStrategy(driver: TDriver): BaseQueryBuilder {
    const createQueryBuilder = getQueryBuilderFactory(driver);
    return createQueryBuilder(
      this.db,
      this.schema,
      this.relationshipManager,
      this.hooks,
      this.options?.onInvalidFilter
    );
  }

  /**
   * Execute insert operation - Strategy Pattern dispatcher.
   * Delegates to the appropriate driver-specific implementation.
   *
   * @private
   * @param table - The table to insert into
   * @param data - The data to insert
   * @returns Promise with the inserted record
   */
  private async executeInsert(
    table: TableWithId,
    data: Partial<InferSelectModelFromFilteredSchema<TSchema>>
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>> {
    return this.operations.insert(table, data);
  }

  /**
   * Execute update operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeUpdate(
    table: TableWithId,
    id: string,
    data: Partial<InferSelectModelFromFilteredSchema<TSchema>>
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>> {
    return this.operations.update(table, id, data);
  }

  /**
   * Execute delete operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeDelete(
    table: TableWithId,
    id: string
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>> {
    return this.operations.delete(table, id);
  }

  /**
   * Execute bulk update operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeBulkUpdate(
    table: TableWithId,
    ids: string[],
    data: Partial<InferSelectModelFromFilteredSchema<TSchema>>
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>[]> {
    return this.operations.bulkUpdate(table, ids, data);
  }

  /**
   * Execute bulk delete operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeBulkDelete(
    table: TableWithId,
    ids: string[]
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>[]> {
    return this.operations.bulkDelete(table, ids);
  }

  /**
   * Fetch data with filtering, sorting, and pagination.
   *
   * This is the main method for retrieving data from the database. It handles:
   * - Determining the appropriate primary table
   * - Query result caching for performance
   * - Building optimized SQL queries with smart joins
   * - Transforming flat SQL results to nested structures
   * - Applying filters, sorting, and pagination
   * - Returning metadata about the query execution
   *
   * @description
   * Executes a complete query pipeline including:
   * 1. Cache lookup (if enabled)
   * 2. Query context building
   * 3. SQL query generation
   * 4. Data transformation
   * 5. Result caching
   *
   * @param {FetchDataParams} params - Query parameters
   * @param {string[]} [params.columns] - Column identifiers to fetch (e.g., ['email', 'profile.bio'])
   * @param {FilterState[]} [params.filters] - Filter conditions to apply
   * @param {SortingParams[]} [params.sorting] - Sort configurations
   * @param {PaginationParams} [params.pagination] - Pagination settings (page, limit)
   * @returns {Promise<FetchDataResult>} Query result with data, total count, and metadata
   *
   * @throws {QueryError} If the query execution fails
   * @throws {SchemaError} If the schema is invalid or tables are missing
   *
   * @example
   * ```typescript
   * const result = await adapter.fetchData({
   *   columns: ['id', 'email', 'name', 'profile.bio'],
   *   filters: [
   *     { columnId: 'email', operator: 'contains', values: ['@example.com'] }
   *   ],
   *   sorting: [{ columnId: 'id', direction: 'desc' }],
   *   pagination: { page: 1, limit: 10 }
   * });
   *
   * console.log(result.data); // Array of nested objects
   * console.log(result.total); // Total matching records
   * console.log(result.pagination); // Pagination info
   * ```
   *
   * @since 1.0.0
   */
  async fetchData(
    params: FetchDataParams
  ): Promise<FetchDataResult<InferSelectModelFromFilteredSchema<TSchema>>> {
    const startTime = Date.now();

    // Resolved before the try block so a multi-table-ambiguity SchemaError
    // surfaces to the caller as-is, rather than being wrapped in a
    // QueryError below (same reasoning as resolveMutationTable's callers).
    const primaryTable = this.resolvePrimaryTableForRead(params.columns, params.primaryTable);

    try {
      // Get computed fields for this table
      const tableComputedFields = this.computedFields[primaryTable] || [];

      // Filter out computed fields from columns and track which ones were requested
      const requestedComputedFields: ComputedFieldConfig[] = [];
      const columnsToFetch: string[] = []; // Track columns that need to be fetched for computed fields

      // If no columns specified (undefined or empty array), include computed fields with includeByDefault: true
      // Flow: columnsToProcess -> columnsWithoutComputed -> finalColumns
      // This ensures computed fields marked with includeByDefault are automatically included
      // when the frontend doesn't explicitly request specific columns.
      // Note: Both undefined and [] (empty array) are treated as "no columns specified"
      // Use spread operator to avoid mutating the input parameter
      const columnsToProcess = params.columns ? [...params.columns] : [];
      if (columnsToProcess.length === 0) {
        // Include computed fields that should be included by default
        // These will be processed like regular columns and added to finalColumns
        for (const computedField of tableComputedFields) {
          if (computedField.includeByDefault === true) {
            columnsToProcess.push(computedField.field);
          }
        }
      }

      // Filter out computed fields from the column list (they're handled separately)
      // But keep columns that computed fields require (requiresColumn: true)
      const columnsWithoutComputed = columnsToProcess.filter((col) => {
        const isComputed = tableComputedFields.some((cf) => cf.field === col);
        if (isComputed) {
          const computedField = tableComputedFields.find((cf) => cf.field === col);
          if (computedField) {
            requestedComputedFields.push(computedField);
            // If computed field requires the underlying column, include it in the SELECT
            if (computedField.requiresColumn) {
              columnsToFetch.push(col);
            }
          }
          // Only filter out if it doesn't require the column
          return computedField?.requiresColumn === true;
        }
        return true;
      });

      // Merge columns that need to be fetched for computed fields
      const finalColumns = [...columnsWithoutComputed, ...columnsToFetch];

      // Handle computed field filtering. `params.filters` may be a flat
      // FilterState[] (implicit AND) or a FilterGroupNode tree (plan 017);
      // normalizeIncomingFilters validates/normalizes a tree at this public
      // API boundary (depth cap, dropping malformed nodes) and leaves a flat
      // array untouched. Computed-field filter substitution below only
      // understands the flat shape (computed fields are not real columns, so
      // matching/replacing them inside an arbitrary AND/OR tree is out of
      // scope for this plan) — it's skipped entirely when filters is a tree.
      let processedFilters: FilterState[] | FilterGroupNode =
        this.normalizeIncomingFilters(params.filters) ?? [];
      const computedFieldFilters: Array<{ filter: FilterState; config: ComputedFieldConfig }> = [];
      const additionalSqlConditions: (SQL | SQLWrapper)[] = [];

      if (Array.isArray(processedFilters)) {
        for (const filter of processedFilters) {
          const computedField = tableComputedFields.find((cf) => cf.field === filter.columnId);
          if (computedField?.filter || computedField?.filterSql) {
            computedFieldFilters.push({ filter, config: computedField });
          }
        }
      } else {
        this.rejectComputedFieldFiltersInTree(processedFilters, tableComputedFields);
      }

      // Build cache params early (needed for error handling)
      // Include computed fields in cache key to prevent cache collisions
      // IMPORTANT: Include original computed field filters in cache key before they're processed
      // This ensures different filterSql conditions produce different cache keys
      const originalComputedFieldFilters = computedFieldFilters.map(({ filter }) => filter);
      const cacheParams: FetchDataParams & {
        computedFields?: string[];
        computedFieldsRequiringColumns?: string[];
        computedFieldFilters?: FilterState[]; // Include original filters for cache key
      } = {
        ...params,
        columns: columnsWithoutComputed,
        filters: processedFilters,
        computedFields: requestedComputedFields.map((cf) => cf.field),
        computedFieldsRequiringColumns: requestedComputedFields
          .filter((cf) => cf.requiresColumn)
          .map((cf) => cf.field),
        computedFieldFilters: originalComputedFieldFilters, // Include for cache key
      };

      // Process computed field filters
      if (computedFieldFilters.length > 0) {
        const context: ComputedFieldContext<TSchema, TDriver> = {
          primaryTable,
          allRows: [],
          db: this.db,
          schema: this.schema,
        };

        const replacementFilters: FilterState[] = [];
        for (const { filter, config } of computedFieldFilters) {
          try {
            // Prefer filterSql over filter for better performance (applied before pagination)
            if (config.filterSql) {
              const sqlCondition = await Promise.resolve(config.filterSql(filter, context));
              additionalSqlConditions.push(sqlCondition);
            } else if (config.filter) {
              const replacements = await Promise.resolve(config.filter(filter, context));
              replacementFilters.push(...replacements);
            }
          } catch {
            // If filter transformation fails, return empty result
            const emptyPagination = params.pagination
              ? {
                  page: params.pagination.page,
                  limit: params.pagination.limit,
                  totalPages: 0,
                  hasNext: false,
                  hasPrev: params.pagination.page > 1,
                }
              : {
                  page: 1,
                  limit: 10,
                  totalPages: 0,
                  hasNext: false,
                  hasPrev: false,
                };
            return {
              data: [],
              total: 0,
              pagination: emptyPagination,
              meta: {
                cached: false,
                executionTime: Date.now() - startTime,
                joinCount: this.getJoinCount(cacheParams),
              },
            };
          }
        }

        // Remove computed field filters and add replacements. Only reached
        // when processedFilters is a flat array (computedFieldFilters is
        // only ever populated in that branch above).
        if (Array.isArray(processedFilters)) {
          processedFilters = processedFilters
            .filter((f) => !computedFieldFilters.some((cff) => cff.filter === f))
            .concat(replacementFilters);
        }

        // Update cache params with processed filters
        cacheParams.filters = processedFilters;
        // Note: computedFieldFilters are already in cache key (set above before processing)
        // This ensures different filter values produce different cache keys even when using filterSql
      }
      const cacheKey = this.cache.getKey(cacheParams);
      const cached = this.cache.get(cacheKey);

      if (cached && !this.cache.isExpired(cacheKey)) {
        // Mark as cached and add computed fields
        const resultWithComputed = await this.addComputedFields(
          cached,
          requestedComputedFields,
          primaryTable
        );
        return {
          ...resultWithComputed,
          meta: {
            ...resultWithComputed.meta,
            cached: true,
            joinCount: this.getJoinCount(cacheParams),
          },
        };
      }

      // Resolve sortSql expressions for computed fields that are being sorted
      const computedFieldsForSorting: Record<string, ComputedFieldWithResolvedSortSql> = {};
      if (params.sorting && params.sorting.length > 0) {
        const context: ComputedFieldContext<TSchema, TDriver> = {
          primaryTable,
          allRows: [],
          db: this.db,
          schema: this.schema,
        };

        for (const sort of params.sorting) {
          const computedField = tableComputedFields.find((cf) => cf.field === sort.columnId);
          if (computedField?.sortSql) {
            try {
              // Resolve sortSql expression (handle both sync and async)
              const sqlExpression = computedField.sortSql(context);
              const resolvedExpression =
                sqlExpression instanceof Promise ? await sqlExpression : sqlExpression;

              // Validate that sortSql returned a valid SQL expression
              if (!resolvedExpression) {
                throw new QueryError(
                  `sortSql returned null or undefined for computed field: ${sort.columnId}`,
                  { columnId: sort.columnId, field: computedField.field }
                );
              }

              computedFieldsForSorting[sort.columnId] = {
                ...computedField,
                __resolvedSortSql: resolvedExpression,
              };
            } catch (error) {
              // Re-throw QueryError as-is (already has proper context)
              if (error instanceof QueryError) {
                throw error;
              }
              // Wrap other errors with context
              throw new QueryError(
                `Failed to resolve sortSql for computed field: ${sort.columnId}`,
                {
                  columnId: sort.columnId,
                  field: computedField.field,
                  originalError: error instanceof Error ? error.message : String(error),
                }
              );
            }
          }
        }
      }

      // A sort naming a registered computed field WITHOUT sortSql has nothing
      // to ORDER BY in SQL, and must not leak into join planning as if it were
      // a relational column path (resolveColumnPath would throw on it). Drop
      // it loudly — value-free, mirroring the dropped-filter warning.
      const sortingForQuery = (params.sorting || []).filter((sort) => {
        const computedField = tableComputedFields.find((cf) => cf.field === sort.columnId);
        if (computedField && !computedField.sortSql) {
          // biome-ignore lint/suspicious/noConsole: intentional warning for a dropped computed-field sort
          console.warn(
            `[better-tables] Dropped sort on computed field "${sort.columnId}": it has no sortSql, so it cannot be sorted in SQL. Provide sortSql on the computed field to make it sortable.`
          );
          return false;
        }
        return true;
      });

      // Build queries - pass primaryTable to query builder
      // Include columns that computed fields require (e.g., roles column for enum array filtering)
      // Pass additional SQL conditions from computed field filterSql (applied before pagination)
      const queryParams: Parameters<typeof this.queryBuilder.buildCompleteQuery>[0] = {
        columns: finalColumns,
        filters: processedFilters,
        sorting: sortingForQuery,
        pagination: params.pagination || { page: 1, limit: 10 },
        primaryTable,
      };
      if (additionalSqlConditions.length > 0) {
        queryParams.additionalConditions = additionalSqlConditions;
      }
      if (Object.keys(computedFieldsForSorting).length > 0) {
        queryParams.computedFields = computedFieldsForSorting;
      }
      const { dataQuery, countQuery, columnMetadata, isNested, autoEmbedColumns } =
        this.queryBuilder.buildCompleteQuery(queryParams);

      // Execute queries in parallel
      const [data, countResult] = await Promise.all([dataQuery.execute(), countQuery.execute()]);

      const total = (countResult[0] as { count: number } | undefined)?.count || 0;

      // Transform data to nested structure - pass primaryTable to transformer
      // If data is already nested from relational query, transformer will detect and handle accordingly
      const transformerMetadata: {
        selections: Record<string, unknown>;
        columnMapping: Record<string, string>;
        isNested?: boolean;
      } = {
        selections: columnMetadata.selections as Record<string, unknown>,
        columnMapping: columnMetadata.columnMapping,
      };
      if (isNested !== undefined) {
        transformerMetadata.isNested = isNested;
      }
      // Auto-embed (plan 030, finding 10): a relation the query builder
      // selected because filters/sorting referenced it (not because it was
      // in `columns`) needs the SAME synthetic columns fed to the
      // transformer, or transformToNested's `columns.length > 0` branch
      // (data-transformer.ts) would ignore the joined data it isn't told
      // about and drop the relation from the result rows.
      const columnsForTransform =
        autoEmbedColumns.length > 0
          ? [...columnsWithoutComputed, ...autoEmbedColumns]
          : columnsWithoutComputed;
      const transformedData = this.dataTransformer.transformToNested<
        InferSelectModelFromFilteredSchema<TSchema>
      >(data, primaryTable, columnsForTransform, transformerMetadata);

      // Build pagination info
      const paginationInfo = params.pagination
        ? {
            page: params.pagination.page,
            limit: params.pagination.limit,
            totalPages: Math.ceil(Number(total) / params.pagination.limit),
            hasNext: params.pagination.page * params.pagination.limit < Number(total),
            hasPrev: params.pagination.page > 1,
          }
        : {
            page: 1,
            limit: Number(total),
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          };

      // Add computed fields to results
      const dataWithComputed = await this.addComputedFields(
        {
          data: transformedData,
          total: Number(total),
          pagination: paginationInfo,
          meta: {
            cached: false,
            executionTime: Date.now() - startTime,
            joinCount: this.getJoinCount(cacheParams),
          },
        },
        requestedComputedFields,
        primaryTable
      );

      // Build result
      const result: FetchDataResult<InferSelectModelFromFilteredSchema<TSchema>> = {
        data: dataWithComputed.data,
        total: dataWithComputed.total,
        pagination: dataWithComputed.pagination,
        meta: dataWithComputed.meta || {},
      };

      // Cache result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      throw new QueryError(
        `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { params, error }
      );
    }
  }

  /**
   * Get the caller's active `filters` (if any), normalized and with every
   * leaf targeting `columnId` pruned out -- the self-exclusion convention
   * `FacetQueryParams` documents (plan 021, ADAPTER-06): a facet for a
   * column must never have its own active filter applied against it.
   * Shared by all three facet methods below.
   *
   * @private
   */
  private buildFacetFilters(
    columnId: string,
    params: FacetQueryParams | undefined
  ): FilterState[] | FilterGroupNode | undefined {
    const normalized = this.normalizeIncomingFilters(params?.filters);
    return pruneFilterNodeForColumn(normalized, columnId);
  }

  /**
   * Get available filter options for a column
   */
  async getFilterOptions(columnId: string, params?: FacetQueryParams): Promise<FilterOption[]> {
    // Resolved before the try block so a SchemaError (e.g. no table has a
    // matching column) surfaces as-is instead of being wrapped below.
    const primaryTable = this.resolvePrimaryTableForRead([columnId]);
    try {
      const facetFilters = this.buildFacetFilters(columnId, params);
      const query = this.queryBuilder.buildFilterOptionsQuery(
        columnId,
        primaryTable,
        facetFilters,
        params?.limit
      );
      const results = await query.execute();

      return results.map((row: Record<string, unknown>) => ({
        value: String(row.value),
        label: String(row.value),
        count: Number(row.count),
      }));
    } catch (error) {
      throw new QueryError(
        `Failed to get filter options for column ${columnId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { columnId, error }
      );
    }
  }

  /**
   * Get faceted values for a column
   */
  async getFacetedValues(
    columnId: string,
    params?: FacetQueryParams
  ): Promise<Map<string, number>> {
    // Resolved before the try block so a SchemaError (e.g. no table has a
    // matching column) surfaces as-is instead of being wrapped below.
    const primaryTable = this.resolvePrimaryTableForRead([columnId]);
    try {
      const facetFilters = this.buildFacetFilters(columnId, params);
      const query = this.queryBuilder.buildAggregateQuery(
        columnId,
        'count',
        primaryTable,
        facetFilters,
        params?.limit
      );
      const results = await query.execute();

      const facetMap = new Map<string, number>();
      for (const row of results) {
        const record = row as { value: unknown; count: number };
        const value = String(record.value);
        facetMap.set(value, record.count);
      }

      return facetMap;
    } catch (error) {
      throw new QueryError(
        `Failed to get faceted values for column ${columnId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { columnId, error }
      );
    }
  }

  /**
   * Get min/max values for number columns
   */
  async getMinMaxValues(columnId: string, params?: FacetQueryParams): Promise<[number, number]> {
    // Resolved before the try block so a SchemaError (e.g. no table has a
    // matching column) surfaces as-is instead of being wrapped below.
    const primaryTable = this.resolvePrimaryTableForRead([columnId]);
    try {
      const facetFilters = this.buildFacetFilters(columnId, params);
      const query = this.queryBuilder.buildMinMaxQuery(columnId, primaryTable, facetFilters);
      const results = await query.execute();
      const result = results[0] as { min: number | null; max: number | null } | undefined;

      return [
        result?.min !== null && result?.min !== undefined ? Number(result.min) : 0,
        result?.max !== null && result?.max !== undefined ? Number(result.max) : 0,
      ];
    } catch (error) {
      throw new QueryError(
        `Failed to get min/max values for column ${columnId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { columnId, error }
      );
    }
  }

  /**
   * Describe a table's columns from the Drizzle schema — powers auto column
   * inference (`t.auto()` / no-factory `define`, plan 054).
   *
   * Pure schema introspection: no query is executed, so this is safe to call
   * without a live connection. `table` follows the same resolution as the
   * other read entry points ({@link resolvePrimaryTableForRead}): an explicit
   * table is validated against the schema; when omitted, single-table
   * schemas stay zero-config and multi-table schemas fall back to
   * `options.defaultPrimaryTable` or throw a `SchemaError`.
   *
   * Results are memoized per table object ({@link describeTableColumns}'s
   * WeakMap, mirroring plan 040's caches).
   */
  async describeColumns(table?: string): Promise<InferredColumnSpec[]> {
    const primaryTable = this.resolvePrimaryTableForRead(undefined, table);
    const tableSchema = (this.schema as Record<string, AnyTableType>)[primaryTable];
    if (!tableSchema) {
      throw new SchemaError(`Table '${primaryTable}' is not present in the schema`, {
        table: primaryTable,
        availableTables: Object.keys(this.schema),
      });
    }
    return describeTableColumns(tableSchema);
  }

  /** Memoized {@link resolveCellWriteTarget} results per `${table}:${columnId}`. */
  private cellWriteTargetCache = new Map<string, CellWriteTarget | null>();

  /**
   * Resolve where a cell edit for `columnId` actually lands (plan 055) —
   * pure schema/relationship introspection, no query.
   *
   * - Flat id → own-table field; `writable` from the schema (PK → false).
   * - Relationship path (`'customer.company'`) → the REAL related table
   *   (from the relationship path's last hop `to`, not the alias), with
   *   `relatedIdPath` addressing the related row's PK through the ALIAS
   *   path in row data (`'customer.id'`) and `single` false when any hop is
   *   one-to-many.
   * - `null` for anything a single-cell write can't express: unknown ids,
   *   JSON accessors (`'survey.title'` where `survey` is a JSON column),
   *   bare relation aliases, composite related PKs.
   */
  async resolveCellWriteTarget(columnId: string, table?: string): Promise<CellWriteTarget | null> {
    const primaryTable = this.resolvePrimaryTableForRead(undefined, table);
    const cacheKey = `${primaryTable}:${columnId}`;
    const cached = this.cellWriteTargetCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const target = this.resolveCellWriteTargetUncached(columnId, primaryTable);
    this.cellWriteTargetCache.set(cacheKey, target);
    return target;
  }

  /** @private Uncached body of {@link resolveCellWriteTarget}. */
  private resolveCellWriteTargetUncached(
    columnId: string,
    primaryTable: string
  ): CellWriteTarget | null {
    let path: ReturnType<RelationshipManager['resolveColumnPath']>;
    try {
      path = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    } catch {
      return null;
    }

    const schema = this.schema as Record<string, AnyTableType>;

    if (!path.isNested) {
      // A dotted id resolving to a NON-nested path is a JSON accessor
      // ('survey.title' → field 'survey') — a cell write can't express a
      // JSON sub-field update.
      if (columnId.includes('.')) {
        return null;
      }
      const ownSchema = schema[primaryTable];
      if (!ownSchema) return null;
      const info = getColumnInfo(ownSchema, path.field);
      return {
        table: primaryTable,
        field: path.field,
        relatedIdPath: null,
        single: true,
        writable: info ? !info.isPrimaryKey : false,
      };
    }

    // Bare relation alias ('customer') — nothing to write.
    if (!path.field) {
      return null;
    }

    const hops = path.relationshipPath ?? [];
    const realTable = hops[hops.length - 1]?.to;
    if (!realTable) return null;
    const relatedSchema = schema[realTable];
    if (!relatedSchema) return null;

    const primaryKeys = getPrimaryKeyColumns(relatedSchema);
    const pkName = primaryKeys[0]?.name;
    // Composite related PKs are unsupported for cell writes (v1) — the
    // target row can't be addressed by a single id.
    if (!pkName || primaryKeys.length > 1) {
      return null;
    }

    const fieldInfo = getColumnInfo(relatedSchema, path.field);
    // The alias path in ROW DATA (nested objects are keyed by alias, not by
    // the real table name): 'customer.company' → 'customer.id'.
    const aliasPath = columnId.split('.').slice(0, -1).join('.');

    return {
      table: realTable,
      field: path.field,
      relatedIdPath: `${aliasPath}.${pkName}`,
      single: hops.every((hop) => hop.cardinality === 'one'),
      writable: fieldInfo ? !fieldInfo.isPrimaryKey : false,
    };
  }

  /**
   * Resolve the primary table for a READ entry point (fetchData,
   * getFilterOptions, getFacetedValues, getMinMaxValues, getJoinCount).
   *
   * Mirrors {@link resolveMutationTable}'s throw precedent for reads: when the schema has more than one table and neither
   * `columns`, a per-call `primaryTable`, nor `options.defaultPrimaryTable`
   * disambiguates which table to query, silently assuming "the first
   * table" would return plausible-but-wrong rows (plan 029 finding 9).
   * Throw instead.
   *
   * Single-table schemas remain zero-config (identical to
   * `resolveMutationTable`). `PrimaryTableResolver.resolve`'s own
   * no-columns `warnAssumedTable` fallback (plan 022) is intentionally left
   * in place for callers that don't go through this method — see plan 030
   * Step 2's decision to fix at the read entry points rather than inside
   * the shared resolver.
   *
   * @private
   * @throws {SchemaError} If the schema has multiple tables and neither
   *   `columns` nor an effective `primaryTable` (per-call, then
   *   `options.defaultPrimaryTable`) disambiguates, or if the resolved
   *   explicit table / matched columns don't resolve (delegated to
   *   {@link PrimaryTableResolver.resolve}).
   */
  private resolvePrimaryTableForRead(columns?: string[], explicitPrimaryTable?: string): string {
    // An explicit per-call `primaryTable`, or non-empty `columns`, already
    // disambiguates (or the resolver throws its own, more specific error --
    // e.g. an unknown explicit table, or a zero-column-match typo). Let
    // that existing behavior run unmodified; `defaultPrimaryTable` must not
    // override a real column-based match.
    if (explicitPrimaryTable || (columns && columns.length > 0)) {
      return this.primaryTableResolver.resolve(columns, explicitPrimaryTable);
    }

    // No columns and no per-call primaryTable: fall back to the adapter's
    // configured default, if any.
    if (this.options?.defaultPrimaryTable) {
      return this.primaryTableResolver.resolve(undefined, this.options.defaultPrimaryTable);
    }

    // No signal at all. Single-table schemas stay zero-config; multi-table
    // schemas must not silently assume "the first table" (plan 029 finding
    // 9) -- throw instead of delegating to the resolver's warn-only
    // `getFirstTable()` fallback.
    const tableNames = Object.keys(this.schema);
    if (tableNames.length > 1) {
      throw new SchemaError(
        "Multiple tables in schema — set 'primaryTable' (per call), 'defaultPrimaryTable' " +
          "(in drizzleAdapter options), or pass 'columns' that disambiguate, to select which " +
          'table to query',
        { availableTables: tableNames }
      );
    }
    return this.primaryTableResolver.resolve(columns, explicitPrimaryTable);
  }

  /**
   * Resolve which table a record mutation (create/update/delete/bulk) should
   * target.
   *
   * Mutation methods carry no per-call table hint, so routing must be
   * explicit rather than inferred from data shape (inference invites silent
   * wrong-table writes). Resolution order:
   *
   * 1. `options.defaultMutationTable`, if set — validated against the schema.
   * 2. The schema's single table, if the schema has exactly one table.
   * 3. Otherwise, throw — the caller must configure `defaultMutationTable`.
   *
   * @private
   * @throws {SchemaError} If `defaultMutationTable` names a table absent from
   *   the schema, or if the schema has multiple tables and no
   *   `defaultMutationTable` is configured.
   */
  private resolveMutationTable(explicitTable?: string): string {
    const tableNames = Object.keys(this.schema);
    if (tableNames.length === 0) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }

    // Per-call target from the instance write surface (plan 047) wins.
    if (explicitTable !== undefined) {
      if (!tableNames.includes(explicitTable)) {
        throw new SchemaError(`Mutation table '${explicitTable}' is not present in the schema`, {
          table: explicitTable,
          availableTables: tableNames,
        });
      }
      return explicitTable;
    }

    const configuredTable = this.options?.defaultMutationTable;
    if (configuredTable !== undefined) {
      if (!tableNames.includes(configuredTable)) {
        throw new SchemaError(
          `defaultMutationTable '${configuredTable}' is not present in the schema`,
          { defaultMutationTable: configuredTable, availableTables: tableNames }
        );
      }
      return configuredTable;
    }

    if (tableNames.length === 1) {
      // Single-table schemas are unambiguous - no configuration required.
      return tableNames[0] as string;
    }

    throw new SchemaError(
      "Multiple tables in schema — set 'defaultMutationTable' in drizzleAdapter options to enable create/update/delete",
      { availableTables: tableNames }
    );
  }

  /**
   * Whether {@link resolveMutationTable} would succeed for this adapter
   * instance, without throwing. Used to advertise mutation capability in
   * {@link AdapterMeta.features} so UI layers don't render actions that
   * would throw at call time.
   *
   * @private
   */
  private canResolveMutationTable(): boolean {
    try {
      this.resolveMutationTable();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create new record
   */
  async createRecord(
    data: Partial<InferSelectModelFromFilteredSchema<TSchema>>,
    options?: { table?: string }
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>> {
    // Resolved before the try block so routing failures surface as SchemaError
    // rather than being wrapped in a QueryError below.
    const primaryTable = this.resolveMutationTable(options?.table);
    try {
      const mainTableSchema = (this.schema as Record<string, AnyTableType>)[
        primaryTable
      ] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const result = await this.executeInsert(mainTableSchema, data);

      this.emit({ type: 'insert', data: result });
      this.cache.invalidate();

      return result;
    } catch (error) {
      throw new QueryError(
        `Failed to create record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { data, error }
      );
    }
  }

  /**
   * Update existing record
   */
  async updateRecord(
    id: string,
    data: Partial<InferSelectModelFromFilteredSchema<TSchema>>,
    options?: { table?: string }
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>> {
    // Resolved before the try block so routing failures surface as SchemaError
    // rather than being wrapped in a QueryError below.
    const primaryTable = this.resolveMutationTable(options?.table);
    try {
      const mainTableSchema = (this.schema as Record<string, AnyTableType>)[
        primaryTable
      ] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const result = await this.executeUpdate(mainTableSchema, id, data);

      this.emit({ type: 'update', data: result });
      this.cache.invalidate();

      return result;
    } catch (error) {
      throw new QueryError(
        `Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id, data, error }
      );
    }
  }

  /**
   * Delete record
   */
  async deleteRecord(id: string, options?: { table?: string }): Promise<void> {
    // Resolved before the try block so routing failures surface as SchemaError
    // rather than being wrapped in a QueryError below.
    const primaryTable = this.resolveMutationTable(options?.table);
    try {
      const mainTableSchema = (this.schema as Record<string, AnyTableType>)[primaryTable] as
        | TableWithId
        | undefined;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const result = await this.executeDelete(mainTableSchema, id);

      this.emit({ type: 'delete', data: result });
      this.cache.invalidate();
    } catch (error) {
      throw new QueryError(
        `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id, error }
      );
    }
  }

  /**
   * Bulk update records
   */
  async bulkUpdate(
    ids: string[],
    data: Partial<InferSelectModelFromFilteredSchema<TSchema>>
  ): Promise<InferSelectModelFromFilteredSchema<TSchema>[]> {
    // Resolved before the try block so routing failures surface as SchemaError
    // rather than being wrapped in a QueryError below.
    const primaryTable = this.resolveMutationTable();
    try {
      const mainTableSchema = (this.schema as Record<string, AnyTableType>)[
        primaryTable
      ] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const results = await this.executeBulkUpdate(mainTableSchema, ids, data);

      this.emit({ type: 'update', data: results });
      this.cache.invalidate();

      return results;
    } catch (error) {
      throw new QueryError(
        `Failed to bulk update records: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { ids, data, error }
      );
    }
  }

  /**
   * Bulk delete records
   */
  async bulkDelete(ids: string[]): Promise<void> {
    // Resolved before the try block so routing failures surface as SchemaError
    // rather than being wrapped in a QueryError below.
    const primaryTable = this.resolveMutationTable();
    try {
      const mainTableSchema = (this.schema as Record<string, AnyTableType>)[primaryTable] as
        | TableWithId
        | undefined;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const results = await this.executeBulkDelete(mainTableSchema, ids);

      this.emit({ type: 'delete', data: results });
      this.cache.invalidate();
    } catch (error) {
      throw new QueryError(
        `Failed to bulk delete records: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { ids, error }
      );
    }
  }

  /**
   * Export data
   */
  async exportData(params: ExportParams): Promise<ExportResult> {
    // Resolve pre-conditions BEFORE the try so this surfaces as its own error
    // type instead of being re-wrapped with the generic "Failed to export
    // data:" prefix by the catch below (mirrors `deleteRecord`).
    if (params.ids && params.ids.length > 0) {
      // Selected-row export isn't implemented — reject rather than silently
      // ignoring `ids` and returning the whole (filtered) view.
      throw new QueryError('Exporting specific record ids is not supported.', { params });
    }
    try {
      // Fetch the rows to export, HONORING the caller's current view: filters
      // and sorting flow through so an export matches what the user sees. The
      // page size is bounded (`maxRows`, default `DEFAULT_EXPORT_ROW_CAP`) so an
      // "export all" on a large table can't pull an unbounded set into memory.
      const limit = params.maxRows ?? DEFAULT_EXPORT_ROW_CAP;
      const fetchParams: FetchDataParams = {
        columns: params.columns || [],
        filters: params.filters ?? [],
        sorting: params.sorting ?? [],
        pagination: { page: 1, limit },
      };

      const result = await this.fetchData(fetchParams);

      // Convert to export format
      const exportData = convertToExportFormat(
        result.data as Record<string, unknown>[],
        params.format
      );

      return {
        data: exportData,
        filename: `export.${params.format}`,
        mimeType: getMimeType(params.format),
      };
    } catch (error) {
      throw new QueryError(
        `Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { params, error }
      );
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(
    callback: (event: DataEvent<InferSelectModelFromFilteredSchema<TSchema>>) => void
  ): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Add computed fields to result data
   */
  private async addComputedFields(
    result: FetchDataResult<InferSelectModelFromFilteredSchema<TSchema>>,
    computedFields: ComputedFieldConfig[],
    primaryTable: string
  ): Promise<FetchDataResult<InferSelectModelFromFilteredSchema<TSchema>>> {
    if (computedFields.length === 0 || result.data.length === 0) {
      return result;
    }

    const context: ComputedFieldContext<TSchema, TDriver> = {
      primaryTable,
      allRows: result.data,
      db: this.db,
      schema: this.schema,
    };

    // Compute fields for all rows
    const dataWithComputed = await Promise.all(
      result.data.map(async (row) => {
        const rowWithComputed = { ...row } as Record<string, unknown>;
        for (const computedField of computedFields) {
          try {
            const value = await Promise.resolve(computedField.compute(row, context));
            rowWithComputed[computedField.field] = value;
          } catch {
            // If computation fails, set to undefined
            rowWithComputed[computedField.field] = undefined;
          }
        }
        return rowWithComputed;
      })
    );

    return {
      data: dataWithComputed as InferSelectModelFromFilteredSchema<TSchema>[],
      total: result.total,
      pagination: result.pagination,
      meta: result.meta || {},
    };
  }

  /** Test/introspection helper — current in-memory cache entry count. */
  getCacheSizeForTests(): number {
    return this.cache.getSizeForTests();
  }

  /**
   * Event system
   */
  private emit(event: DataEvent<InferSelectModelFromFilteredSchema<TSchema>>): void {
    this.subscribers.forEach((callback) => {
      callback(event);
    });
  }

  /**
   * Utility methods
   */

  /**
   * Computed-field filter substitution (plan 017) only runs on flat
   * `FilterState[]` inputs. Filter trees must fail loudly until the
   * computed-fields owner extends substitution to walk `FilterGroupNode`
   * trees (plan 051 — documented, not implemented here).
   */
  private rejectComputedFieldFiltersInTree(
    node: FilterGroupNode,
    tableComputedFields: ComputedFieldConfig[]
  ): void {
    for (const child of node.children) {
      if (isFilterGroupNode(child)) {
        this.rejectComputedFieldFiltersInTree(child, tableComputedFields);
        continue;
      }

      const computedField = tableComputedFields.find((cf) => cf.field === child.columnId);
      if (computedField?.filter || computedField?.filterSql) {
        throw new QueryError(
          `Computed-field filters inside a FilterGroupNode are not supported yet (columnId: "${child.columnId}"). Use a flat FilterState[] (implicit AND) for computed-field filters, or flatten the tree at the call site.`,
          { columnId: child.columnId, field: computedField.field }
        );
      }
    }
  }

  /**
   * Depth of a {@link FilterNode}'s group nesting: a leaf is depth 0; a group
   * whose children are all leaves is depth 1; each further level of nested
   * groups adds 1. Mirrors the depth-counting convention core's own
   * `isFilterNodeShape`/`normalizeFilterNode` use (`utils/type-guards.ts`,
   * design §1.2 -- root group is depth 1, one nested group is depth 2, ...).
   *
   * Used by {@link normalizeIncomingFilters} to detect an over-deep tree on
   * the RAW input, before `normalizeFilterNode` would otherwise silently
   * prune it -- see that method's docs for why a loud reject beats a silent
   * drop here.
   */
  private computeGroupDepth(node: FilterNode): number {
    if (!isFilterGroupNode(node) || !Array.isArray(node.children)) {
      return 0;
    }
    let maxChildDepth = 0;
    for (const child of node.children) {
      const childDepth = this.computeGroupDepth(child);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
    return 1 + maxChildDepth;
  }

  /**
   * Validate and normalize the widened `FetchDataParams.filters`
   * (`FilterState[] | FilterGroupNode`, contract v2,
   * `plans/design/core-contract-v2.md` §1.5) at this public API boundary
   * (plan 017).
   *
   * @description
   * `fetchData` is called directly by callers with unnormalized trees --
   * core's URL-boundary normalization (`normalizeFilterNode` in
   * `FilterManager`/`TableStateManager`) does not run for programmatic API
   * calls. Two failure modes need defense in depth, not the same treatment:
   *
   * - **Over-deep nesting** (beyond this adapter's advertised
   *   `maxGroupDepth`): core's own `normalizeFilterNode` would silently PRUNE
   *   the over-deep subtree, changing the result set with no signal. That's
   *   the right call for untrusted URL input (design §1.4's fail-closed
   *   table), but wrong for a public API boundary the caller controls
   *   directly -- so depth is checked FIRST, on the raw tree, and rejected
   *   loudly with a `QueryError` naming the cap.
   * - **Everything else `normalizeFilterNode` handles** (unknown `logic`,
   *   non-array `children`, invalid leaves, empty/single-child groups):
   *   delegated to core's normalization unchanged, once depth is known to be
   *   within bounds.
   *
   * A flat `FilterState[]` (or `undefined`) is returned unchanged -- it
   * can't violate depth (no nesting) and fetchData never normalized flat
   * arrays before this plan either.
   *
   * @throws {QueryError} If a `FilterGroupNode` tree nests deeper than
   *   `meta.maxGroupDepth`
   */
  private normalizeIncomingFilters(
    filters: FetchDataParams['filters']
  ): FilterState[] | FilterGroupNode | undefined {
    if (filters === undefined || Array.isArray(filters)) {
      return filters;
    }

    const maxGroupDepth = this.meta.maxGroupDepth ?? 3;
    const depth = this.computeGroupDepth(filters);
    if (depth > maxGroupDepth) {
      throw new QueryError(
        `Filter group nesting depth ${depth} exceeds this adapter's maxGroupDepth of ${maxGroupDepth}`,
        { depth, maxGroupDepth }
      );
    }

    const normalized = normalizeFilterNode(filters);
    if (normalized === null) {
      return [];
    }
    return isFilterGroupNode(normalized) ? normalized : [normalized];
  }

  private getJoinCount(
    params: FetchDataParams & {
      computedFields?: string[];
      computedFieldsRequiringColumns?: string[];
      computedFieldFilters?: FilterState[];
    }
  ): number {
    // Determine primary table from params - use explicit if provided.
    // Routed through the same throwing helper as fetchData for defense in
    // depth; in practice this is always called downstream of fetchData's
    // own (already-validated) resolution, so this rarely fires here directly.
    const primaryTable = this.resolvePrimaryTableForRead(params.columns, params.primaryTable);

    // Filter out computed fields from columns and sorts before building query context
    // Computed fields are handled separately and shouldn't be resolved as column paths.
    // Union the REGISTERED fields with the requested list: `params.computedFields`
    // only names fields requested via `columns`, so a sort-only computed field
    // (e.g. sortSql-backed sorting with the field not displayed) would otherwise
    // leak into resolveColumnPath here and throw on a perfectly valid fetch.
    const registeredComputedFields = (this.computedFields[primaryTable] || []).map(
      (field) => field.field
    );
    const computedFieldNames = [...(params.computedFields || []), ...registeredComputedFields];
    const columnsForContext = (params.columns || []).filter(
      (col) => !computedFieldNames.includes(col)
    );
    const sortsForContext = (params.sorting || [])
      .filter((sort) => !computedFieldNames.includes(sort.columnId))
      .map((sort) => ({ columnId: sort.columnId }));

    // Flatten tree filters to leaves so a leaf nested inside a group still
    // contributes its JOIN to the count -- must agree with buildCompleteQuery's
    // own context (base-query-builder.ts), or `total` and page contents would
    // diverge under OR queries (plan 017 emphasis: count/data agreement).
    const context = this.relationshipManager.buildQueryContext(
      {
        columns: columnsForContext,
        filters: collectFilterLeaves(params.filters).map((filter) => ({
          columnId: filter.columnId,
        })),
        sorts: sortsForContext,
      },
      primaryTable
    );
    return context.joinPaths.size;
  }
}
