/**
 * @fileoverview Schema introspection utilities for Drizzle ORM
 * @module @better-tables/drizzle-adapter/utils/drizzle-schema-utils
 *
 * @description
 * Provides utilities for introspecting Drizzle table schemas to extract column
 * information, metadata, and relationships. These utilities leverage Drizzle's
 * built-in schema metadata instead of guessing or parsing table structures manually.
 *
 * Key capabilities:
 * - Extract all columns from any Drizzle table schema
 * - Identify primary key columns
 * - Identify foreign key columns
 * - Get column metadata (nullable, data type, etc.)
 * - Check column existence and get specific column info
 *
 * This module is crucial for the adapter to work with any Drizzle schema without
 * requiring additional configuration from users.
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 * import { getColumnNames, getPrimaryKeyColumns } from './drizzle-schema-utils';
 *
 * // Get all column names
 * const columns = getColumnNames(users); // ['id', 'email', 'name', 'created_at']
 *
 * // Get primary key information
 * const primaryKeys = getPrimaryKeyColumns(users); // [{ name: 'id', ... }]
 *
 * // Check if a column exists
 * const hasEmail = hasColumn(users, 'email'); // true
 * ```
 *
 * @remarks
 * These utilities work by accessing Drizzle's internal schema metadata through
 * the table object's properties. They skip internal properties (those starting
 * with '_') and access column metadata directly from the column objects.
 */

import type { AnyColumn } from 'drizzle-orm';
import type { AnyColumnType, AnyTableType } from '../types';

/**
 * Information about a column in a Drizzle table schema.
 *
 * @interface ColumnInfo
 *
 * @property {string} name - The name of the column
 * @property {AnyColumnType} column - The Drizzle column object
 * @property {boolean} isPrimaryKey - Whether this column is a primary key
 * @property {boolean} isForeignKey - Whether this column is a foreign key
 * @property {boolean} isNullable - Whether this column allows null values
 * @property {string} dataType - The data type of the column (e.g., 'string', 'number', 'date')
 */
export interface ColumnInfo {
  name: string;
  column: AnyColumnType;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  dataType: string;
}

/**
 * Extract all column information from a Drizzle table schema.
 *
 * This function introspects the Drizzle table schema to extract metadata about
 * all columns, including their names, data types, and key constraints. It safely
 * accesses the table's internal metadata to provide a structured view of the schema.
 *
 * @description
 * Iterates through all non-internal properties of the table schema (skipping properties
 * that start with '_'), extracts metadata from each column object, and returns a comprehensive
 * list of column information. This is the foundation for all other introspection functions.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to introspect
 * @returns {ColumnInfo[]} An array of column information objects
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * const columns = getTableColumns(users);
 * // Returns:
 * // [
 * //   { name: 'id', column: ..., isPrimaryKey: true, isForeignKey: false, ... },
 * //   { name: 'email', column: ..., isPrimaryKey: false, isForeignKey: false, ... },
 * //   ...
 * // ]
 * ```
 *
 * @returns {ColumnInfo[]} An array of column information objects, or an empty array if the table schema is invalid or malformed
 *
 * @see {@link ColumnInfo} for the structure of returned objects
 *
 * @since 1.0.0
 *
 * @remarks
 * This function is used internally by all other introspection functions. It safely handles
 * malformed or invalid schemas by returning an empty array rather than throwing errors.
 * It never throws - if the schema is invalid, it returns an empty array instead.
 */
export function getTableColumns(tableSchema: AnyTableType): ColumnInfo[] {
  if (!tableSchema || typeof tableSchema !== 'object') {
    return [];
  }

  const tableObj = tableSchema as unknown as Record<string, AnyColumnType>;
  const columns: ColumnInfo[] = [];

  // Extract from table object properties directly
  // Drizzle columns have metadata directly on the column objects
  for (const [columnName, column] of Object.entries(tableObj)) {
    if (columnName.startsWith('_')) continue; // Skip Drizzle internal properties

    if (typeof column === 'object' && column !== null) {
      const drizzleColumn = column as AnyColumn;

      columns.push({
        name: columnName,
        column: column,
        isPrimaryKey: drizzleColumn.primary === true,
        isForeignKey: 'references' in drizzleColumn && drizzleColumn.references !== undefined,
        isNullable: drizzleColumn.notNull !== true,
        dataType: drizzleColumn.dataType || 'unknown',
      });
    }
  }

  return columns;
}

