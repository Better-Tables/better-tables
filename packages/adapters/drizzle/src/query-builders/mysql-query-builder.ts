/**
 * @fileoverview MySQL-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/mysql
 *
 * @description
 * MySQL query builder implementation with driver-specific optimizations.
 *
 * @since 1.0.0
 */

import { count, isNotNull, max, min, type SQL } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  MySQLQueryBuilderWithJoins,
  QueryContext,
} from '../types';
import { QueryError } from '../types';
import { generateAlias } from '../utils/alias-generator';
import { BaseQueryBuilder } from './base-query-builder';

/**
 * MySQL query builder implementation.
 *
 * @class MySQLQueryBuilder
 * @extends {BaseQueryBuilder}
 * @since 1.0.0
 */
export class MySQLQueryBuilder extends BaseQueryBuilder {
  private db: MySql2Database;

  constructor(
    db: MySql2Database,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager
  ) {
    super(schema, relationshipManager, 'mysql');
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
}
