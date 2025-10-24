import type { AnyColumnType, AnyTableType, PrimaryKeyInfo } from '../types';
import { getPrimaryKeyColumns } from './drizzle-schema-utils';

/**
 * Introspect primary key information from a Drizzle table schema
 * Uses Drizzle's built-in schema metadata instead of guessing
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
 * Get primary key info for multiple tables
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
