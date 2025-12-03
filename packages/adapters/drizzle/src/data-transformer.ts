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
      // Process each group of records with the same primary key
      // Records with the same primary key are grouped together by groupByMainTableKey
      const nestedRecord = this.buildNestedRecord(records, primaryTable, columns, columnMetadata);
      nestedData.push(nestedRecord as TData);
    }

    return nestedData;
  }

  /**
   * Check if an array contains nested data structures (objects with 'id' field)
   * @param value - Array to check
   * @returns true if array contains objects with 'id' field (nested data), false otherwise
   */
  private isNestedArray(value: unknown): boolean {
    if (!Array.isArray(value) || value.length === 0) {
      return false;
    }

    const firstItem = value[0];
    return (
      typeof firstItem === 'object' &&
      firstItem !== null &&
      'id' in (firstItem as Record<string, unknown>)
    );
  }

  /**
   * Check if an object represents a nested data structure (has 'id' and other fields)
   * @param value - Object to check
   * @returns true if object has 'id' field and other fields (nested data), false otherwise
   */
  private isNestedObject(value: unknown): boolean {
    if (!value || typeof value !== 'object' || value instanceof Date) {
      return false;
    }

    const obj = value as Record<string, unknown>;
    return 'id' in obj && Object.keys(obj).length > 1;
  }

  /**
   * Detect if data is already nested (from Drizzle relational queries)
   * Checks if the first record contains nested objects or arrays
   * CRITICAL: Must distinguish between:
   * 1. Raw array columns (e.g., ['user1', 'user2']) - these are FLAT data
   * 2. Nested relationship objects (e.g., [{id: 'user1', name: 'John'}]) - these are NESTED data
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
          // Check if this is actually nested data or just a raw array column
          if (Array.isArray(value)) {
            // If array contains objects with 'id' field, it's nested relationship data (NESTED)
            // If array contains primitive values (strings, numbers), it's a raw array column (FLAT)
            if (this.isNestedArray(value)) {
              return true;
            }
            // Array of primitives (strings, numbers) - this is a raw array column, data is FLAT
            // Continue checking other fields
          } else if (this.isNestedObject(value)) {
            // Has id and other fields - likely a relationship object (NESTED)
            return true;
          }
        } else {
          // Not a known relationship alias - check for relationship-like structures
          if (this.isNestedArray(value)) {
            // Array contains objects with 'id' field - likely a relationship (NESTED)
            return true;
          } else if (this.isNestedObject(value)) {
            // Has id and other fields - likely a relationship object (NESTED)
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

    // Get the primary key name once for efficiency
    const tableSchema = this.schema[primaryTable];
    if (!tableSchema) {
      // If schema not found, return empty map or handle gracefully
      return grouped;
    }
    const primaryKeyName = this.getPrimaryKeyName(tableSchema);
    if (!primaryKeyName) {
      return grouped;
    }

    for (const record of flatData) {
      // Try multiple ways to get the primary key value
      // 1. Direct field name (e.g., 'id')
      // 2. Prefixed field name (e.g., 'posts_id')
      // 3. Fallback to 'id' if primary key name is 'id'
      // CRITICAL: Must check all possible locations to ensure grouping works correctly
      let mainKeyValue: unknown = record[primaryKeyName];
      if (mainKeyValue === undefined || mainKeyValue === null) {
        mainKeyValue = record[`${primaryTable}_${primaryKeyName}`];
      }
      // Additional fallback: try common primary key names
      if ((mainKeyValue === undefined || mainKeyValue === null) && primaryKeyName === 'id') {
        mainKeyValue = record['id'];
      }
      // Last resort: try to find any field that matches the primary key name
      if (mainKeyValue === undefined || mainKeyValue === null) {
        // Check all keys in the record for a match
        for (const [key, value] of Object.entries(record)) {
          if (key === primaryKeyName || key.endsWith(`_${primaryKeyName}`)) {
            mainKeyValue = value;
            break;
          }
        }
      }

      // Convert to string for grouping, handling null/undefined
      // Use a consistent string representation for grouping (handles numbers, strings, etc.)
      // CRITICAL: Use JSON.stringify for complex types to ensure consistent grouping
      let mainKey = '';
      if (mainKeyValue !== undefined && mainKeyValue !== null) {
        // Convert to string, handling special cases
        if (typeof mainKeyValue === 'number') {
          mainKey = String(mainKeyValue);
        } else if (typeof mainKeyValue === 'string') {
          mainKey = mainKeyValue;
        } else if (typeof mainKeyValue === 'boolean') {
          mainKey = String(mainKeyValue);
        } else {
          // For complex types (objects, arrays), use JSON.stringify for consistent grouping
          // This ensures records with the same primary key value are grouped together
          try {
            mainKey = JSON.stringify(mainKeyValue);
          } catch {
            mainKey = String(mainKeyValue);
          }
        }
      }

      // Skip records without a valid primary key
      if (!mainKey || mainKey === 'undefined' || mainKey === 'null' || mainKey === '') {
        continue;
      }

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

    // Copy base record to nested record
    // CRITICAL: Preserve all fields from baseRecord, including direct columns that might also be relationships
    // (e.g., 'authors' array column that can also be requested as 'authors.id')
    const nestedRecord: Record<string, unknown> = { ...baseRecord };

    // Process each column to build nested structure
    if (columns && columns.length > 0) {
      // Group columns by relationship to avoid processing the same relationship multiple times
      // But JSON accessor columns (e.g., survey.title) need to be processed individually
      const processedRelationships = new Set<string>();
      // Collect all columns for each relationship to process them together
      const relationshipColumns = new Map<string, string[]>();

      // First pass: collect relationship columns
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
            // This is a relationship column - collect all columns for this relationship
            const relationshipKey = parts[0];
            if (relationshipKey && !processedRelationships.has(relationshipKey)) {
              if (!relationshipColumns.has(relationshipKey)) {
                relationshipColumns.set(relationshipKey, []);
              }
              const cols = relationshipColumns.get(relationshipKey);
              if (cols) {
                cols.push(columnId);
              }
            }
          }
        } else {
          // Direct column - process normally
          this.processColumn(nestedRecord, columnId, records, primaryTable);
        }
      }

      // Second pass: process all columns for each relationship together
      for (const [relationshipKey, cols] of relationshipColumns) {
        if (!processedRelationships.has(relationshipKey)) {
          // Process the first column to initialize the relationship
          // This will extract all requested columns for the relationship
          if (cols.length > 0 && cols[0]) {
            this.processColumn(nestedRecord, cols[0], records, primaryTable, cols);
            processedRelationships.add(relationshipKey);
          }
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

    // Collect all relationship aliases that have been processed (these are nested objects now)
    const processedRelationshipAliases = new Set<string>();
    // Map relationship aliases to their raw array column names (localKey)
    // e.g., 'organizers' (alias) -> 'organizerId' (localKey), 'authors' (alias) -> 'authors' (localKey)
    const relationshipAliasToLocalKey = new Map<string, string>();
    // Map relationship aliases to their target tables for flattened field cleanup
    const relationshipAliasToTargetTable = new Map<string, string>();
    // Collect raw array column names that should be excluded when nested objects exist
    const arrayColumnsToExclude = new Set<string>();
    // Collect target tables that have been processed as relationships (for flattened field cleanup)
    const processedRelationshipTables = new Set<string>();

    if (columns && columns.length > 0) {
      for (const columnId of columns) {
        // Skip invalid column IDs
        if (!columnId || typeof columnId !== 'string') {
          continue;
        }

        const parts = columnId.split('.');
        if (parts.length > 1) {
          // This is a relationship column (e.g., 'authors.id', 'authors.name')
          try {
            const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
            const relationshipPath = columnPath.relationshipPath;
            if (columnPath.isNested && relationshipPath && relationshipPath.length > 0) {
              // Get the relationship alias (e.g., 'authors', 'organizers')
              const relationshipAlias = parts[0];
              if (relationshipAlias && relationshipAlias.trim().length > 0) {
                processedRelationshipAliases.add(relationshipAlias);

                // Get the relationship to find the raw array column name and target table
                const relationship = relationshipPath[relationshipPath.length - 1];
                if (relationship) {
                  // Map alias to localKey for array FK exclusion
                  if (relationship.localKey) {
                    relationshipAliasToLocalKey.set(relationshipAlias, relationship.localKey);
                    // Only exclude if this is an array relationship
                    if (relationship.isArray === true) {
                      arrayColumnsToExclude.add(relationship.localKey);
                    }
                  }

                  // Map alias to target table for flattened field cleanup
                  if (relationship.to) {
                    relationshipAliasToTargetTable.set(relationshipAlias, relationship.to);
                    processedRelationshipTables.add(relationship.to);
                  }
                }
              }
            }
          } catch {
            // Skip columns that fail to resolve - they may not be valid relationship paths
          }
        } else {
          // This is a direct column (e.g., 'id', 'title', 'authors')
          // Direct columns are preserved as-is, even if they might also be relationships
          // (e.g., 'authors' array column can be requested directly without 'authors.id')
          // No special processing needed here - the column will be preserved from baseRecord
        }
      }
    }

    // CRITICAL: Process all fields from nestedRecord, preserving direct columns
    // even when they might also be relationships (e.g., 'authors' array column)
    for (const [key, value] of Object.entries(nestedRecord)) {
      // Skip null/undefined keys (shouldn't happen, but defensive programming)
      if (!key || typeof key !== 'string') {
        continue;
      }

      // Exclude raw array columns when nested relationship objects are present
      // This handles cases where:
      // 1. Alias matches localKey (e.g., 'authors' -> 'authors')
      // 2. Alias differs from localKey (e.g., 'organizers' -> 'organizerId')
      // Only exclude if relationship columns were actually requested (not just the raw column)
      if (arrayColumnsToExclude.has(key)) {
        // Check if this column is the localKey for any processed relationship alias
        // AND that relationship was actually requested (not just the raw column)
        let shouldExclude = false;
        for (const [alias, localKey] of relationshipAliasToLocalKey) {
          if (localKey === key) {
            // Only exclude if relationship columns were actually requested
            // (alias is in processedRelationshipAliases, meaning we requested 'authors.id', not just 'authors')
            if (processedRelationshipAliases.has(alias)) {
              // This is a raw array column that has been converted to nested objects
              // Verify that nested objects were successfully created
              const nestedValue = nestedRecord[alias];
              if (nestedValue !== null && nestedValue !== undefined) {
                // Only exclude if nested value is a non-empty array or non-empty object
                if (Array.isArray(nestedValue)) {
                  // Exclude if array has items (nested objects were created)
                  if (nestedValue.length > 0) {
                    shouldExclude = true;
                    break;
                  }
                } else if (typeof nestedValue === 'object') {
                  // Exclude if object has properties (nested object was created)
                  if (Object.keys(nestedValue).length > 0) {
                    shouldExclude = true;
                    break;
                  }
                }
              }
            }
            // If relationship columns were NOT requested (alias not in processedRelationshipAliases),
            // then this is a direct column request (e.g., 'authors' without 'authors.id'),
            // so we should NOT exclude it - preserve the raw array column
          }
        }
        if (shouldExclude) {
          // Skip the raw array column - nested relationship objects are present
          continue;
        }
        // If shouldExclude is false, the raw array column should be preserved
        // This happens when the column is requested directly (e.g., 'authors' without 'authors.id')
        // Fall through to preserve the column
      }

      // Check if this is a flattened field from a related table
      if (flattenedFieldPattern.test(key)) {
        // This is a flattened field - check if it belongs to a processed relationship table
        // Extract table name from flattened field (e.g., "usersTable_id" -> "usersTable")
        const parts = key.split('_');
        if (parts.length >= 2) {
          const tableName = parts[0];
          if (tableName && processedRelationshipTables.has(tableName)) {
            // This flattened field belongs to a relationship that has been converted to nested objects
            // Skip it - it's been converted to a nested object
            continue;
          }
        }
      }

      // Keep this field (not a flattened field, or flattened field for unprocessed relationship)
      cleanedRecord[key] = value;
    }

    // CRITICAL: Ensure all processed relationship aliases are included in cleanedRecord
    // This ensures that nested objects/arrays are preserved even if they're empty
    // or if they weren't in the original nestedRecord iteration
    for (const alias of processedRelationshipAliases) {
      if (!(alias in cleanedRecord)) {
        // Relationship alias not in cleanedRecord - check if it exists in nestedRecord
        const nestedValue = nestedRecord[alias];
        if (nestedValue !== undefined) {
          cleanedRecord[alias] = nestedValue;
        }
      }
    }

    // Always ensure primary key is included (needed for grouping and identification)
    // CRITICAL: Primary key must always be present, even if not explicitly requested in columns
    // This ensures grouping works correctly and records can be identified
    const primaryTableSchema = this.schema[primaryTable];
    if (primaryTableSchema) {
      const primaryKeyName = this.getPrimaryKeyName(primaryTableSchema);
      if (primaryKeyName) {
        // Always try to get primary key value, prioritizing direct field, then prefixed field
        const pkValue =
          baseRecord[primaryKeyName] ??
          baseRecord[`${primaryTable}_${primaryKeyName}`] ??
          nestedRecord[primaryKeyName] ??
          cleanedRecord[primaryKeyName];

        if (pkValue !== undefined && pkValue !== null) {
          cleanedRecord[primaryKeyName] = pkValue;
        } else {
          // Last resort: try to find primary key in any of the records
          for (const record of records) {
            const value = record[primaryKeyName] || record[`${primaryTable}_${primaryKeyName}`];
            if (value !== undefined && value !== null) {
              cleanedRecord[primaryKeyName] = value;
              break;
            }
          }
        }
      }
    }

    return cleanedRecord;
  }

  /**
   * Process a single column to build nested structure
   * @param nestedRecord - The nested record being built
   * @param columnId - The column ID to process
   * @param records - Flat records to extract data from
   * @param primaryTable - The primary table for this query context
   * @param allRelationshipColumns - Optional: all columns for this relationship (for one-to-many processing)
   */
  private processColumn(
    nestedRecord: Record<string, unknown>,
    columnId: string,
    records: Record<string, unknown>[],
    primaryTable: string,
    allRelationshipColumns?: string[]
  ): void {
    // If columnId doesn't contain a dot, it's a direct column (not a relationship column)
    // Even if it's also defined as a relationship, requesting it as a direct column means
    // we want the raw value, not the nested relationship
    if (!columnId.includes('.')) {
      // Direct column - already in base record, no processing needed
      return;
    }

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
        // Pass all relationship columns so we can extract all requested fields at once
        this.processOneToManyColumn(nestedRecord, columnPath, records, allRelationshipColumns);
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
    // CRITICAL: Extract relationship alias from column ID, not from columnPath.table
    // columnPath.table contains the actual table name, not the alias
    const columnId = columnPath.columnId || '';
    const alias: string = columnId.includes('.')
      ? columnId.split('.')[0] || ''
      : columnPath.table || '';

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
   * @param allRelationshipColumns - Optional: all columns requested for this relationship (e.g., ['authors.id', 'authors.name'])
   */
  private processOneToManyColumn(
    nestedRecord: Record<string, unknown>,
    columnPath: ColumnPath,
    records: Record<string, unknown>[],
    allRelationshipColumns?: string[]
  ): void {
    const relationshipPath = columnPath.relationshipPath;
    if (!relationshipPath || relationshipPath.length === 0) return;

    const relationship = relationshipPath[relationshipPath.length - 1];
    if (!relationship) return;

    const realTableName = relationship.to;
    // CRITICAL: Extract relationship alias from column ID or allRelationshipColumns
    // columnPath.table contains the actual table name (e.g., 'users'), not the alias (e.g., 'authors')
    // For 'authors.id', the alias is 'authors', which is the first part of the column ID
    let alias: string = columnPath.table || '';
    if (allRelationshipColumns && allRelationshipColumns.length > 0) {
      // Extract alias from first relationship column (e.g., 'authors.id' -> 'authors')
      const firstColumn = allRelationshipColumns[0];
      if (firstColumn?.includes('.')) {
        alias = firstColumn.split('.')[0] as string;
      }
    } else if (columnPath.columnId?.includes('.')) {
      alias = columnPath.columnId.split('.')[0] as string;
    }

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
      // CRITICAL: Try multiple ways to find the primary key value
      const pkFlatKey = generateAlias(relationshipPath, primaryKeyName);
      // CRITICAL: Only use the flattened field name from generateAlias
      // Do NOT fallback to main table's primary key - that would be wrong!
      const relatedKeyValue = record[pkFlatKey];
      const relatedKey = String(relatedKeyValue ?? '');

      // Process record if we have a valid primary key
      // Only process if primary key is not null/undefined/empty
      // CRITICAL: Check both the string value and the original value to ensure we don't process null/empty keys
      if (
        relatedKey &&
        relatedKey !== 'undefined' &&
        relatedKey !== 'null' &&
        relatedKey !== '' &&
        relatedKeyValue !== null &&
        relatedKeyValue !== undefined
      ) {
        if (!relatedRecords.has(relatedKey)) {
          relatedRecords.set(relatedKey, {});
        }

        const relatedData = relatedRecords.get(relatedKey);
        if (!relatedData) continue;

        // Extract columns for this relationship
        // If allRelationshipColumns is provided, extract only those columns
        // Otherwise, extract all columns from the schema that are present in the record
        if (allRelationshipColumns && allRelationshipColumns.length > 0) {
          // Extract only requested columns for this relationship
          // CRITICAL: Always include primary key for identification and grouping
          const relatedPrimaryKeyName = this.getPrimaryKeyName(relatedTableSchema);
          if (relatedPrimaryKeyName) {
            const pkFlatKeyForExtract = generateAlias(relationshipPath, relatedPrimaryKeyName);
            // CRITICAL: Only use the flattened field name from generateAlias
            // Do NOT fallback to main table's primary key - that would be wrong!
            const pkValue = record[pkFlatKeyForExtract];
            if (pkValue !== undefined && pkValue !== null) {
              relatedData[relatedPrimaryKeyName] = pkValue;
            }
          }

          // Extract requested columns
          for (const relColumnId of allRelationshipColumns) {
            const relParts = relColumnId.split('.');
            if (relParts.length >= 2) {
              const fieldName = relParts.slice(1).join('.'); // Get field name (e.g., 'id', 'name')
              // Skip if already extracted as primary key
              if (fieldName === relatedPrimaryKeyName) continue;

              const flatKey = generateAlias(relationshipPath, fieldName);
              // Only extract if the value is defined and not null
              if (record[flatKey] !== undefined && record[flatKey] !== null) {
                relatedData[fieldName] = record[flatKey];
              }
            }
          }
        } else {
          // Fallback: extract all columns from schema that are present in the record
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
      } else if (allRelationshipColumns && allRelationshipColumns.length > 0) {
        // Even if primary key is missing, try to extract relationship columns
        // This handles edge cases where primary key might not be in the record
        // First, check if we have any non-null relationship column values
        let hasNonNullValues = false;
        for (const relColumnId of allRelationshipColumns) {
          const relParts = relColumnId.split('.');
          if (relParts.length >= 2) {
            const fieldName = relParts.slice(1).join('.');
            const flatKey = generateAlias(relationshipPath, fieldName);
            if (record[flatKey] !== undefined && record[flatKey] !== null) {
              hasNonNullValues = true;
              break;
            }
          }
        }

        // Only create a temporary record if we have non-null values
        if (hasNonNullValues) {
          const tempKey = `__temp_${relatedRecords.size}`;
          if (!relatedRecords.has(tempKey)) {
            relatedRecords.set(tempKey, {});
          }
          const relatedData = relatedRecords.get(tempKey);
          if (relatedData) {
            // Extract requested columns
            for (const relColumnId of allRelationshipColumns) {
              const relParts = relColumnId.split('.');
              if (relParts.length >= 2) {
                const fieldName = relParts.slice(1).join('.');
                const flatKey = generateAlias(relationshipPath, fieldName);
                if (record[flatKey] !== undefined && record[flatKey] !== null) {
                  relatedData[fieldName] = record[flatKey];
                }
              }
            }
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
    // Always create an empty array if no valid records exist (relationship columns were requested)
    // CRITICAL: Always set nestedRecord[alias] even if validRecords is empty
    // This ensures the relationship is present in the output (as empty array) when columns were requested
    if (isArrayRelationship) {
      // For array relationships, we might have multiple records with the same primary key
      // representing different array elements. The Map already deduplicates by key,
      // but we need to ensure we're getting all the data.
      nestedRecord[alias] = validRecords.length > 0 ? validRecords : [];
    } else {
      // For one-to-many relationships, create empty array when relationship columns are requested
      // but no data exists (indicates relationship columns were requested but all values are null)
      nestedRecord[alias] = validRecords.length > 0 ? validRecords : [];
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
