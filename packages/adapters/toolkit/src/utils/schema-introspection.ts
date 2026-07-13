/**
 * @fileoverview ORM-agnostic primary key introspection
 * @module @better-tables/adapters-toolkit/utils/schema-introspection
 *
 * @description
 * Provides utilities for extracting primary key information from adapter table
 * schemas. These utilities are essential for the adapter to understand how to:
 * - Join tables correctly using primary and foreign keys
 * - Group and transform data from SQL joins
 * - Validate that tables have proper key constraints
 *
 * The module supports both single-column and composite primary keys, as well as
 * custom primary key column names for flexibility with different naming conventions.
 *
 * ORM-specific column introspection (e.g. reading Drizzle's internal column
 * metadata) is NOT implemented here — callers pass a
 * {@link SchemaIntrospectionPort} that knows how to read their own table
 * objects. This keeps the toolkit free of any ORM client dependency.
 */

import type { PrimaryKeyInfo, SchemaIntrospectionPort } from '../types';

/**
 * Get primary key information from a table schema.
 *
 * @description
 * Introspects the table schema to find and return information about the primary key column(s).
 * Supports both single-column and composite primary keys. Optionally accepts a custom
 * primary key name to override the default behavior.
 *
 * @param tableSchema - The table schema to introspect
 * @param port - Adapter-supplied introspection port (knows how to read `tableSchema`)
 * @param customKeyName - Optional custom primary key column name to use
 * @returns Primary key information, or `null` if no primary key found
 *
 * @example
 * ```typescript
 * // Get auto-detected primary key
 * const pkInfo = getPrimaryKeyInfo(users, drizzleSchemaPort);
 * // Returns: { columnName: 'id', column: ..., isComposite: false }
 *
 * // Use a custom primary key name
 * const customPkInfo = getPrimaryKeyInfo(users, drizzleSchemaPort, 'uuid');
 * // Returns: { columnName: 'uuid', column: ..., isComposite: false }
 * ```
 *
 * @see {@link PrimaryKeyInfo} for the structure of returned objects
 *
 * @remarks
 * This function is critical for the adapter's query building and data transformation
 * processes. Without proper primary key detection, the adapter cannot correctly join
 * tables or group related records after SQL joins.
 */
export function getPrimaryKeyInfo<TTable, TColumn = unknown>(
  tableSchema: TTable,
  port: SchemaIntrospectionPort<TTable, TColumn>,
  customKeyName?: string
): PrimaryKeyInfo<TColumn> | null {
  if (!tableSchema || typeof tableSchema !== 'object') {
    return null;
  }

  const tableObj = tableSchema as unknown as Record<string, TColumn>;

  // If custom key name is provided, use it
  if (customKeyName && tableObj[customKeyName] !== undefined) {
    return {
      columnName: customKeyName,
      column: tableObj[customKeyName] as TColumn,
      isComposite: false,
    };
  }

  // Use the adapter's own schema introspection
  const primaryKeyColumns = port.getPrimaryKeyColumns(tableSchema);

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
 * Introspects an entire schema to extract primary key information for all tables
 * at once. This creates a map that the adapter uses extensively for join operations
 * and data grouping throughout the query execution pipeline.
 *
 * @param schema - The complete schema containing all tables
 * @param port - Adapter-supplied introspection port (knows how to read each table)
 * @param tableKeys - Optional map of table names to custom primary key names
 * @returns A map of table names to their primary key information
 *
 * @example
 * ```typescript
 * const schema = { users, profiles, posts };
 * const customKeys = {
 *   posts: 'postId', // Use 'postId' instead of auto-detected key
 * };
 *
 * const primaryKeyMap = getPrimaryKeyMap(schema, drizzleSchemaPort, customKeys);
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
 * @remarks
 * This function is called once during adapter initialization to build the primary key
 * map that's used throughout the adapter's lifetime. It's more efficient than calling
 * `getPrimaryKeyInfo` multiple times because it processes all tables at once.
 */
export function getPrimaryKeyMap<TTable, TColumn = unknown>(
  schema: Record<string, TTable>,
  port: SchemaIntrospectionPort<TTable, TColumn>,
  tableKeys?: Record<string, string>
): Record<string, PrimaryKeyInfo<TColumn>> {
  const primaryKeyMap: Record<string, PrimaryKeyInfo<TColumn>> = {};

  for (const [tableName, tableSchema] of Object.entries(schema)) {
    const customKeyName = tableKeys?.[tableName];
    const primaryKeyInfo = getPrimaryKeyInfo(tableSchema, port, customKeyName);

    if (primaryKeyInfo) {
      primaryKeyMap[tableName] = primaryKeyInfo;
    }
  }

  return primaryKeyMap;
}
