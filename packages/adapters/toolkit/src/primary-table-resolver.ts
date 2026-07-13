/**
 * @fileoverview ORM-agnostic primary table resolution
 * @module @better-tables/adapters-toolkit/primary-table-resolver
 *
 * @description
 * Handles the determination of the primary table for queries when not explicitly specified.
 * This class implements improved heuristics to correctly identify the primary table,
 * especially when dealing with JSONB accessor columns or ambiguous column names.
 *
 * Key features:
 * - Explicit primary table support (when provided, uses it directly)
 * - Smart heuristics for automatic determination
 * - Prefers tables with the most matching direct columns
 * - Handles relationship columns correctly
 * - Only searches other tables when truly ambiguous
 *
 * Column existence is checked structurally (an own, non-`_`-prefixed,
 * object-valued property on the table) rather than through an ORM-specific
 * column API. This is exactly what every adapter's own "does this table have
 * a column named X" check reduces to, so no adapter port is required here —
 * `TTable` stays fully opaque to this class.
 *
 * @example
 * ```typescript
 * const resolver = new PrimaryTableResolver(schema, relationships);
 *
 * // Explicit primary table
 * const table1 = resolver.resolve(['title', 'slug'], 'surveys');
 * // Returns: 'surveys'
 *
 * // Automatic determination
 * const table2 = resolver.resolve(['id', 'slug', 'status']);
 * // Returns: table with most matching columns
 * ```
 *
 * @since 1.0.0
 */

import { SchemaError } from './types';

/**
 * Minimal relationship-map shape `PrimaryTableResolver` needs: it only ever
 * reads the map's *keys* (`"<sourceTable>.<alias>"`), never the relationship
 * path values, so adapters can pass their own richer relationship map as-is.
 */
export type RelationshipMapLike = Record<string, unknown>;

/**
 * Primary table resolver that determines the primary table for queries.
 *
 * @class PrimaryTableResolver
 * @description Resolves the primary table using explicit specification or smart heuristics
 *
 * @property schema - The schema containing all tables, keyed by table name
 * @property relationships - Map of all relationships (keys only are read)
 *
 * @example
 * ```typescript
 * const resolver = new PrimaryTableResolver(schema, relationships);
 * const primaryTable = resolver.resolve(columns, explicitPrimaryTable);
 * ```
 *
 * @since 1.0.0
 */
export class PrimaryTableResolver<TTable = unknown> {
  private schema: Record<string, TTable>;
  private relationships: RelationshipMapLike;

  constructor(schema: Record<string, TTable>, relationships: RelationshipMapLike) {
    this.schema = schema;
    this.relationships = relationships;
  }

  /**
   * Structural column-existence check: true if `table` has an own,
   * non-`_`-prefixed property named `columnName` whose value is an object.
   * Mirrors the duck-typed check every ORM's column metadata satisfies
   * (columns are objects; internal bookkeeping keys are `_`-prefixed).
   */
  private hasColumn(table: TTable, columnName: string): boolean {
    if (!table || typeof table !== 'object') {
      return false;
    }
    if (columnName.startsWith('_')) {
      return false;
    }
    const value = (table as unknown as Record<string, unknown>)[columnName];
    return typeof value === 'object' && value !== null;
  }

  /**
   * Resolve the primary table from columns or explicit specification.
   *
   * @description
   * If an explicit primary table is provided, it is used directly.
   * Otherwise, uses improved heuristics to determine the primary table:
   * 1. Counts direct column matches for each table
   * 2. Prefers tables with the most matching direct columns
   * 3. Handles relationship columns correctly
   * 4. Only falls back to first table when truly ambiguous
   *
   * @param {string[]} [columns] - Array of column identifiers (e.g., ['email', 'profile.bio'])
   * @param {string} [explicitPrimaryTable] - Explicit primary table specification
   * @returns {string} The name of the primary table
   *
   * @throws {SchemaError} If no tables are found in the schema
   * @throws {SchemaError} If explicit primary table is provided but doesn't exist in schema
   *
   * @example
   * ```typescript
   * // Explicit primary table
   * const table = resolver.resolve(['title', 'slug'], 'surveys');
   * // Returns: 'surveys'
   *
   * // Automatic determination
   * const table = resolver.resolve(['id', 'slug', 'status']);
   * // Returns: table with most matching direct columns
   * ```
   *
   * @since 1.0.0
   */
  resolve(columns?: string[], explicitPrimaryTable?: string): string {
    // If explicit primary table is provided, validate and use it
    if (explicitPrimaryTable) {
      if (!this.schema[explicitPrimaryTable]) {
        throw new SchemaError(`Primary table '${explicitPrimaryTable}' not found in schema`, {
          explicitPrimaryTable,
          availableTables: Object.keys(this.schema),
        });
      }
      return explicitPrimaryTable;
    }

    // If no columns specified, use the first table in schema
    if (!columns || columns.length === 0) {
      return this.getFirstTable();
    }

    // Use improved heuristics to determine primary table
    return this.findTableWithMostMatches(columns);
  }

