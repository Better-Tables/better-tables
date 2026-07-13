/**
 * @fileoverview SQLite-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/sqlite
 *
 * @description
 * SQLite query builder implementation with driver-specific optimizations.
 * The select/count/aggregate/filter-options/min-max skeletons live in
 * `BaseQueryBuilder` (plan 007 step 5); this class supplies only the
 * SQLite-specific pieces: JSON-array join syntax, `json_extract` column
 * selections, and the identifier quote character.
 *
 * Supports all SQLite-compatible Drizzle drivers:
 * - better-sqlite3 (BetterSQLite3Database)
 * - libsql/Turso (LibSQLDatabase)
 *
 * @since 1.0.0 (expanded to support all SQLite drivers in 1.1.0)
 */

import { type SQL, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { RelationshipManager } from '../relationship-manager';
import type { AnyColumnType, AnyTableType, FilterHandlerHooks, SQLiteDatabaseType } from '../types';
import { BaseQueryBuilder, type DialectDb } from './base-query-builder';

/**
 * SQLite query builder implementation.
 *
 * Supports all SQLite-compatible Drizzle drivers:
 * - better-sqlite3 (BetterSQLite3Database)
 * - libsql/Turso (LibSQLDatabase)
 *
 * @class SQLiteQueryBuilder
 * @extends {BaseQueryBuilder}
 * @since 1.0.0 (expanded to support all SQLite drivers in 1.1.0)
 */
export class SQLiteQueryBuilder extends BaseQueryBuilder {
  private db: SQLiteDatabaseType;

  protected readonly quoteChar = '"' as const;

  constructor(
    db: SQLiteDatabaseType,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    hooks?: FilterHandlerHooks
  ) {
    super(schema, relationshipManager, 'sqlite', hooks);
    this.db = db;
  }

  /**
   * Dialect hook: view the SQLite db handle through the structural DialectDb
   * interface the shared skeletons use. The cast is safe because Drizzle's
   * SQLite select builders implement every method the interface declares —
   * the previous per-call-site `asSQLiteTable`/`asSQLiteColumn` casts were
   * compile-time-only and this single cast replaces them all.
   */
  protected getDb(): DialectDb {
    return this.db as unknown as DialectDb;
  }

  /**
   * Type-safe helper to cast AnyColumnType to SQLiteColumn.
   * At runtime, this query builder only receives SQLite columns via the factory pattern.
   */
  private asSQLiteColumn(column: AnyColumnType): SQLiteColumn {
    return column as SQLiteColumn;
  }

  /**
   * Build join condition for array foreign keys in SQLite
   * SQLite doesn't have native array types, but supports JSON arrays
   * Uses json_each to check if target column value is in source JSON array column
   * Format: EXISTS (SELECT 1 FROM json_each(sourceArrayColumn) WHERE value = targetColumn)
   */
  protected buildArrayJoinCondition(
    targetColumn: AnyColumnType,
    sourceArrayColumn: AnyColumnType
  ): SQL {
    const sqliteTargetColumn = this.asSQLiteColumn(targetColumn);
    const sqliteSourceArrayColumn = this.asSQLiteColumn(sourceArrayColumn);

    // SQLite syntax: EXISTS (SELECT 1 FROM json_each(sourceArrayColumn) WHERE value = targetColumn)
    // This checks if the target column value exists in the JSON array
    return sql`EXISTS (SELECT 1 FROM json_each(${sqliteSourceArrayColumn}) WHERE json_each.value = ${sqliteTargetColumn})`;
  }

  /**
   * Override buildColumnSelections to handle JSON accessor columns
   * For SQLite, we need to use json_extract() to extract nested JSON fields
   */
  protected buildColumnSelections(
    columns: string[],
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const baseSelections = super.buildColumnSelections(columns, primaryTable);
    const selections: Record<string, AnyColumnType> = { ...baseSelections };

    // Process each column to detect and handle JSON accessors
    for (const columnId of columns) {
      // Check if this is a JSON accessor (contains dot but isNested is false)
      if (columnId.includes('.')) {
        const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

        // If it's not nested but has a dot, it's a JSON accessor
        if (!columnPath.isNested && columnPath.field) {
          const parts = columnId.split('.');
          if (parts.length === 2) {
            const [baseColumnName, jsonField] = parts;
            const columnReference = this.relationshipManager.getColumnReference(
              columnPath,
              primaryTable
            );

            if (columnReference && baseColumnName && jsonField) {
              const sqliteColumn = this.asSQLiteColumn(columnReference.column);
              // Use json_extract to extract the nested JSON field
              // Format: json_extract(column, '$.field')
              const jsonExtract = sql<string>`json_extract(${sqliteColumn}, ${`$.${jsonField}`})`;
              selections[columnId] = jsonExtract as unknown as AnyColumnType;
            }
          }
        }
      }
    }

    return selections;
  }
}
