/**
 * @fileoverview Primary key introspection for Drizzle ORM tables
 * @module @better-tables/drizzle-adapter/utils/schema-introspection
 *
 * @description
 * Provides utilities for extracting primary key information from Drizzle table schemas.
 * These utilities are essential for the adapter to understand how to:
 * - Join tables correctly using primary and foreign keys
 * - Group and transform data from SQL joins
 * - Validate that tables have proper key constraints
 *
 * The module supports both single-column and composite primary keys, as well as
 * custom primary key column names for flexibility with different naming conventions.
 */

import type { AnyColumnType, AnyTableType, PrimaryKeyInfo } from '../types';
import { getPrimaryKeyColumns } from './drizzle-schema-utils';

/**
 * Get primary key information from a Drizzle table schema.
 *
 * @description
 * Introspects the table schema to find and return information about the primary key column(s).
 * Supports both single-column and composite primary keys. Optionally accepts a custom
 * primary key name to override the default behavior.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to introspect
 * @param {string} [customKeyName] - Optional custom primary key column name to use
 * @returns {PrimaryKeyInfo | null} Primary key information, or `null` if no primary key found
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * // Get auto-detected primary key
 * const pkInfo = getPrimaryKeyInfo(users);
 * // Returns: { columnName: 'id', column: ..., isComposite: false }
 *
 * // Use a custom primary key name
 * const customPkInfo = getPrimaryKeyInfo(users, 'uuid');
 * // Returns: { columnName: 'uuid', column: ..., isComposite: false }
 *
 * // For composite keys
 * const compositePkInfo = getPrimaryKeyInfo(userRoles);
 * // Returns: { columnName: 'user_id', column: ..., isComposite: true }
 * ```
 *
 * @see {@link PrimaryKeyInfo} for the structure of returned objects
 * @see {@link getPrimaryKeyColumns} for the underlying column detection
 *
 * @since 1.0.0
 *
 * @remarks
 * This function is critical for the adapter's query building and data transformation
 * processes. Without proper primary key detection, the adapter cannot correctly join
 * tables or group related records after SQL joins.
 */
export function getPrimaryKeyInfo(
  tableSchema: AnyTableType,
  customKeyName?: string
): PrimaryKeyInfo | null {
  if (!tableSchema || typeof tableSchema !== 'object') {
    return null;
  }

  const tableObj = tableSchema as unknown as Record<string, AnyColumnType>;

  // If custom key name is provided, use it
  if (customKeyName && tableObj[customKeyName]) {
    return {
      columnName: customKeyName,
      column: tableObj[customKeyName],
      isComposite: false,
    };
  }

  // Use Drizzle's built-in schema introspection
  const primaryKeyColumns = getPrimaryKeyColumns(tableSchema);

  if (primaryKeyColumns.length > 0) {
    const primaryKey = primaryKeyColumns[0]; // Take the first primary key
    if (!primaryKey) {
      return null;
    }
    return {
      columnName: primaryKey.name,
      column: primaryKey.column,
      isComposite: primaryKeyColumns.length > 1,
    };
  }

  return null;
}

/**
 * Get primary key information for all tables in a schema.
 *
 * @description
 * Introspects an entire Drizzle schema to extract primary key information for all tables
 * at once. This creates a map that the adapter uses extensively for join operations
 * and data grouping throughout the query execution pipeline.
 *
 * @param {Record<string, AnyTableType>} schema - The complete Drizzle schema containing all tables
 * @param {Record<string, string>} [tableKeys] - Optional map of table names to custom primary key names
 * @returns {Record<string, PrimaryKeyInfo>} A map of table names to their primary key information
 *
 * @example
 * ```typescript
 * const schema = { users, profiles, posts };
 * const customKeys = {
 *   posts: 'postId', // Use 'postId' instead of auto-detected key
 * };
 *
 * const primaryKeyMap = getPrimaryKeyMap(schema, customKeys);
 * // Returns:
 * // {
 * //   users: { columnName: 'id', ... },
 * //   profiles: { columnName: 'id', ... },
 * //   posts: { columnName: 'postId', ... }
 * // }
 * ```
 *
 * @see {@link PrimaryKeyInfo} for the structure of map values
 * @see {@link getPrimaryKeyInfo} for single-table introspection
 *
 * @since 1.0.0
 *
 * @remarks
 * This function is called once during adapter initialization to build the primary key
 * map that's used throughout the adapter's lifetime. It's more efficient than calling
 * `getPrimaryKeyInfo` multiple times because it processes all tables at once.
 */
export function getPrimaryKeyMap(
  schema: Record<string, AnyTableType>,
  tableKeys?: Record<string, string>
): Record<string, PrimaryKeyInfo> {
  const primaryKeyMap: Record<string, PrimaryKeyInfo> = {};

  for (const [tableName, tableSchema] of Object.entries(schema)) {
    const customKeyName = tableKeys?.[tableName];
    const primaryKeyInfo = getPrimaryKeyInfo(tableSchema, customKeyName);

    if (primaryKeyInfo) {
      primaryKeyMap[tableName] = primaryKeyInfo;
    }
  }

  return primaryKeyMap;
}
