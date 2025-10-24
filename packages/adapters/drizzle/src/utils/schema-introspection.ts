import type { AnyColumnType, AnyTableType, PrimaryKeyInfo } from '../types';

/**
 * Introspect primary key information from a Drizzle table schema
 * This is generic and works with any table design
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

  // Try to find primary key by checking for common patterns
  // This is more robust than assuming 'id'
  const possiblePrimaryKeys = ['id', 'ID', 'Id', 'pk', 'PK', 'primaryKey', 'primary_key'];

  for (const keyName of possiblePrimaryKeys) {
    if (tableObj[keyName]) {
      return {
        columnName: keyName,
        column: tableObj[keyName],
        isComposite: false,
      };
    }
  }

  // If no common pattern found, look for any column that might be a primary key
  // This is a fallback for unusual naming conventions
  for (const [key, column] of Object.entries(tableObj)) {
    if (key.startsWith('_')) continue; // Skip Drizzle internal properties

    // Check if this looks like a primary key column
    if (typeof column === 'object' && column !== null) {
      // This is a basic heuristic - in practice, Drizzle columns have more complex structure
      // But this gives us a reasonable fallback
      if (
        key.toLowerCase().includes('id') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('pk')
      ) {
        return {
          columnName: key,
          column: column,
          isComposite: false,
        };
      }
    }
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
