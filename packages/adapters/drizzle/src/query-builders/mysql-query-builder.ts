/**
 * @fileoverview MySQL-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/mysql
 *
 * @description
 * MySQL query builder implementation with driver-specific optimizations.
 * The select/count/aggregate/filter-options/min-max skeletons live in
 * `BaseQueryBuilder` (plan 007 step 5); this class supplies only the
 * MySQL-specific pieces: JSON-array join syntax, `JSON_EXTRACT` column
 * selections, and the backtick identifier quote character.
 *
 * Supports all MySQL-compatible Drizzle drivers:
 * - mysql2 (MySql2Database)
 *
 * @since 1.0.0 (expanded to support all MySQL drivers in 1.1.0)
 */

import { type SQL, sql } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import type { RelationshipManager } from '../relationship-manager';
import type { AnyColumnType, AnyTableType, FilterHandlerHooks, MySqlDatabaseType } from '../types';
import { BaseQueryBuilder, type DialectDb } from './base-query-builder';

/**
 * MySQL query builder implementation.
 *
 * Supports all MySQL-compatible Drizzle drivers:
 * - mysql2 (MySql2Database)
 *
 * @class MySQLQueryBuilder
 * @extends {BaseQueryBuilder}
 * @since 1.0.0 (expanded to support all MySQL drivers in 1.1.0)
 */
export class MySQLQueryBuilder extends BaseQueryBuilder {
  private db: MySqlDatabaseType;

  protected readonly quoteChar = '`' as const;

  constructor(
    db: MySqlDatabaseType,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    hooks?: FilterHandlerHooks
  ) {
    super(schema, relationshipManager, 'mysql', hooks);
    this.db = db;
  }

  /**
   * Dialect hook: view the MySQL db handle through the structural DialectDb
   * interface the shared skeletons use. The cast is safe because Drizzle's
   * MySQL select builders implement every method the interface declares —
   * the previous per-call-site `asMySqlTable`/`asMySqlColumn` casts were
   * compile-time-only and this single cast replaces them all.
   */
  protected getDb(): DialectDb {
    return this.db as unknown as DialectDb;
  }

  /**
   * Type-safe helper to cast AnyColumnType to MySqlColumn.
   * At runtime, this query builder only receives MySQL columns via the factory pattern.
   */
  private asMySqlColumn(column: AnyColumnType): MySqlColumn {
    return column as MySqlColumn;
  }

  /**
   * Build join condition for array foreign keys in MySQL
   * MySQL doesn't have native array types like PostgreSQL, but supports JSON arrays
   * Uses JSON_SEARCH to check if target column value exists in source JSON array column
   * Format: JSON_SEARCH(sourceArrayColumn, 'one', targetColumn) IS NOT NULL
   *
   * Note: For MySQL 8.0.17+, could use: targetColumn MEMBER OF(sourceArrayColumn)
   * But JSON_SEARCH works in MySQL 5.7+ for better compatibility
   */
  protected buildArrayJoinCondition(
    targetColumn: AnyColumnType,
    sourceArrayColumn: AnyColumnType
  ): SQL {
    const mysqlTargetColumn = this.asMySqlColumn(targetColumn);
    const mysqlSourceArrayColumn = this.asMySqlColumn(sourceArrayColumn);

    // MySQL syntax: JSON_SEARCH(sourceArrayColumn, 'one', targetColumn) IS NOT NULL
    // This checks if the target column value exists as a scalar in the JSON array
    // 'one' means return the first match (we just need to know if it exists)
    return sql`JSON_SEARCH(${mysqlSourceArrayColumn}, 'one', ${mysqlTargetColumn}) IS NOT NULL`;
  }

  /**
   * Override buildColumnSelections to handle JSON accessor columns
   * For MySQL, we need to use JSON_EXTRACT() or -> operator to extract nested JSON fields
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
              const mysqlColumn = this.asMySqlColumn(columnReference.column);
              // Use JSON_EXTRACT to extract the nested JSON field
              // Format: JSON_EXTRACT(column, '$.field')
              const jsonExtract = sql<string>`JSON_EXTRACT(${mysqlColumn}, ${`$.${jsonField}`})`;
              selections[columnId] = jsonExtract as unknown as AnyColumnType;
            }
          }
        }
      }
    }

    return selections;
  }
}
