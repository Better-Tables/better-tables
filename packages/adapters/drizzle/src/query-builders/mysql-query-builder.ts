/**
 * @fileoverview MySQL-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/mysql
 *
 * @description
 * MySQL query builder implementation with driver-specific optimizations.
 *
 * Supports all MySQL-compatible Drizzle drivers:
 * - mysql2 (MySql2Database)
 *
 * @since 1.0.0 (expanded to support all MySQL drivers in 1.1.0)
 */

import { count, isNotNull, max, min, type SQL, sql } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  FilterHandlerHooks,
  MySQLQueryBuilderWithJoins,
  MySqlDatabaseType,
  QueryContext,
} from '../types';
import { QueryError } from '../types';
import { generateAlias } from '../utils/alias-generator';
import { BaseQueryBuilder } from './base-query-builder';

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
   * Type-safe helper to cast AnyTableType to MySqlTable.
   * At runtime, this query builder only receives MySQL tables via the factory pattern.
   */
  private asMySqlTable(table: AnyTableType): MySqlTable {
    return table as MySqlTable;
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
   * Build SELECT query with joins
   */
  buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[]
  ): {
    query: MySQLQueryBuilderWithJoins;
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

    // Cast selections to Record<string, MySqlColumn> for type-safe select
    const mysqlSelections = selections as Record<string, MySqlColumn>;
    const mysqlTable = this.asMySqlTable(primaryTableSchema);

    const baseQuery =
      Object.keys(selections).length > 0
        ? this.db.select(mysqlSelections).from(mysqlTable)
        : this.db.select().from(mysqlTable);

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
      const mysqlTargetTable = this.asMySqlTable(targetTable);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(mysqlTargetTable, joinCondition);
      } else {
        query = query.innerJoin(mysqlTargetTable, joinCondition);
      }
    }

    return {
      query: this.asMySQLQueryBuilder(query),
      columnMetadata: {
        selections,
        columnMapping,
      },
      isNested: false, // MySQL uses manual joins, returns flat data
    };
  }

  /**
   * Build COUNT query for pagination
   */
  buildCountQuery(context: QueryContext, primaryTable: string): MySQLQueryBuilderWithJoins {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const mysqlTable = this.asMySqlTable(primaryTableSchema);
    const baseQuery = this.db.select({ count: count() }).from(mysqlTable);

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
      const mysqlTargetTable = this.asMySqlTable(targetTable);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(mysqlTargetTable, joinCondition);
      } else {
        query = query.innerJoin(mysqlTargetTable, joinCondition);
      }
    }

    return this.asMySQLQueryBuilder(query);
  }

  /**
   * Build aggregate query for faceted values
   */
  buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction = 'count',
    primaryTable: string
  ): MySQLQueryBuilderWithJoins {
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

    const mysqlTable = this.asMySqlTable(mainTableSchema);
    const mysqlColumn = this.asMySqlColumn(columnReference.column);
    const aggregateFn = this.getAggregateFunction(columnReference.column, aggregateFunction) as SQL;

    const baseQuery = this.db
      .select({
        value: mysqlColumn,
        count: aggregateFn,
      })
      .from(mysqlTable);

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;
    for (const joinConfig of requiredJoins) {
      const mysqlJoinTable = this.asMySqlTable(joinConfig.table);
      const joinCondition = joinConfig.condition as SQL;

      if (joinConfig.type === 'left') {
        query = query.leftJoin(mysqlJoinTable, joinCondition);
      } else {
        query = query.innerJoin(mysqlJoinTable, joinCondition);
      }
    }

    return this.asMySQLQueryBuilder(
      query.where(isNotNull(mysqlColumn)).groupBy(mysqlColumn).orderBy(mysqlColumn)
    );
  }

  /**
   * Build filter options query
   */
  buildFilterOptionsQuery(columnId: string, primaryTable: string): MySQLQueryBuilderWithJoins {
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

    const mysqlTable = this.asMySqlTable(primaryTableSchema);
    const mysqlColumn = this.asMySqlColumn(column);

    const baseQuery = this.db
      .select({
        value: mysqlColumn,
        count: count(),
      })
      .from(mysqlTable);

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
        const mysqlTargetTable = this.asMySqlTable(targetTable);

        if (relationship.joinType === 'left') {
          query = query.leftJoin(mysqlTargetTable, joinCondition);
        } else {
          query = query.innerJoin(mysqlTargetTable, joinCondition);
        }
      }
    }

    return this.asMySQLQueryBuilder(
      query.where(isNotNull(mysqlColumn)).groupBy(mysqlColumn).orderBy(mysqlColumn)
    );
  }

  /**
   * Build min/max values query
   */
  buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string
  ): MySQLQueryBuilderWithJoins {
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

    const mysqlTable = this.asMySqlTable(primaryTableSchema);
    const mysqlColumn = this.asMySqlColumn(columnReference.column);

    const baseQuery = this.db
      .select({
        min: min(mysqlColumn),
        max: max(mysqlColumn),
      })
      .from(mysqlTable);

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;
    for (const joinConfig of requiredJoins) {
      const mysqlJoinTable = this.asMySqlTable(joinConfig.table);
      const joinCondition = joinConfig.condition as SQL;

      if (joinConfig.type === 'left') {
        query = query.leftJoin(mysqlJoinTable, joinCondition) as ReturnType<
          typeof baseQuery.leftJoin
        >;
      } else {
        query = query.innerJoin(mysqlJoinTable, joinCondition) as ReturnType<
          typeof baseQuery.innerJoin
        >;
      }
    }

    return this.asMySQLQueryBuilder(query.where(isNotNull(mysqlColumn)));
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
