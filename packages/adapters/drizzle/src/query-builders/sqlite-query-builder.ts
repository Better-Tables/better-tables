/**
 * @fileoverview SQLite-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/sqlite
 *
 * @description
 * SQLite query builder implementation with driver-specific optimizations.
 *
 * Supports all SQLite-compatible Drizzle drivers:
 * - better-sqlite3 (BetterSQLite3Database)
 * - libsql/Turso (LibSQLDatabase)
 *
 * @since 1.0.0 (expanded to support all SQLite drivers in 1.1.0)
 */

import { count, isNotNull, max, min, type SQL, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  ComputedFieldWithResolvedSortSql,
  FilterHandlerHooks,
  QueryContext,
  SQLiteDatabaseType,
  SQLiteQueryBuilderWithJoins,
} from '../types';
import { QueryError } from '../types';
import { generateAlias } from '../utils/alias-generator';
import { BaseQueryBuilder } from './base-query-builder';

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
   * Type-safe helper to cast AnyTableType to SQLiteTable.
   * At runtime, this query builder only receives SQLite tables via the factory pattern.
   */
  private asSQLiteTable(table: AnyTableType): SQLiteTable {
    return table as SQLiteTable;
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
   * Build SELECT query with joins
   */
  buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[],
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>
  ): {
    query: SQLiteQueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>;
    };
    isNested?: boolean; // Flag to indicate if data is already nested from relational query
  } {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const selections: Record<string, AnyColumnType> = {};
    const columnMapping: Record<string, string> = {};

    if (columns && columns.length > 0) {
      Object.assign(selections, this.buildColumnSelections(columns, primaryTable));
      for (const columnId of columns) {
        const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          const aliasedKey = generateAlias(columnPath.relationshipPath, columnPath.field);
          columnMapping[aliasedKey] = columnId;
        } else {
          columnMapping[columnId] = columnId;
        }
      }
    } else if (context.joinPaths.size > 0) {
      Object.assign(selections, this.buildFlatSelectionsForRelationships(primaryTable));
      for (const key of Object.keys(selections)) {
        columnMapping[key] = key;
      }
    }

    // Add computed field SQL expressions for sorting
    // These need to be in SELECT so they can be referenced in ORDER BY
    // Note: sortSql expressions are pre-resolved in DrizzleAdapter.fetchData before calling buildSelectQuery
    // The double type assertion (as unknown as AnyColumnType) is necessary because Drizzle's type system
    // doesn't recognize SQL expressions as valid column types, but at runtime they work correctly.
    if (computedFields) {
      for (const [fieldName, computedField] of Object.entries(computedFields)) {
        // Check that the SQL expression was resolved (should always be true at this point)
        if (computedField.__resolvedSortSql !== undefined) {
          // Use pre-resolved SQL expression (resolved in adapter)
          // Explicitly alias the SQL expression with the field name so it can be referenced in ORDER BY
          // According to Drizzle docs: sql`expression`.as('alias') adds an alias to the SQL expression
          // All SQL expressions from Drizzle support .as() method
          // Type assertion needed: Drizzle's type system doesn't accept SQL expressions as column types,
          // but they work correctly at runtime when used in SELECT clauses
          const aliasedSql = (
            computedField.__resolvedSortSql as SQL & { as: (alias: string) => SQL }
          ).as(fieldName);
          selections[fieldName] = aliasedSql as unknown as AnyColumnType;
          columnMapping[fieldName] = fieldName;
        }
      }
    }

    // Cast selections to Record<string, SQLiteColumn> for type-safe select
    const sqliteSelections = selections as Record<string, SQLiteColumn>;
    const sqliteTable = this.asSQLiteTable(primaryTableSchema);

    const baseQuery =
      Object.keys(selections).length > 0
        ? this.db.select(sqliteSelections).from(sqliteTable)
        : this.db.select().from(sqliteTable);

    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);

    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;
    for (const relationship of joinOrder) {
      const targetTable = this.schema[relationship.to];
      if (!targetTable) {
        throw new QueryError(`Target table not found: ${relationship.to}`, {
          targetTable: relationship.to,
        });
      }

      const joinCondition = this.buildJoinCondition(relationship) as SQL;
      const sqliteTargetTable = this.asSQLiteTable(targetTable);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(sqliteTargetTable, joinCondition);
      } else {
        query = query.innerJoin(sqliteTargetTable, joinCondition);
      }
    }

    return {
      query: this.asSQLiteQueryBuilder(query),
      columnMetadata: {
        selections,
        columnMapping,
      },
      isNested: false, // SQLite uses manual joins, returns flat data
    };
  }

  /**
   * Build COUNT query for pagination
   */
  buildCountQuery(context: QueryContext, primaryTable: string): SQLiteQueryBuilderWithJoins {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const sqliteTable = this.asSQLiteTable(primaryTableSchema);
    const baseQuery = this.db.select({ count: count() }).from(sqliteTable);
    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;

    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);

    for (const relationship of joinOrder) {
      const targetTable = this.schema[relationship.to];
      if (!targetTable) {
        throw new QueryError(`Target table not found: ${relationship.to}`, {
          targetTable: relationship.to,
        });
      }

      const joinCondition = this.buildJoinCondition(relationship) as SQL;
      const sqliteTargetTable = this.asSQLiteTable(targetTable);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(sqliteTargetTable, joinCondition);
      } else {
        query = query.innerJoin(sqliteTargetTable, joinCondition);
      }
    }

    return this.asSQLiteQueryBuilder(query);
  }

  /**
   * Build aggregate query for faceted values
   */
  buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction = 'count',
    primaryTable: string
  ): SQLiteQueryBuilderWithJoins {
    this.validateColumnId(columnId, primaryTable);
    this.validateAggregateFunction(aggregateFunction);

    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

    this.validateAggregateColumnCompatibility(columnReference.column, aggregateFunction);

    const mainTableSchema = this.schema[primaryTable];
    if (!mainTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const sqliteTable = this.asSQLiteTable(mainTableSchema);
    const sqliteColumn = this.asSQLiteColumn(columnReference.column);
    const aggregateFn = this.getAggregateFunction(columnReference.column, aggregateFunction) as SQL;

    const baseQuery = this.db
      .select({
        value: sqliteColumn,
        count: aggregateFn,
      })
      .from(sqliteTable);
    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    for (const joinConfig of requiredJoins) {
      const sqliteJoinTable = this.asSQLiteTable(joinConfig.table);
      const joinCondition = joinConfig.condition as SQL;

      if (joinConfig.type === 'left') {
        query = query.leftJoin(sqliteJoinTable, joinCondition);
      } else {
        query = query.innerJoin(sqliteJoinTable, joinCondition);
      }
    }

    return this.asSQLiteQueryBuilder(
      query.where(isNotNull(sqliteColumn)).groupBy(sqliteColumn).orderBy(sqliteColumn)
    );
  }

  /**
   * Build filter options query
   */
  buildFilterOptionsQuery(columnId: string, primaryTable: string): SQLiteQueryBuilderWithJoins {
    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    const column = this.getColumn(columnPath);

    if (!column) {
      throw new QueryError(`Column not found: ${columnId}`, { columnId });
    }

    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const sqliteTable = this.asSQLiteTable(primaryTableSchema);
    const sqliteColumn = this.asSQLiteColumn(column);

    const baseQuery = this.db
      .select({
        value: sqliteColumn,
        count: count(),
      })
      .from(sqliteTable);
    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;

    if (columnPath.isNested && columnPath.relationshipPath) {
      const joinOrder = this.relationshipManager.optimizeJoinOrder(
        new Map([[columnPath.table, columnPath.relationshipPath || []]]),
        primaryTable
      );

      for (const relationship of joinOrder) {
        const targetTable = this.schema[relationship.to];
        if (!targetTable) {
          throw new QueryError(`Target table not found: ${relationship.to}`, {
            targetTable: relationship.to,
          });
        }

        const joinCondition = this.buildJoinCondition(relationship) as SQL;
        const sqliteTargetTable = this.asSQLiteTable(targetTable);

        if (relationship.joinType === 'left') {
          query = query.leftJoin(sqliteTargetTable, joinCondition);
        } else {
          query = query.innerJoin(sqliteTargetTable, joinCondition);
        }
      }
    }

    return this.asSQLiteQueryBuilder(
      query.where(isNotNull(sqliteColumn)).groupBy(sqliteColumn).orderBy(sqliteColumn)
    );
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

  /**
   * Build min/max values query
   */
  /**
   * Quote SQL identifier for SQLite (uses double quotes)
   */
  protected quoteIdentifier(identifier: string): SQL {
    return sql.raw(`"${identifier}"`);
  }

  buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string
  ): SQLiteQueryBuilderWithJoins {
    this.validateColumnId(columnId, primaryTable);

    const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
    const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

    this.validateMinMaxColumnCompatibility(columnReference.column);

    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const sqliteTable = this.asSQLiteTable(primaryTableSchema);
    const sqliteColumn = this.asSQLiteColumn(columnReference.column);

    const baseQuery = this.db
      .select({
        min: min(sqliteColumn),
        max: max(sqliteColumn),
      })
      .from(sqliteTable);
    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    for (const joinConfig of requiredJoins) {
      const sqliteJoinTable = this.asSQLiteTable(joinConfig.table);
      const joinCondition = joinConfig.condition as SQL;

      if (joinConfig.type === 'left') {
        query = query.leftJoin(sqliteJoinTable, joinCondition);
      } else {
        query = query.innerJoin(sqliteJoinTable, joinCondition);
      }
    }

    return this.asSQLiteQueryBuilder(query.where(isNotNull(sqliteColumn)));
  }
}
