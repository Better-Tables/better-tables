/**
 * @fileoverview Data transformation utilities for Drizzle ORM adapter
 * @module @better-tables/adapters-drizzle/data-transformer
 *
 * @description
 * Provides utilities for transforming flat SQL query results into nested data structures
 * that reflect relationships between tables. This is a critical component that converts
 * the flat structure returned by SQL joins into the nested, hierarchical data structures
 * expected by the Better Tables framework.
 *
 * Key capabilities:
 * - Transforms flat SQL results with joined tables into nested objects
 * - Handles one-to-one and one-to-many relationships
 * - Groups related records together
 * - Applies aggregations to nested relationships
 * - Validates transformed data structure
 * - Handles null values gracefully
 *
 * This class is immutable and thread-safe - all methods accept primaryTable as a parameter
 * rather than storing it as mutable state, preventing race conditions in concurrent requests.
 *
 * @example
 * ```typescript
 * // Flat SQL result
 * const flat = [
 *   { id: 1, email: 'user1@example.com', profile_bio: 'Bio 1', posts_id: 1, posts_title: 'Post 1' },
 *   { id: 1, email: 'user1@example.com', profile_bio: 'Bio 1', posts_id: 2, posts_title: 'Post 2' }
 * ];
 *
 * // Transformed to nested structure
 * const nested = transformer.transformToNested(flat, 'users', ['email', 'profile.bio', 'posts.title']);
 * // [{
 * //   id: 1, email: 'user1@example.com',
 * //   profile: { bio: 'Bio 1' },
 * //   posts: [{ id: 1, title: 'Post 1' }, { id: 2, title: 'Post 2' }]
 * // }]
 * ```
 *
 * @since 1.0.0
 */

import type { RelationshipManager } from './relationship-manager';
import type { AggregateColumn, AnyTableType, ColumnPath } from './types';
import { generateAlias } from './utils/alias-generator';
import {
  getColumnNames,
  getForeignKeyColumns,
  getPrimaryKeyColumns,
} from './utils/drizzle-schema-utils';

/**
 * Data transformer that converts flat SQL results to nested structures.
 *
 * @class DataTransformer
 * @description Converts flat SQL join results into nested, relationship-aware data structures
 *
 * @property {Record<string, AnyTableType>} schema - The schema containing all tables
 * @property {RelationshipManager} relationshipManager - Manager for resolving relationships
 *
 * @example
 * ```typescript
 * const transformer = new DataTransformer(schema, relationshipManager);
 * const nested = transformer.transformToNested(flatResults, 'users', ['email', 'profile.bio']);
 * ```
 *
 * @since 1.0.0
 */
export class DataTransformer {
  private schema: Record<string, AnyTableType>;
  private relationshipManager: RelationshipManager;

