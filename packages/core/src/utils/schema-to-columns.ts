/**
 * @fileoverview Utility functions to convert schema information to column definitions.
 *
 * @module utils/schema-to-columns
 */

import type { ColumnDefinition } from '../types/column';
import type { SchemaColumnInfo, SchemaTableInfo } from '../types/export';

/**
 * Convert schema column information to a column definition.
 *
 * @param columnInfo - Schema column information
 * @returns Column definition
 */
export function schemaColumnToColumnDefinition<TData = Record<string, unknown>>(
  columnInfo: SchemaColumnInfo
): ColumnDefinition<TData, unknown> {
  // Create a simple accessor that gets the value from the data object
  const accessor = (data: TData): unknown => {
    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;
      return record[columnInfo.name];
    }
    return undefined;
  };

  // Determine column type from schema type
  const type = inferColumnType(columnInfo.type);

  return {
    id: columnInfo.name,
    displayName: columnInfo.name,
    accessor,
    type,
    sortable: true,
    filterable: true,
    defaultVisible: true,
    nullable: columnInfo.nullable,
  };
}

/**
 * Convert schema table information to column definitions.
 *
 * @param tableInfo - Schema table information
 * @returns Array of column definitions
 */
export function schemaTableToColumnDefinitions<TData = Record<string, unknown>>(
  tableInfo: SchemaTableInfo
): ColumnDefinition<TData, unknown>[] {
  return tableInfo.columns.map((columnInfo) => schemaColumnToColumnDefinition<TData>(columnInfo));
}

/**
 * Infer column type from schema data type.
 *
 * @param schemaType - Schema data type string
 * @returns Column type
 */
function inferColumnType(schemaType: string): ColumnDefinition['type'] {
  const lowerType = schemaType.toLowerCase();

  if (lowerType.includes('int') || lowerType.includes('number') || lowerType === 'serial') {
    return 'number';
  }
  if (lowerType.includes('bool')) {
    return 'boolean';
  }
  if (
    lowerType.includes('date') ||
    lowerType.includes('time') ||
    lowerType === 'timestamp' ||
    lowerType === 'timestamptz'
  ) {
    return 'date';
  }
  if (lowerType.includes('json') || lowerType.includes('jsonb')) {
    return 'json';
  }

  // Default to text for strings, arrays, and unknown types
  return 'text';
}
