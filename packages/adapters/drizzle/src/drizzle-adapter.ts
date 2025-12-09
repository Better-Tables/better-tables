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

import type {
  AdapterFeatures,
  AdapterMeta,
  ColumnType,
  DataEvent,
  ExportParams,
  ExportResult,
  FetchDataParams,
  FetchDataResult,
  FilterOperator,
  FilterOption,
  FilterState,
  TableAdapter,
} from '@better-tables/core';
import type { InferSelectModel, Relations, SQL, SQLWrapper } from 'drizzle-orm';

import { DataTransformer } from './data-transformer';
import { getOperationsFactory } from './operations';
import { PrimaryTableResolver } from './primary-table-resolver';
import { type BaseQueryBuilder, getQueryBuilderFactory } from './query-builders';
import { RelationshipDetector } from './relationship-detector';
import { RelationshipManager } from './relationship-manager';
import type {
  AnyTableType,
  ComputedFieldConfig,
  ComputedFieldContext,
  DatabaseDriver,
  DatabaseOperations,
  DrizzleAdapterConfig,
  DrizzleDatabase,
  FilterHandlerHooks,
  RelationshipMap,
  TableWithId,
} from './types';
import { QueryError, SchemaError } from './types';

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
export class DrizzleAdapter<
  TSchema extends Record<string, AnyTableType>,
  TDriver extends DatabaseDriver,