  constructor(schema: Record<string, AnyTableType>, relationshipManager: RelationshipManager) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
  }

  /**
   * Transform flat SQL result to nested structure
   * @param flatData - Flat SQL results to transform
   * @param primaryTable - The primary table for this query context
   * @param columns - Optional list of columns to include
   * @param columnMetadata - Optional metadata about column selections
   */
  transformToNested<TData = Record<string, unknown>>(
    flatData: Record<string, unknown>[],
    primaryTable: string,
    columns?: string[],
    columnMetadata?: {
      selections: Record<string, unknown>;
      columnMapping: Record<string, string>;
    }
  ): TData[] {
    if (!flatData || flatData.length === 0) {
      return [];
    }

    // Group data by main table primary key
    const groupedData = this.groupByMainTableKey(flatData, primaryTable);

    // Transform each group to nested structure
    const nestedData: TData[] = [];

    for (const [, records] of groupedData) {
      const nestedRecord = this.buildNestedRecord(records, primaryTable, columns, columnMetadata);
      nestedData.push(nestedRecord as TData);
    }

    return nestedData;
  }

  /**
   * Group flat data by main table primary key
   * @param flatData - Flat data records to group
   * @param primaryTable - The primary table for this query context
   */
  private groupByMainTableKey(
    flatData: Record<string, unknown>[],
    primaryTable: string
  ): Map<string, Record<string, unknown>[]> {
    const grouped = new Map<string, Record<string, unknown>[]>();

    for (const record of flatData) {
      // Get the primary key dynamically from the schema
      const tableSchema = this.schema[primaryTable];
      if (!tableSchema) continue;
      const primaryKeyName = this.getPrimaryKeyName(tableSchema);
      const mainKey = String(record[primaryKeyName] || record[`${primaryTable}_${primaryKeyName}`]);

      if (!grouped.has(mainKey)) {
        grouped.set(mainKey, []);
      }

      const group = grouped.get(mainKey);
      if (group) {
        group.push(record);
      }
    }

    return grouped;
  }

  /**
   * Build nested record from grouped flat records
   * @param records - Flat records to transform
   * @param primaryTable - The primary table for this query context
   * @param columns - Optional list of columns to include
   * @param columnMetadata - Optional metadata about column selections
   */
  private buildNestedRecord(
    records: Record<string, unknown>[],
    primaryTable: string,
    columns?: string[],
    columnMetadata?: {
      selections: Record<string, unknown>;
      columnMapping: Record<string, string>;
    }
  ): Record<string, unknown> {
    if (records.length === 0) {
      return {};
    }

    // Use the first record as the base
    const baseRecord = records[0];
    if (!baseRecord) return {};

    const nestedRecord: Record<string, unknown> = { ...baseRecord };

    // Process each column to build nested structure
    if (columns && columns.length > 0) {
      // Group columns by relationship to avoid processing the same relationship multiple times
      const processedRelationships = new Set<string>();

      for (const columnId of columns) {
        const parts = columnId.split('.');
        if (parts.length > 1) {
          // This is a relationship column - use first part as relationship key
          const relationshipKey = parts[0];
          if (relationshipKey && !processedRelationships.has(relationshipKey)) {
            this.processColumn(nestedRecord, columnId, records, primaryTable);
            processedRelationships.add(relationshipKey);
          }
        } else {
          // Direct column - process normally
          this.processColumn(nestedRecord, columnId, records, primaryTable);
        }
      }
    } else {
      // Process all available columns
      const firstRecord = records[0];
      if (firstRecord) {
        const allColumns = this.getAllColumnIds(firstRecord, primaryTable, columnMetadata);
        for (const columnId of allColumns) {
          try {
            this.processColumn(nestedRecord, columnId, records, primaryTable);
          } catch {
            // Skip columns that can't be resolved (e.g., table names, invalid paths)
            // This can happen with auto-detected columns from SQL joins
          }
        }
      }
    }

    return nestedRecord;
  }

  /**
   * Process a single column to build nested structure
   * @param nestedRecord - The nested record being built
   * @param columnId - The column ID to process
   * @param records - Flat records to extract data from
   * @param primaryTable - The primary table for this query context
   */
  private processColumn(
    nestedRecord: Record<string, unknown>,
    columnId: string,
    records: Record<string, unknown>[],
    primaryTable: string
  ): void {
    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

    if (!columnPath.isNested) {
      // Direct column - already in base record
      return;
    }

    if (columnPath.relationshipPath && columnPath.relationshipPath.length > 0) {
      // Use the last relationship in the path for multi-level relationships
      const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
      if (!relationship) return;

      if (relationship.cardinality === 'one') {
        this.processOneToOneColumn(nestedRecord, columnPath, records);
      } else {
        this.processOneToManyColumn(nestedRecord, columnPath, records);
      }
    }
  }

  /**
   * Process one-to-one relationship column
   */
  private processOneToOneColumn(
    nestedRecord: Record<string, unknown>,
    columnPath: ColumnPath,
    records: Record<string, unknown>[]
  ): void {
    const relationshipPath = columnPath.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[relationshipPath.length - 1];
    if (!relationship) return;

    const realTableName = relationship.to;
    const alias = columnPath.table; // Use the alias from columnPath (e.g., 'profile')

    // Find the first record with data for this relationship
    // Use generateAlias utility to construct the correct alias based on relationship path
    const testKey = generateAlias(relationshipPath, columnPath.field);
    const relatedRecord = records.find(
      (record) => record[testKey] !== null && record[testKey] !== undefined
    );

    if (relatedRecord) {
      // Build nested object for the related table
      const relatedData: Record<string, unknown> = {};

      // Extract all columns from the related table using the new alias format
      const relatedTableSchema = this.schema[realTableName];
      const relatedColumns = relatedTableSchema ? getColumnNames(relatedTableSchema) : [];

      for (const col of relatedColumns) {
        const flatKey = generateAlias(relationshipPath, col);
        if (relatedRecord[flatKey] !== undefined) {
          relatedData[col] = relatedRecord[flatKey];
        }
      }

      nestedRecord[alias] = relatedData; // Use alias as the key
    } else {
      nestedRecord[alias] = null;
    }
  }

  /**
   * Process one-to-many relationship column
   */
  private processOneToManyColumn(
    nestedRecord: Record<string, unknown>,
    columnPath: ColumnPath,
    records: Record<string, unknown>[]
  ): void {
    const relationshipPath = columnPath.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[relationshipPath.length - 1];
    if (!relationship) return;

    const realTableName = relationship.to;
    const alias = columnPath.table; // Use the alias from columnPath (e.g., 'posts')

    // Group records by related table primary key
    const relatedRecords = new Map<string, Record<string, unknown>>();

    for (const record of records) {
      // Get the primary key name dynamically
      const relatedTableSchema = this.schema[realTableName];
      if (!relatedTableSchema) continue;
      const primaryKeyName = this.getPrimaryKeyName(relatedTableSchema);
      // Use generateAlias utility for the primary key
      const relatedKey = String(record[generateAlias(relationshipPath, primaryKeyName)] || '');

      if (relatedKey && relatedKey !== 'undefined' && relatedKey !== 'null') {
        if (!relatedRecords.has(relatedKey)) {
          relatedRecords.set(relatedKey, {});
        }

        const relatedData = relatedRecords.get(relatedKey);
        if (!relatedData) continue;

        // Extract all columns from the related table using the new alias format
        const relatedColumns = relatedTableSchema ? getColumnNames(relatedTableSchema) : [];
        for (const col of relatedColumns) {
          const flatKey = generateAlias(relationshipPath, col);
          if (record[flatKey] !== undefined) {
            relatedData[col] = record[flatKey];
          }
        }
      }
    }

    nestedRecord[alias] = Array.from(relatedRecords.values()); // Use alias as the key
  }

  /**
   * Get all column IDs from a flat record using column metadata
   * Uses query builder metadata instead of manual parsing
   * @param record - The flat record to extract column IDs from
   * @param primaryTable - The primary table for this query context
   * @param columnMetadata - Optional metadata about column selections
   */
  private getAllColumnIds(
    record: Record<string, unknown>,
    primaryTable: string,
    columnMetadata?: {
      selections: Record<string, unknown>;
      columnMapping: Record<string, string>;
    }
  ): string[] {
    // If we have column metadata, use it for accurate mapping
    if (columnMetadata) {
      return Object.keys(record).map((key) => columnMetadata.columnMapping[key] || key);
    }

    // Fallback to manual parsing attempt
    const columnIds: string[] = [];
    const mainTableColumns = this.getMainTableColumns(primaryTable);

    for (const key of Object.keys(record)) {
      // Check if it's a main table column (no underscore processing needed)
      if (mainTableColumns.includes(key)) {
        columnIds.push(key);
        continue;
      }

      // Check if this is a primary table column with table name prefix (e.g., users_id, users_name)
      if (key.startsWith(`${primaryTable}_`)) {
        const field = key.substring(primaryTable.length + 1);
        if (mainTableColumns.includes(field)) {
          columnIds.push(field); // Use the field name without table prefix
          continue;
        }
      }

      // For joined columns, use Drizzle schema utilities
      if (key.includes('_')) {
        // Try to find a table name match (longest match first to handle edge cases)
        const tableNames = Object.keys(this.schema).filter((t) => t !== primaryTable);
        // Sort by length descending to match longest table name first
        tableNames.sort((a, b) => b.length - a.length);

        let foundMatch = false;

        for (const tableName of tableNames) {
          // Check if key starts with tableName_
          if (key.startsWith(`${tableName}_`)) {
            const field = key.substring(tableName.length + 1);
            // Use Drizzle schema utilities to verify the field exists
            const tableSchema = this.schema[tableName];
            if (tableSchema && getColumnNames(tableSchema).includes(field)) {
              // Check if this is a foreign key column using Drizzle schema utilities
              const foreignKeyColumns = getForeignKeyColumns(tableSchema);
              const isForeignKey = foreignKeyColumns.some((fk) => fk.name === field);

              if (!isForeignKey) {
                columnIds.push(`${tableName}.${field}`);
              }
              foundMatch = true;
              break;
            }
          }
        }

        // If no table match found, treat as main table column (e.g., user_id, created_at)
        if (!foundMatch) {
          columnIds.push(key);
        }
      } else {
        // No underscore - must be a main table column
        columnIds.push(key);
      }
    }

    return columnIds;
  }

  /**
   * Get column names from main table
   * @param primaryTable - The primary table for this query context
   */
  private getMainTableColumns(primaryTable: string): string[] {
    const table = this.schema[primaryTable];
    if (!table || typeof table !== 'object') {
      return [];
    }

    const tableObj = table as unknown as Record<string, unknown>;
    if ('_' in tableObj && tableObj._ && typeof tableObj._ === 'object') {
      const meta = tableObj._ as Record<string, unknown>;
      if ('columns' in meta && meta.columns && typeof meta.columns === 'object') {
        return Object.keys(meta.columns);
      }
    }

    return [];
  }

  /**
   * Handle one-to-many relationships with aggregation
   */
  handleOneToManyAggregates<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[],
    aggregateColumns: AggregateColumn[]
  ): TData[] {
    for (const record of data) {
      for (const aggregateCol of aggregateColumns) {
        this.applyAggregateToRecord(record as Record<string, unknown>, aggregateCol);
      }
    }

    return data;
  }

  /**
   * Apply aggregate to a single record
   */
  private applyAggregateToRecord(
    record: Record<string, unknown>,
    aggregateCol: AggregateColumn
  ): void {
    const relationshipPath = aggregateCol.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[0];
    if (!relationship) return;

    const relatedTable = relationship.to;

    if (record[relatedTable] && Array.isArray(record[relatedTable])) {
      const relatedRecords = record[relatedTable];

      switch (aggregateCol.function) {
        case 'count':
          record[aggregateCol.columnId] = relatedRecords.length;
          break;
        case 'distinct': {
          // Count distinct values
          const distinctValues = new Set(
            relatedRecords.map((r: Record<string, unknown>) => r[aggregateCol.field])
          );
          record[aggregateCol.columnId] = distinctValues.size;
          break;
        }
        case 'sum':
          record[aggregateCol.columnId] = relatedRecords.reduce(
            (sum: number, r: Record<string, unknown>) => sum + (Number(r[aggregateCol.field]) || 0),
            0
          );
          break;
        case 'avg': {
          const sum = relatedRecords.reduce(
            (sum: number, r: Record<string, unknown>) => sum + (Number(r[aggregateCol.field]) || 0),
            0
          );
          record[aggregateCol.columnId] =
            relatedRecords.length > 0 ? sum / relatedRecords.length : 0;
          break;
        }
        case 'min':
          record[aggregateCol.columnId] = Math.min(
            ...relatedRecords.map(
              (r: Record<string, unknown>) => Number(r[aggregateCol.field]) || Infinity
            )
          );
          break;
        case 'max':
          record[aggregateCol.columnId] = Math.max(
            ...relatedRecords.map(
              (r: Record<string, unknown>) => Number(r[aggregateCol.field]) || -Infinity
            )
          );
          break;
      }
    } else {
      record[aggregateCol.columnId] = 0;
    }
  }

  /**
   * Apply column accessors to transformed data
   */
  applyAccessors<TData = Record<string, unknown>>(
    data: TData[],
    accessors: Map<string, (data: TData) => unknown>
  ): TData[] {
    return data.map((record) => {
      const processedRecord = { ...record };

      for (const [columnId, accessor] of accessors) {
        try {
          (processedRecord as Record<string, unknown>)[columnId] = accessor(record);
        } catch {
          // Silently handle accessor errors
          // console.warn(`Error applying accessor for column ${columnId}:`, error);
          (processedRecord as Record<string, unknown>)[columnId] = null;
        }
      }

      return processedRecord;
    });
  }

  /**
   * Handle null/undefined values in related records
   * @param data - Data to process
   * @param primaryTable - The primary table for this query context
   */
  handleNullValues<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[],
    primaryTable: string
  ): TData[] {
    return data.map((record) => {
      const processedRecord = { ...record };

      // Process each property
      for (const [key, value] of Object.entries(processedRecord)) {
        if (value === null || value === undefined) {
          // Check if this is a relationship field
          const columnPath = this.relationshipManager.resolveColumnPath(key, primaryTable);

          if (columnPath.isNested) {
            // Set to null for one-to-one, empty array for one-to-many
            const relationship = columnPath.relationshipPath?.[0];
            if (relationship?.cardinality === 'many') {
              (processedRecord as Record<string, unknown>)[key] = [];
            } else {
              (processedRecord as Record<string, unknown>)[key] = null;
            }
          }
        }
      }

      return processedRecord;
    });
  }

  /**
   * Flatten nested data back to flat structure (for debugging)
   */
  flattenNestedData<TData extends Record<string, unknown> = Record<string, unknown>>(
    nestedData: TData[]
  ): Record<string, unknown>[] {
    const flattened: Record<string, unknown>[] = [];

    for (const record of nestedData) {
      const flatRecord = this.flattenRecord(record as Record<string, unknown>);
      flattened.push(flatRecord);
    }

    return flattened;
  }

  /**
   * Flatten a single nested record
   */
  private flattenRecord(record: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      const flatKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - recurse
        const nested = this.flattenRecord(value as Record<string, unknown>, flatKey);
        Object.assign(flattened, nested);
      } else if (Array.isArray(value)) {
        // Array - handle each item
        flattened[flatKey] = value;
      } else {
        // Primitive value
        flattened[flatKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Validate transformed data structure
   * @param data - Data to validate
   * @param primaryTable - The primary table for this query context
   */
  validateTransformedData<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[],
    primaryTable: string
  ): boolean {
    try {
      for (const record of data) {
        if (!record || typeof record !== 'object') {
          return false;
        }

        // Check for required fields
        const recordObj = record as Record<string, unknown>;
        if (!recordObj.id && !recordObj[`${primaryTable}_id`]) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get primary key name from table schema using Drizzle utilities
   */
  private getPrimaryKeyName(tableSchema: AnyTableType): string {
    const primaryKeyColumns = getPrimaryKeyColumns(tableSchema);
    // Return the first primary key column name, or 'id' as fallback
    return primaryKeyColumns.length > 0 && primaryKeyColumns[0] ? primaryKeyColumns[0].name : 'id';
  }

  /**
   * Get transformation statistics
   */
  getTransformationStats<TData extends Record<string, unknown> = Record<string, unknown>>(
    data: TData[]
  ): {
    totalRecords: number;
    nestedRelationships: number;
    nullValues: number;
    arrayFields: number;
  } {
    const stats = {
      totalRecords: data.length,
      nestedRelationships: 0,
      nullValues: 0,
      arrayFields: 0,
    };

    for (const record of data) {
      const recordObj = record as Record<string, unknown>;
      for (const [, value] of Object.entries(recordObj)) {
        if (value === null || value === undefined) {
          stats.nullValues++;
        } else if (Array.isArray(value)) {
          stats.arrayFields++;
        } else if (value && typeof value === 'object') {
          stats.nestedRelationships++;
        }
      }
    }

    return stats;
  }
}
