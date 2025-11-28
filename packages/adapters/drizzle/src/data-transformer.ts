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
      isNested?: boolean; // Flag to indicate if data is already nested from relational query
    }
  ): TData[] {
    if (!flatData || flatData.length === 0) {
      return [];
    }

    // Check if data is already nested (from Drizzle relational queries)
    // Prefer the explicit flag from query builder, only use auto-detection as fallback
    const isNested =
      columnMetadata?.isNested ??
      (flatData.length > 0 ? this.detectNestedData(flatData[0], primaryTable) : false);

    if (isNested) {
      // Data is already nested - just filter to requested columns
      return this.filterNestedData<TData>(flatData as TData[], primaryTable, columns);
    }

    // Data is flat - transform to nested structure
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
   * Detect if data is already nested (from Drizzle relational queries)
   * Checks if the first record contains nested objects or arrays
   */
  private detectNestedData(
    record: Record<string, unknown> | undefined,
    primaryTable: string
  ): boolean {
    if (!record || typeof record !== 'object') {
      return false;
    }

    // Check if any value matches relationship-like structures
    // Look for keys that match relationship aliases from the relationship manager
    for (const [key, value] of Object.entries(record)) {
      if (value && typeof value === 'object') {
        // Check if this key is a known relationship alias
        const relationship = this.relationshipManager.getRelationshipByAlias(primaryTable, key);
        if (relationship) {
          // This is a known relationship - data is nested
          return true;
        }

        // Also check for relationship-like structures (arrays of objects with id, or objects with id)
        if (Array.isArray(value)) {
          // If array contains objects with 'id' field, it's likely a relationship
          if (
            value.length > 0 &&
            typeof value[0] === 'object' &&
            value[0] !== null &&
            'id' in (value[0] as Record<string, unknown>)
          ) {
            return true;
          }
        } else if (!(value instanceof Date)) {
          // Check if it's an object with 'id' field (likely a relationship)
          const obj = value as Record<string, unknown>;
          if ('id' in obj && Object.keys(obj).length > 1) {
            // Has id and other fields - likely a relationship object
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Filter nested data to only include requested columns
   */
  private filterNestedData<TData = Record<string, unknown>>(
    nestedData: TData[],
    primaryTable: string,
    columns?: string[]
  ): TData[] {
    if (!columns || columns.length === 0) {
      return nestedData; // No filtering needed if no columns specified
    }

    // Group columns by relationship to avoid overwriting fields
    const relationshipFields = new Map<string, Set<string>>();
    const directColumns = new Set<string>();

    for (const columnId of columns) {
      const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

      if (columnPath.isNested) {
        // Extract relationship alias and field
        const parts = columnId.split('.');
        if (parts.length >= 2) {
          const [relationshipAlias, ...fieldParts] = parts;
          const field = fieldParts.join('.');

          if (relationshipAlias) {
            if (!relationshipFields.has(relationshipAlias)) {
              relationshipFields.set(relationshipAlias, new Set());
            }
            relationshipFields.get(relationshipAlias)?.add(field);
          }
        }
      } else {
        // Direct column
        directColumns.add(columnPath.field);
      }
    }

    return nestedData.map((record) => {
      const filtered: Record<string, unknown> = {};
      const recordObj = record as Record<string, unknown>;

      // Process direct columns
      for (const field of directColumns) {
        if (recordObj[field] !== undefined) {
          filtered[field] = recordObj[field];
        }
      }

      // Process relationship columns (grouped by relationship)
      for (const [relationshipAlias, fields] of relationshipFields) {
        if (recordObj[relationshipAlias] !== undefined) {
          const relationshipValue = recordObj[relationshipAlias];

          // Handle null values explicitly - preserve null for one-to-one relationships
          if (relationshipValue === null) {
            filtered[relationshipAlias] = null;
          } else if (Array.isArray(relationshipValue)) {
            // Handle array relationships - filter each item to include all requested fields
            const filteredArray = relationshipValue.map((item: unknown) => {
              if (item && typeof item === 'object') {
                const itemObj = item as Record<string, unknown>;
                const filteredItem: Record<string, unknown> = {};
                // Include all requested fields for this relationship
                for (const field of fields) {
                  if (itemObj[field] !== undefined) {
                    filteredItem[field] = itemObj[field];
                  }
                }
                // Always include id for identification
                if (itemObj.id !== undefined) {
                  filteredItem.id = itemObj.id;
                }
                return filteredItem;
              }
              return item;
            });
            filtered[relationshipAlias] = filteredArray;
          } else if (relationshipValue && typeof relationshipValue === 'object') {
            // Handle one-to-one relationships - include all requested fields
            const relObj = relationshipValue as Record<string, unknown>;
            const filteredRel: Record<string, unknown> = {};
            // Include all requested fields for this relationship
            for (const field of fields) {
              if (relObj[field] !== undefined) {
                filteredRel[field] = relObj[field];
              }
            }
            // Always include id
            if (relObj.id !== undefined) {
              filteredRel.id = relObj.id;
            }
            filtered[relationshipAlias] = Object.keys(filteredRel).length > 0 ? filteredRel : null;
          }
        }
      }

      // Always include primary key
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        const primaryKeyName = this.getPrimaryKeyName(primaryTableSchema);
        if (primaryKeyName && recordObj[primaryKeyName] !== undefined) {
          filtered[primaryKeyName] = recordObj[primaryKeyName];
        }
      }

      return filtered as TData;
    });
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
      // But JSON accessor columns (e.g., survey.title) need to be processed individually
      const processedRelationships = new Set<string>();

      for (const columnId of columns) {
        const parts = columnId.split('.');
        if (parts.length > 1) {
          // Check if this is a JSON accessor column (not a relationship)
          const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

          if (!columnPath.isNested) {
            // This is a JSON accessor column - process it individually
            // JSON accessors like survey.title and survey.description both need to be processed
            this.processColumn(nestedRecord, columnId, records, primaryTable);
          } else {
            // This is a relationship column - use first part as relationship key
            const relationshipKey = parts[0];
            if (relationshipKey && !processedRelationships.has(relationshipKey)) {
              this.processColumn(nestedRecord, columnId, records, primaryTable);
              processedRelationships.add(relationshipKey);
            }
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

    // Clean up flattened fields from related tables after building nested structure
    // Remove all flattened fields (pattern: {tableName}_{columnName}) that have been converted to nested objects
    // Keep only:
    // 1. Direct columns from the primary table
    // 2. Nested relationship objects/arrays (already created by processColumn)
    // 3. JSON accessor fields (don't match flattened pattern)
    const cleanedRecord: Record<string, unknown> = {};
    const flattenedFieldPattern = /^[a-zA-Z_][a-zA-Z0-9_]*_[a-zA-Z_][a-zA-Z0-9_]*$/;

    // Collect all relationship target tables that have been processed (these are nested objects now)
    const processedRelationshipTables = new Set<string>();
    if (columns && columns.length > 0) {
      for (const columnId of columns) {
        const parts = columnId.split('.');
        if (parts.length > 1) {
          const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
          const relationshipPath = columnPath.relationshipPath;
          if (columnPath.isNested && relationshipPath && relationshipPath.length > 0) {
            // Get the target table from the relationship
            const relationship = relationshipPath[relationshipPath.length - 1];
            if (relationship?.to) {
              processedRelationshipTables.add(relationship.to);
            }
          }
        }
      }
    }

    for (const [key, value] of Object.entries(nestedRecord)) {
      // Check if this is a flattened field
      if (flattenedFieldPattern.test(key)) {
        // This is a flattened field - check if it belongs to a processed relationship table
        // Extract table name from flattened field (e.g., "usersTable_id" -> "usersTable")
        const parts = key.split('_');
        if (parts.length >= 2) {
          const tableName = parts[0];
          if (tableName) {
            // If this table was processed as a relationship, remove the flattened field
            if (processedRelationshipTables.has(tableName)) {
              // Skip this flattened field - it's been converted to a nested object
              continue;
            }
          }
        }
      }

      // Keep this field (not a flattened field, or flattened field for unprocessed relationship)
      cleanedRecord[key] = value;
    }

    return cleanedRecord;
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
      // Check if this is a JSON accessor column (e.g., "survey.title")
      if (columnId.includes('.')) {
        const parts = columnId.split('.');
        if (parts.length === 2) {
          const [baseColumnName, jsonField] = parts;
          if (baseColumnName && jsonField) {
            // This is a JSON accessor - extract value and nest it
            const firstRecord = records[0];
            if (firstRecord && firstRecord[columnId] !== undefined) {
              // Initialize the nested object if it doesn't exist
              if (
                !nestedRecord[baseColumnName] ||
                typeof nestedRecord[baseColumnName] !== 'object'
              ) {
                nestedRecord[baseColumnName] = {};
              }
              // Set the extracted JSON field value
              const nestedObj = nestedRecord[baseColumnName] as Record<string, unknown>;
              nestedObj[jsonField] = firstRecord[columnId];
            }
          }
        }
      }
      // Direct column - already in base record
      return;
    }

    if (columnPath.relationshipPath && columnPath.relationshipPath.length > 0) {
      // Use the last relationship in the path for multi-level relationships
      const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
      if (!relationship) return;

      // Check if this is an array foreign key relationship
      const isArrayRelationship = relationship.isArray === true;

      if (relationship.cardinality === 'one' && !isArrayRelationship) {
        this.processOneToOneColumn(nestedRecord, columnPath, records);
      } else {
        // Handle both regular many relationships and array foreign keys
        // Array relationships are processed the same way as regular many relationships
        // since the join already returns multiple rows (one per array element)
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

      // Extract only columns that are present in the record (requested columns)
      // Instead of extracting all columns, only extract what's actually in the record
      const relatedTableSchema = this.schema[realTableName];
      const relatedColumns = relatedTableSchema ? getColumnNames(relatedTableSchema) : [];

      for (const col of relatedColumns) {
        const flatKey = generateAlias(relationshipPath, col);
        // Only extract if the value is defined and not null
        // This ensures we only get requested columns, not all columns
        if (relatedRecord[flatKey] !== undefined && relatedRecord[flatKey] !== null) {
          relatedData[col] = relatedRecord[flatKey];
        }
      }

      // Only set the nested object if it has at least one field
      nestedRecord[alias] = Object.keys(relatedData).length > 0 ? relatedData : null;
    } else {
      nestedRecord[alias] = null;
    }
  }

  /**
   * Process one-to-many relationship column
   * Also handles array foreign key relationships
   * Array relationships work the same way - the join returns multiple rows that get grouped
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

    // Check if this is an array relationship (PostgreSQL array column)
    const isArrayRelationship = this.relationshipManager.isArrayRelationship(relationshipPath);

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

        // For array relationships, we need to extract data differently
        // The join might return multiple rows per main record, one for each array element
        // Extract only columns that are present in the record (requested columns)
        // Instead of extracting all columns, only extract what's actually in the record
        const relatedColumns = relatedTableSchema ? getColumnNames(relatedTableSchema) : [];
        for (const col of relatedColumns) {
          const flatKey = generateAlias(relationshipPath, col);
          // Only extract if the value is defined and not null
          // This ensures we only get requested columns, not all columns
          if (record[flatKey] !== undefined && record[flatKey] !== null) {
            relatedData[col] = record[flatKey];
          }
        }
      }
    }

    // For array relationships, ensure we return all items, not just unique ones
    // The Map already handles uniqueness by primary key, so we just convert to array
    const relatedRecordsArray = Array.from(relatedRecords.values());

    // Filter out empty records (records with no data)
    const validRecords = relatedRecordsArray.filter((record) => {
      return Object.keys(record).length > 0;
    });

    // For array relationships, ensure all items are included
    // Array relationships may have duplicate primary keys in the flat data (one per array element)
    // We need to preserve all of them, not just unique ones
    if (isArrayRelationship && validRecords.length > 0) {
      // For array relationships, we might have multiple records with the same primary key
      // representing different array elements. The Map already deduplicates by key,
      // but we need to ensure we're getting all the data.
      nestedRecord[alias] = validRecords;
    } else {
      nestedRecord[alias] = validRecords.length > 0 ? validRecords : []; // Use alias as the key
    }
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