/**
 * Get all primary key columns from a Drizzle table schema.
 *
 * @description
 * Filters the table columns to return only those that are marked as primary keys.
 * This is essential for the adapter to understand which column(s) uniquely identify
 * rows in the table, which is critical for join operations and data transformation.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to check
 * @returns {ColumnInfo[]} An array of primary key column information objects
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * const primaryKeys = getPrimaryKeyColumns(users);
 * // Returns: [{ name: 'id', isPrimaryKey: true, ... }]
 *
 * // For composite primary keys:
 * const primaryKeys = getPrimaryKeyColumns(relations);
 * // Returns: [{ name: 'user_id', ... }, { name: 'role_id', ... }]
 * ```
 *
 * @see {@link getTableColumns} for the underlying implementation
 * @since 1.0.0
 */
export function getPrimaryKeyColumns(tableSchema: AnyTableType): ColumnInfo[] {
  return getTableColumns(tableSchema).filter((col) => col.isPrimaryKey);
}

/**
 * Get all foreign key columns from a Drizzle table schema.
 *
 * @description
 * Filters the table columns to return only those that reference other tables.
 * These columns are typically used in relationship definitions and join conditions.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to check
 * @returns {ColumnInfo[]} An array of foreign key column information objects
 *
 * @example
 * ```typescript
 * import { posts } from './schema';
 *
 * const foreignKeys = getForeignKeyColumns(posts);
 * // Returns: [{ name: 'user_id', isForeignKey: true, ... }]
 * ```
 *
 * @see {@link getTableColumns} for the underlying implementation
 * @since 1.0.0
 */
export function getForeignKeyColumns(tableSchema: AnyTableType): ColumnInfo[] {
  return getTableColumns(tableSchema).filter((col) => col.isForeignKey);
}

/**
 * Get all column names from a Drizzle table schema.
 *
 * @description
 * Extracts just the names of all columns in the table. This is a lightweight
 * utility for quickly getting an overview of what fields are available in a table.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to introspect
 * @returns {string[]} An array of column names
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * const columnNames = getColumnNames(users);
 * // Returns: ['id', 'email', 'name', 'created_at', 'updated_at']
 * ```
 *
 * @see {@link getTableColumns} for the underlying implementation
 * @since 1.0.0
 *
 * @remarks
 * This is one of the most commonly used functions in the adapter for validating
 * column access and building queries with explicit column selections.
 */
export function getColumnNames(tableSchema: AnyTableType): string[] {
  return getTableColumns(tableSchema).map((col) => col.name);
}

/**
 * Check if a column exists in a table schema.
 *
 * @description
 * Quickly determines whether a specific column name exists in the table.
 * This is used throughout the adapter for validation and error checking.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to check
 * @param {string} columnName - The name of the column to check for
 * @returns {boolean} `true` if the column exists, `false` otherwise
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * if (hasColumn(users, 'email')) {
 *   console.log('Email column exists');
 * }
 *
 * if (hasColumn(users, 'nonexistent')) {
 *   // This won't execute
 * }
 * ```
 *
 * @see {@link getColumnNames} for the underlying implementation
 * @since 1.0.0
 */
export function hasColumn(tableSchema: AnyTableType, columnName: string): boolean {
  return getColumnNames(tableSchema).includes(columnName);
}

/**
 * Get detailed information about a specific column in a table schema.
 *
 * @description
 * Retrieves complete information about a single column including its metadata,
 * data type, constraints, and the actual Drizzle column object.
 *
 * @param {AnyTableType} tableSchema - The Drizzle table schema to search
 * @param {string} columnName - The name of the column to retrieve
 * @returns {ColumnInfo | null} The column information object, or `null` if not found
 *
 * @example
 * ```typescript
 * import { users } from './schema';
 *
 * const emailInfo = getColumnInfo(users, 'email');
 * // Returns: { name: 'email', column: ..., isPrimaryKey: false, ... }
 *
 * const badInfo = getColumnInfo(users, 'nonexistent');
 * // Returns: null
 * ```
 *
 * @see {@link ColumnInfo} for the structure of returned objects
 * @see {@link getTableColumns} for the underlying implementation
 * @since 1.0.0
 */
export function getColumnInfo(tableSchema: AnyTableType, columnName: string): ColumnInfo | null {
  const columns = getTableColumns(tableSchema);
  return columns.find((col) => col.name === columnName) || null;
}