  /**
   * Count how many direct columns from the given array match a specific table.
   *
   * @description
   * Only counts columns that are direct matches (not relationship columns).
   * This helps identify which table has the most relevant columns.
   *
   * @param {string} tableName - The table name to check
   * @param {string[]} columns - Array of column identifiers
   * @returns {number} Count of matching direct columns
   *
   * @example
   * ```typescript
   * const count = resolver.countDirectColumnMatches('surveys', ['id', 'slug', 'title']);
   * // Returns: 2 (if 'id' and 'slug' exist in surveys, but 'title' doesn't)
   * ```
   *
   * @since 1.0.0
   * @private
   */
  private countDirectColumnMatches(tableName: string, columns: string[]): number {
    const tableSchema = this.schema[tableName];
    if (!tableSchema) {
      return 0;
    }

    let count = 0;

    for (const columnId of columns) {
      const parts = columnId.split('.');
      if (parts.length === 1) {
        // Direct column - check if it exists in this table
        const fieldName = parts[0];
        if (fieldName && this.hasColumn(tableSchema, fieldName)) {
          count++;
        }
      } else if (parts.length >= 2) {
        // Relationship column - check if the source table matches
        const tableAlias = parts[0];
        if (tableAlias) {
          // Find the source table from relationships
          for (const [relKey] of Object.entries(this.relationships)) {
            if (relKey.endsWith(`.${tableAlias}`)) {
              const sourceTable = relKey.split('.')[0];
              if (sourceTable === tableName) {
                count++;
                // Only stop once we've credited this table — a matching alias
                // under a different source table must not abort the scan.
                break;
              }
            }
          }
        }
      }
    }

    return count;
  }

  /**
   * Find the table with the most matching direct columns.
   *
   * @description
   * Improved heuristics:
   * 1. Counts direct column matches for each table
   * 2. Prefers tables with the most matching direct columns
   * 3. Only searches other tables when truly ambiguous (no clear winner)
   * 4. Falls back to first table if no matches found
   *
   * @param {string[]} columns - Array of column identifiers
   * @returns {string} The name of the primary table
   *
   * @throws {SchemaError} If no tables are found in the schema
   *
   * @example
   * ```typescript
   * const table = resolver.findTableWithMostMatches(['id', 'slug', 'status']);
   * // Returns: table with most matching columns
   * ```
   *
   * @since 1.0.0
   * @private
   */
  private findTableWithMostMatches(columns: string[]): string {
    const tableCounts = new Map<string, number>();

    // Count direct column matches for each table
    for (const tableName of Object.keys(this.schema)) {
      const count = this.countDirectColumnMatches(tableName, columns);
      if (count > 0) {
        tableCounts.set(tableName, count);
      }
    }

    // Find the table with the most matches
    let primaryTable = '';
    let maxCount = 0;
    for (const [tableName, count] of tableCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryTable = tableName;
      }
    }

    // If we have a clear winner (at least one match), use it
    if (primaryTable && maxCount > 0) {
      return primaryTable;
    }

    // Fallback to first table if no matches found
    // This handles cases where all columns are accessor-based (e.g., JSONB)
    // and don't match any direct schema columns
    return this.getFirstTable();
  }

  /**
   * Get the first table from the schema as a fallback.
   *
   * @description
   * Returns the first table in the schema when no better determination can be made.
   * This is used as a last resort fallback.
   *
   * @returns {string} The name of the first table
   *
   * @throws {SchemaError} If no tables are found in the schema
   *
   * @since 1.0.0
   * @private
   */
  private getFirstTable(): string {
    const tableNames = Object.keys(this.schema);
    if (tableNames.length === 0) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }
    const firstTable = tableNames[0];
    if (!firstTable) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }
    return firstTable;
  }
}
