/**
 * @fileoverview PostgreSQL-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/postgres
 *
 * @description
 * PostgreSQL query builder implementation with driver-specific optimizations.
 *
 * @since 1.0.0
 */

import { count, countDistinct, isNotNull, max, min, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  PostgresQueryBuilderWithJoins,
  QueryContext,
} from '../types';
import { QueryError } from '../types';
import { generateAlias } from '../utils/alias-generator';
import { BaseQueryBuilder } from './base-query-builder';

/**
 * PostgreSQL query builder implementation.
 *
 * @class PostgresQueryBuilder
 * @extends {BaseQueryBuilder}
 * @since 1.0.0
 */
export class PostgresQueryBuilder extends BaseQueryBuilder {
  private db: PostgresJsDatabase;

  constructor(
    db: PostgresJsDatabase,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager
  ) {
    super(schema, relationshipManager, 'postgres');
    this.db = db;
  }

  /**
   * Type-safe helper to cast AnyTableType to PgTable.
   * At runtime, this query builder only receives PostgreSQL tables via the factory pattern.
   */
  private asPgTable(table: AnyTableType): PgTable {
    return table as PgTable;
  }

  /**
   * Type-safe helper to cast AnyColumnType to PgColumn.
   * At runtime, this query builder only receives PostgreSQL columns via the factory pattern.
   */
  private asPgColumn(column: AnyColumnType): PgColumn {
    return column as PgColumn;
  }

  /**
   * Build SELECT query with joins
   */
  buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[]
  ): {
    query: PostgresQueryBuilderWithJoins;
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

    // Cast selections to Record<string, PgColumn> for type-safe select
    const pgSelections = selections as Record<string, PgColumn>;
    const pgTable = this.asPgTable(primaryTableSchema);

    const baseQuery =
      Object.keys(selections).length > 0
        ? this.db.select(pgSelections).from(pgTable)
        : this.db.select().from(pgTable);

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
      const pgTargetTable = this.asPgTable(targetTable);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(pgTargetTable, joinCondition);
      } else {
        query = query.innerJoin(pgTargetTable, joinCondition);
      }
    }

    return {
      query: this.asPostgresQueryBuilder(query),
      columnMetadata: {
        selections,
        columnMapping,
      },
    };
  }

  /**
   * Build COUNT query for pagination
   */
  buildCountQuery(context: QueryContext, primaryTable: string): PostgresQueryBuilderWithJoins {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const pgTable = this.asPgTable(primaryTableSchema);
    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);

    // If there are joins, count distinct primary keys to avoid inflated counts
    const primaryKeyInfo = this.primaryKeyMap[primaryTable];
    const hasJoins = joinOrder.length > 0;

    const baseQuery =
      hasJoins && primaryKeyInfo
        ? (() => {
            // Use count distinct on primary key to avoid counting duplicate rows from joins
            const pgPkColumn = this.asPgColumn(primaryKeyInfo.column);
            return this.db.select({ count: countDistinct(pgPkColumn) }).from(pgTable);
          })()
        : this.db.select({ count: count() }).from(pgTable);

    // Build query by chaining operations - use proper typing
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
      const pgTargetTable = this.asPgTable(targetTable);

      if (relationship.joinType === 'left') {
        query = query.leftJoin(pgTargetTable, joinCondition);
      } else {
        query = query.innerJoin(pgTargetTable, joinCondition);
      }
    }

    return this.asPostgresQueryBuilder(query);
  }

  /**
   * Build aggregate query for faceted values
   */
  buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction = 'count',
    primaryTable: string
  ): PostgresQueryBuilderWithJoins {
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

    const pgTable = this.asPgTable(mainTableSchema);
    const pgColumn = this.asPgColumn(columnReference.column);
    const aggregateFn = this.getAggregateFunction(columnReference.column, aggregateFunction) as SQL;

    const baseQuery = this.db
      .select({
        value: pgColumn,
        count: aggregateFn,
      })
      .from(pgTable);

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;
    for (const joinConfig of requiredJoins) {
      const pgJoinTable = this.asPgTable(joinConfig.table);
      const joinCondition = joinConfig.condition as SQL;

      if (joinConfig.type === 'left') {
        query = query.leftJoin(pgJoinTable, joinCondition);
      } else {
        query = query.innerJoin(pgJoinTable, joinCondition);
      }
    }

    return this.asPostgresQueryBuilder(
      query.where(isNotNull(pgColumn)).groupBy(pgColumn).orderBy(pgColumn)
    );
  }

  /**
   * Build filter options query
   */
  buildFilterOptionsQuery(columnId: string, primaryTable: string): PostgresQueryBuilderWithJoins {
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

    const pgTable = this.asPgTable(primaryTableSchema);
    const pgColumn = this.asPgColumn(column);

    const baseQuery = this.db
      .select({
        value: pgColumn,
        count: count(),
      })
      .from(pgTable);

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
        const pgTargetTable = this.asPgTable(targetTable);

        if (relationship.joinType === 'left') {
          query = query.leftJoin(pgTargetTable, joinCondition);
        } else {
          query = query.innerJoin(pgTargetTable, joinCondition);
        }
      }
    }

    return this.asPostgresQueryBuilder(
      query.where(isNotNull(pgColumn)).groupBy(pgColumn).orderBy(pgColumn)
    );
  }

  /**
   * Build min/max values query
   */
  buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string
  ): PostgresQueryBuilderWithJoins {
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

    const pgTable = this.asPgTable(primaryTableSchema);
    const pgColumn = this.asPgColumn(columnReference.column);

    const baseQuery = this.db
      .select({
        min: min(pgColumn),
        max: max(pgColumn),
      })
      .from(pgTable);

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );

    let query:
      | ReturnType<typeof baseQuery.leftJoin>
      | ReturnType<typeof baseQuery.innerJoin>
      | typeof baseQuery = baseQuery;
    for (const joinConfig of requiredJoins) {
      const pgJoinTable = this.asPgTable(joinConfig.table);
      const joinCondition = joinConfig.condition as SQL;

      if (joinConfig.type === 'left') {
        query = query.leftJoin(pgJoinTable, joinCondition);
      } else {
        query = query.innerJoin(pgJoinTable, joinCondition);
      }
    }

    return this.asPostgresQueryBuilder(query.where(isNotNull(pgColumn)));
  }
}