> implements TableAdapter<InferSelectModel<TSchema[keyof TSchema]>>
{
  private db: DrizzleDatabase<TDriver>;
  private schema: TSchema;
  private operations: DatabaseOperations<InferSelectModel<TSchema[keyof TSchema]>>;
  private relationships: RelationshipMap;
  private relationshipDetector: RelationshipDetector;
  private relationshipManager: RelationshipManager;
  private primaryTableResolver: PrimaryTableResolver;
  private queryBuilder: BaseQueryBuilder;
  private dataTransformer: DataTransformer;
  private cache: Map<
    string,
    {
      value: FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>>;
      timestamp: number;
      ttl: number;
    }
  > = new Map();
  private subscribers: Array<(event: DataEvent<InferSelectModel<TSchema[keyof TSchema]>>) => void> =
    [];
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
    this.schema = config.schema;
    this.options = config.options || {};
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
    this.dataTransformer = new DataTransformer(this.schema, this.relationshipManager);

    // Initialize metadata
    this.meta = this.buildAdapterMeta(config.meta);
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
  ): DatabaseOperations<InferSelectModel<TSchema[keyof TSchema]>> {
    const createOperations = getOperationsFactory(driver);
    return createOperations<InferSelectModel<TSchema[keyof TSchema]>>(this.db);
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
    return createQueryBuilder(this.db, this.schema, this.relationshipManager, this.hooks);
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
    data: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>> {
    return this.operations.insert(table, data);
  }

  /**
   * Execute update operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeUpdate(
    table: TableWithId,
    id: string,
    data: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>> {
    return this.operations.update(table, id, data);
  }

  /**
   * Execute delete operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeDelete(
    table: TableWithId,
    id: string
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>> {
    return this.operations.delete(table, id);
  }

  /**
   * Execute bulk update operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeBulkUpdate(
    table: TableWithId,
    ids: string[],
    data: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>[]> {
    return this.operations.bulkUpdate(table, ids, data);
  }

  /**
   * Execute bulk delete operation - Strategy Pattern dispatcher.
   * @private
   */
  private async executeBulkDelete(
    table: TableWithId,
    ids: string[]
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>[]> {
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
  ): Promise<FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>>> {
    const startTime = Date.now();

    try {
      // Determine primary table - use explicit if provided, otherwise use resolver
      const primaryTable = this.primaryTableResolver.resolve(params.columns, params.primaryTable);

      // Get computed fields for this table
      const tableComputedFields = this.computedFields[primaryTable] || [];

      // Filter out computed fields from columns and track which ones were requested
      const requestedComputedFields: ComputedFieldConfig[] = [];
      const columnsToFetch: string[] = []; // Track columns that need to be fetched for computed fields
      const columnsWithoutComputed = (params.columns || []).filter((col) => {
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

      // Handle computed field filtering
      let processedFilters = [...(params.filters || [])];
      const computedFieldFilters: Array<{ filter: FilterState; config: ComputedFieldConfig }> = [];
      const additionalSqlConditions: (SQL | SQLWrapper)[] = [];

      for (const filter of processedFilters) {
        const computedField = tableComputedFields.find((cf) => cf.field === filter.columnId);
        if (computedField?.filter || computedField?.filterSql) {
          computedFieldFilters.push({ filter, config: computedField });
        }
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

        // Remove computed field filters and add replacements
        processedFilters = processedFilters.filter(
          (f) => !computedFieldFilters.some((cff) => cff.filter === f)
        );
        processedFilters.push(...replacementFilters);

        // Update cache params with processed filters
        cacheParams.filters = processedFilters;
        // Note: computedFieldFilters are already in cache key (set above before processing)
        // This ensures different filter values produce different cache keys even when using filterSql
      }
      const cacheKey = this.getCacheKey(cacheParams);
      const cached = this.getFromCache(cacheKey);

      if (cached && !this.isCacheExpired(cacheKey)) {
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

      // Build queries - pass primaryTable to query builder
      // Include columns that computed fields require (e.g., roles column for enum array filtering)
      // Pass additional SQL conditions from computed field filterSql (applied before pagination)
      const queryParams: Parameters<typeof this.queryBuilder.buildCompleteQuery>[0] = {
        columns: finalColumns,
        filters: processedFilters,
        sorting: params.sorting || [],
        pagination: params.pagination || { page: 1, limit: 10 },
        primaryTable,
      };
      if (additionalSqlConditions.length > 0) {
        queryParams.additionalConditions = additionalSqlConditions;
      }
      const { dataQuery, countQuery, columnMetadata, isNested } =
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
      const transformedData = this.dataTransformer.transformToNested<
        InferSelectModel<TSchema[keyof TSchema]>
      >(data, primaryTable, columnsWithoutComputed, transformerMetadata);

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
      const result: FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>> = {
        data: dataWithComputed.data,
        total: dataWithComputed.total,
        pagination: dataWithComputed.pagination,
        meta: dataWithComputed.meta || {},
      };

      // Cache result
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      throw new QueryError(
        `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { params, error }
      );
    }
  }

  /**
   * Get available filter options for a column
   */
  async getFilterOptions(columnId: string): Promise<FilterOption[]> {
    try {
      // Determine primary table from the column
      const primaryTable = this.primaryTableResolver.resolve([columnId]);
      const query = this.queryBuilder.buildFilterOptionsQuery(columnId, primaryTable);
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
  async getFacetedValues(columnId: string): Promise<Map<string, number>> {
    try {
      // Determine primary table from the column
      const primaryTable = this.primaryTableResolver.resolve([columnId]);
      const query = this.queryBuilder.buildAggregateQuery(columnId, 'count', primaryTable);
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
  async getMinMaxValues(columnId: string): Promise<[number, number]> {
    try {
      // Determine primary table from the column
      const primaryTable = this.primaryTableResolver.resolve([columnId]);
      const query = this.queryBuilder.buildMinMaxQuery(columnId, primaryTable);
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
   * Determine table from data or use first table as fallback
   */
  private determineTableFromData(
    _data?: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): string {
    // For now, use the first table as fallback
    // In a more sophisticated implementation, we could analyze the data structure
    const tableNames = Object.keys(this.schema);
    if (tableNames.length === 0) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }
    const firstTable = tableNames[0];
    if (!firstTable) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }
    return firstTable;
  }

  /**
   * Create new record
   */
  async createRecord(
    data: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>> {
    try {
      const primaryTable = this.determineTableFromData(data);
      const mainTableSchema = this.schema[primaryTable] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const result = await this.executeInsert(mainTableSchema, data);

      this.emit({ type: 'insert', data: result });
      this.invalidateCache();

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
    data: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>> {
    try {
      const primaryTable = this.determineTableFromData(data);
      const mainTableSchema = this.schema[primaryTable] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const result = await this.executeUpdate(mainTableSchema, id, data);

      this.emit({ type: 'update', data: result });
      this.invalidateCache();

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
  async deleteRecord(id: string): Promise<void> {
    try {
      const primaryTable = this.determineTableFromData();
      const mainTableSchema = this.schema[primaryTable] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const result = await this.executeDelete(mainTableSchema, id);

      this.emit({ type: 'delete', data: result });
      this.invalidateCache();
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
    data: Partial<InferSelectModel<TSchema[keyof TSchema]>>
  ): Promise<InferSelectModel<TSchema[keyof TSchema]>[]> {
    try {
      const primaryTable = this.determineTableFromData(data);
      const mainTableSchema = this.schema[primaryTable] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const results = await this.executeBulkUpdate(mainTableSchema, ids, data);

      this.emit({ type: 'update', data: results });
      this.invalidateCache();

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
    try {
      const primaryTable = this.determineTableFromData();
      const mainTableSchema = this.schema[primaryTable] as TableWithId;
      if (!mainTableSchema) {
        throw new SchemaError(`Table not found: ${primaryTable}`, {
          primaryTable,
        });
      }

      const results = await this.executeBulkDelete(mainTableSchema, ids);

      this.emit({ type: 'delete', data: results });
      this.invalidateCache();
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
    try {
      // Fetch all data for export
      const fetchParams: FetchDataParams = {
        columns: params.columns || [],
        filters: [],
        sorting: [],
        pagination: { page: 1, limit: Number.MAX_SAFE_INTEGER }, // Get all data
      };

      const result = await this.fetchData(fetchParams);

      // Convert to export format
      const exportData = this.convertToExportFormat(result.data, params.format);

      return {
        data: exportData,
        filename: `export.${params.format}`,
        mimeType: this.getMimeType(params.format),
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
    callback: (event: DataEvent<InferSelectModel<TSchema[keyof TSchema]>>) => void
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
   * Build adapter metadata
   */
  private buildAdapterMeta(customMeta?: Partial<AdapterMeta>): AdapterMeta {
    const features: AdapterFeatures = {
      create: true,
      read: true,
      update: true,
      delete: true,
      bulkOperations: true,
      realTimeUpdates: true,
      export: true,
      transactions: true,
    };

    const supportedColumnTypes: ColumnType[] = [
      'text',
      'number',
      'date',
      'boolean',
      'option',
      'multiOption',
      'currency',
      'percentage',
      'url',
      'email',
      'phone',
      'json',
      'custom',
    ];

    const supportedOperators: Record<ColumnType, FilterOperator[]> = {
      text: [
        'contains',
        'equals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
        'notEquals',
        'isNull',
        'isNotNull',
      ],
      number: [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
        'isNull',
        'isNotNull',
      ],
      date: [
        'is',
        'isNot',
        'before',
        'after',
        'isToday',
        'isYesterday',
        'isThisWeek',
        'isThisMonth',
        'isThisYear',
        'isNull',
        'isNotNull',
      ],
      boolean: ['isTrue', 'isFalse', 'isNull', 'isNotNull'],
      option: ['equals', 'notEquals', 'isAnyOf', 'isNoneOf', 'isNull', 'isNotNull'],
      multiOption: [
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
        'isNull',
        'isNotNull',
      ],
      currency: [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
        'isNull',
        'isNotNull',
      ],
      percentage: [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
        'isNull',
        'isNotNull',
      ],
      url: [
        'contains',
        'equals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
        'notEquals',
        'isNull',
        'isNotNull',
      ],
      email: [
        'contains',
        'equals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
        'notEquals',
        'isNull',
        'isNotNull',
      ],
      phone: [
        'contains',
        'equals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
        'notEquals',
        'isNull',
        'isNotNull',
      ],
      json: ['isNull', 'isNotNull'],
      custom: ['isNull', 'isNotNull'],
    };

    return {
      name: customMeta?.name || 'Drizzle Adapter',
      version: customMeta?.version || '1.0.0',
      features,
      supportedColumnTypes,
      supportedOperators,
      ...customMeta,
    };
  }

  /**
   * Cache management
   */
  private getCacheKey(
    params: FetchDataParams & {
      computedFields?: string[];
      computedFieldFilters?: FilterState[];
    }
  ): string {
    return JSON.stringify(params);
  }

  /**
   * Add computed fields to result data
   */
  private async addComputedFields(
    result: FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>>,
    computedFields: ComputedFieldConfig[],
    primaryTable: string
  ): Promise<FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>>> {
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
      data: dataWithComputed as InferSelectModel<TSchema[keyof TSchema]>[],
      total: result.total,
      pagination: result.pagination,
      meta: result.meta || {},
    };
  }

  private getFromCache(
    key: string
  ): FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>> | undefined {
    const cached = this.cache.get(key);
    return cached ? cached.value : undefined;
  }

  private setCache(
    key: string,
    value: FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>>,
    ttl?: number
  ): void {
    if (this.options?.cache?.enabled !== false) {
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.options?.cache?.ttl || 300000, // 5 minutes default
      });
    }
  }

  private isCacheExpired(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return true;

    const ttl = cached.ttl || this.options?.cache?.ttl || 300000;
    return Date.now() - cached.timestamp > ttl;
  }

  private invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Event system
   */
  private emit(event: DataEvent<InferSelectModel<TSchema[keyof TSchema]>>): void {
    this.subscribers.forEach((callback) => {
      callback(event);
    });
  }

  /**
   * Utility methods
   */
  private getJoinCount(params: FetchDataParams): number {
    // Determine primary table from params - use explicit if provided
    const primaryTable = this.primaryTableResolver.resolve(params.columns, params.primaryTable);
    const context = this.relationshipManager.buildQueryContext(
      {
        columns: params.columns || [],
        filters: params.filters?.map((filter) => ({ columnId: filter.columnId })) || [],
        sorts: params.sorting?.map((sort) => ({ columnId: sort.columnId })) || [],
      },
      primaryTable
    );
    return context.joinPaths.size;
  }

  private convertToExportFormat(
    data: InferSelectModel<TSchema[keyof TSchema]>[],
    format: string
  ): Blob | string {
    switch (format) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'excel':
        // Would need a library like xlsx for this
        throw new Error('Excel export not implemented');
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private convertToCSV(data: InferSelectModel<TSchema[keyof TSchema]>[]): string {
    if (data.length === 0) return '';

    const firstRecord = data[0];
    if (!firstRecord || typeof firstRecord !== 'object') return '';

    const headers = Object.keys(firstRecord);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = (row as Record<string, unknown>)[header];
        if (typeof value === 'string') {
          // Prevent CSV formula injection by prefixing with quote if starts with formula characters
          const sanitizedValue = value.replace(/"/g, '""');
          if (/^[=+\-@]/.test(value)) {
            return `"'${sanitizedValue}"`;
          }
          return `"${sanitizedValue}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }
}
