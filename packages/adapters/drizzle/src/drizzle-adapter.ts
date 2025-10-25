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

import { eq, inArray } from 'drizzle-orm';
import { DataTransformer } from './data-transformer';
import { DrizzleQueryBuilder } from './query-builder';
import { RelationshipDetector } from './relationship-detector';
import { RelationshipManager } from './relationship-manager';
import type {
  AnyTableType,
  DrizzleAdapterConfig,
  DrizzleDatabase,
  RelationshipMap,
  TableWithId,
} from './types';
import { QueryError, SchemaError } from './types';

/**
 * Drizzle adapter implementation for Better Tables
 */
export class DrizzleAdapter<TSchema extends Record<string, AnyTableType>>
  implements TableAdapter<InferSelectModel<TSchema[keyof TSchema]>>
{
  private db: DrizzleDatabase;
  private schema: TSchema;
  private relationships: RelationshipMap;
  private relationshipDetector: RelationshipDetector;
  private relationshipManager: RelationshipManager;
  private queryBuilder: DrizzleQueryBuilder;
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
  private options: DrizzleAdapterConfig<TSchema>['options'];

  public readonly meta: AdapterMeta;

  constructor(config: DrizzleAdapterConfig<TSchema>) {
    this.db = config.db;
    this.schema = config.schema;
    this.options = config.options || {};

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

    this.queryBuilder = new DrizzleQueryBuilder(
      this.db,
      this.schema,
      this.relationshipManager,
      config.driver,
      config.options?.primaryKey?.tableKeys
    );
    this.dataTransformer = new DataTransformer(this.schema, this.relationshipManager);

    // Initialize metadata
    this.meta = this.buildAdapterMeta(config.meta);
  }

  /**
   * Determine the primary table from column configurations
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
   * Check if a table has a specific column
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
   * Fetch data with filtering, sorting, and pagination
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

      const insertResult = await this.db.insert(mainTableSchema).values(data).returning();
      const [result] = insertResult as [InferSelectModel<TSchema[keyof TSchema]>];

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

      const updateResult = await this.db
        .update(mainTableSchema)
        .set(data)
        .where(eq(mainTableSchema.id, id))
        .returning();
      const [result] = updateResult as [InferSelectModel<TSchema[keyof TSchema]>];

      if (!result) {
        throw new QueryError(`Record not found with id: ${id}`, { id });
      }

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

      const deleteResult = await this.db
        .delete(mainTableSchema)
        .where(eq(mainTableSchema.id, id))
        .returning();
      const [result] = deleteResult as [InferSelectModel<TSchema[keyof TSchema]>];

      if (!result) {
        throw new QueryError(`Record not found with id: ${id}`, { id });
      }

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

      const bulkUpdateResult = await this.db
        .update(mainTableSchema)
        .set(data)
        .where(inArray(mainTableSchema.id, ids))
        .returning();
      const results = bulkUpdateResult as InferSelectModel<TSchema[keyof TSchema]>[];

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

      const bulkDeleteResult = await this.db
        .delete(mainTableSchema)
        .where(inArray(mainTableSchema.id, ids))
        .returning();
      const results = bulkDeleteResult as InferSelectModel<TSchema[keyof TSchema]>[];

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
