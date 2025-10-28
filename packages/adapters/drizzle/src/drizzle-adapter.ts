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
  TableAdapter,
} from '@better-tables/core';
import type { InferSelectModel, Relations } from 'drizzle-orm';

import { DataTransformer } from './data-transformer';
import { getOperationsFactory } from './operations';
import { type BaseQueryBuilder, getQueryBuilderFactory } from './query-builders';
import { RelationshipDetector } from './relationship-detector';
import { RelationshipManager } from './relationship-manager';
import type {
  AnyTableType,
  DatabaseDriver,
  DatabaseOperations,
  DrizzleAdapterConfig,
  DrizzleDatabase,
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
      } else {
        this.relationships = {};
      }
    } else {
      this.relationships = config.relationships || {};
    }

    // Initialize managers - they will be configured per query
    this.relationshipManager = new RelationshipManager(this.schema, this.relationships);

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
    return createQueryBuilder(this.db, this.schema, this.relationshipManager);
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
   * Determine the primary table from column configurations.
   *
   * Analyzes the provided column identifiers to determine which table should be
   * used as the primary table for the query. This is critical for proper join
   * planning and relationship resolution.
   *
   * @description
   * The primary table is determined by:
   * 1. Counting how many columns belong to each table
   * 2. Selecting the table with the most column references
   * 3. Falling back to the first table in the schema if unclear
   *
   * @param {string[]} [columns] - Array of column identifiers (e.g., ['email', 'profile.bio'])
   * @returns {string} The name of the primary table
   *
   * @throws {SchemaError} If no tables are found in the schema
   *
   * @example
   * ```typescript
   * // Returns 'users' as it has 2 column references
   * const table = this.determinePrimaryTable(['email', 'name', 'profile.bio']);
   * ```
   *
   * @since 1.0.0
   * @internal
   */
  private determinePrimaryTable(columns?: string[]): string {
    if (!columns || columns.length === 0) {
      // If no columns specified, use the first table in schema
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

    // Analyze columns to find the most common table
    const tableCounts = new Map<string, number>();

    for (const columnId of columns) {
      const parts = columnId.split('.');
      if (parts.length === 1) {
        // Direct column - find which table it belongs to
        const fieldName = parts[0];
        if (!fieldName) continue;

        for (const [tableName, tableSchema] of Object.entries(this.schema)) {
          if (this.hasColumn(tableSchema, fieldName)) {
            tableCounts.set(tableName, (tableCounts.get(tableName) || 0) + 1);
            break;
          }
        }
      } else if (parts.length >= 2) {
        // Relationship column - the first part is the table alias
        const tableAlias = parts[0];
        if (!tableAlias) continue;

        // Find the actual table name from relationships
        for (const [relKey] of Object.entries(this.relationships)) {
          if (relKey.endsWith(`.${tableAlias}`)) {
            const sourceTable = relKey.split('.')[0];
            if (sourceTable) {
              tableCounts.set(sourceTable, (tableCounts.get(sourceTable) || 0) + 1);
            }
            break;
          }
        }
      }
    }

    // Return the table with the most column references
    let primaryTable = '';
    let maxCount = 0;
    for (const [tableName, count] of tableCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryTable = tableName;
      }
    }

    // Fallback to first table if no clear primary table found
    if (!primaryTable) {
      const tableNames = Object.keys(this.schema);
      if (tableNames.length === 0) {
        throw new SchemaError('No tables found in schema', { schema: this.schema });
      }
      const firstTable = tableNames[0];
      if (!firstTable) {
        throw new SchemaError('No tables found in schema', { schema: this.schema });
      }
      primaryTable = firstTable;
    }

    return primaryTable;
  }

  /**
   * Check if a table has a specific column.
   *
   * @description
   * Safely checks whether a column exists in a table schema by accessing
   * Drizzle's internal metadata. Returns false for invalid schemas or
   * missing columns rather than throwing errors.
   *
   * @param {AnyTableType} tableSchema - The table schema to check
   * @param {string} columnName - The name of the column to check for
   * @returns {boolean} True if the column exists, false otherwise
   *
   * @example
   * ```typescript
   * const hasEmail = this.hasColumn(users, 'email'); // true
   * const hasBad = this.hasColumn(users, 'nonexistent'); // false
   * ```
   *
   * @since 1.0.0
   * @internal
   */
  private hasColumn(tableSchema: AnyTableType, columnName: string): boolean {
    try {
      const tableObj = tableSchema as unknown as Record<string, unknown>;
      if ('_' in tableObj && tableObj._ && typeof tableObj._ === 'object') {
        const meta = tableObj._ as Record<string, unknown>;
        if ('columns' in meta && meta.columns && typeof meta.columns === 'object') {
          const columns = meta.columns as Record<string, unknown>;
          return columnName in columns;
        }
      }
      return false;
    } catch {
      return false;
    }
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
      // Determine primary table from column configurations
      const primaryTable = this.determinePrimaryTable(params.columns);

      // Check cache first
      const cacheKey = this.getCacheKey(params);
      const cached = this.getFromCache(cacheKey);

      if (cached && !this.isCacheExpired(cacheKey)) {
        // Mark as cached
        return {
          ...cached,
          meta: {
            ...cached.meta,
            cached: true,
          },
        };
      }

      // Build queries - pass primaryTable to query builder
      const { dataQuery, countQuery, columnMetadata } = this.queryBuilder.buildCompleteQuery({
        columns: params.columns || [],
        filters: params.filters || [],
        sorting: params.sorting || [],
        pagination: params.pagination || { page: 1, limit: 10 },
        primaryTable,
      });

      // Execute queries in parallel
      const [data, countResult] = await Promise.all([dataQuery.execute(), countQuery.execute()]);

      const total = (countResult[0] as { count: number } | undefined)?.count || 0;

      // Transform data to nested structure - pass primaryTable to transformer
      const transformedData = this.dataTransformer.transformToNested<
        InferSelectModel<TSchema[keyof TSchema]>
      >(data, primaryTable, params.columns, columnMetadata);

      // Build result
      const result: FetchDataResult<InferSelectModel<TSchema[keyof TSchema]>> = {
        data: transformedData,
        total: Number(total),
        pagination: params.pagination
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
            },
        meta: {
          executionTime: Date.now() - startTime,
          joinCount: this.getJoinCount(params),
          cached: false,
        },
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
      const primaryTable = this.determinePrimaryTable([columnId]);
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
      const primaryTable = this.determinePrimaryTable([columnId]);
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
      const primaryTable = this.determinePrimaryTable([columnId]);
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
  private getCacheKey(params: FetchDataParams): string {
    return JSON.stringify(params);
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
    // Determine primary table from params
    const primaryTable = this.determinePrimaryTable(params.columns);
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
