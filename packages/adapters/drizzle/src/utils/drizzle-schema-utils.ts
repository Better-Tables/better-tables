import type { AnyColumn } from 'drizzle-orm';
import type { AnyColumnType, AnyTableType } from '../types';

/**
 * Drizzle schema introspection utilities
 * Leverages Drizzle's built-in schema metadata instead of guessing
 */

/**
 * Extract column information from a Drizzle table schema
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
 * Extract all column information from a Drizzle table
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
 * Get primary key columns from a Drizzle table
 */
export function getPrimaryKeyColumns(tableSchema: AnyTableType): ColumnInfo[] {
  return getTableColumns(tableSchema).filter((col) => col.isPrimaryKey);
}

/**
 * Get foreign key columns from a Drizzle table
 */
export function getForeignKeyColumns(tableSchema: AnyTableType): ColumnInfo[] {
  return getTableColumns(tableSchema).filter((col) => col.isForeignKey);
}

/**
 * Get all column names from a Drizzle table
 */
export function getColumnNames(tableSchema: AnyTableType): string[] {
  return getTableColumns(tableSchema).map((col) => col.name);
}

/**
 * Check if a column exists in a table
 */
export function hasColumn(tableSchema: AnyTableType, columnName: string): boolean {
  return getColumnNames(tableSchema).includes(columnName);
}

/**
 * Get column information for a specific column
 */
export function getColumnInfo(tableSchema: AnyTableType, columnName: string): ColumnInfo | null {
  const columns = getTableColumns(tableSchema);
  return columns.find((col) => col.name === columnName) || null;
}
