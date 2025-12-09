/**
 * @fileoverview PostgreSQL-specific query builder
 * @module @better-tables/drizzle-adapter/query-builders/postgres
 *
 * @description
 * PostgreSQL query builder implementation with driver-specific optimizations.
 *
 * Supports all PostgreSQL-compatible Drizzle drivers:
 * - postgres-js (PostgresJsDatabase)
 * - node-postgres (NodePgDatabase)
 * - neon-http (NeonHttpDatabase)
 *
 * @since 1.0.0 (expanded to support all PostgreSQL drivers in 1.1.0)
 */

import {
  and,
  count,
  countDistinct,
  isNotNull,
  max,
  min,
  type SQL,
  type SQLWrapper,
  sql,
} from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  FilterHandlerHooks,
  PostgresDatabaseType,
  PostgresQueryBuilderWithJoins,
  QueryContext,
} from '../types';
import { QueryError } from '../types';
import { generateAlias } from '../utils/alias-generator';
import { BaseQueryBuilder } from './base-query-builder';

/**
 * Wrapper class for Drizzle relational queries to implement QueryBuilderWithJoins interface
 * This allows relational queries to be used seamlessly with the existing query builder pattern
 */
class RelationalQueryWrapper implements PostgresQueryBuilderWithJoins {
  private queryFn: (options?: {
    where?: unknown;
    orderBy?: unknown;
    limit?: number;
    offset?: number;
  }) => Promise<unknown[]>;
  private whereConditions: (SQL | SQLWrapper)[] = [];
  private orderByClauses: (AnyColumnType | SQL | SQLWrapper)[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private groupByColumns: (AnyColumnType | SQL | SQLWrapper)[] = [];

  constructor(
    queryFn: (options?: {
      where?: unknown;
      orderBy?: unknown;
      limit?: number;
      offset?: number;
    }) => Promise<unknown[]>
  ) {
    this.queryFn = queryFn;
  }

  leftJoin(_table: AnyTableType, _condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins {
    // Relational queries don't support manual joins - they use 'with' instead
    // Return self to allow chaining, but joins are ignored
    return this;
  }

  innerJoin(_table: AnyTableType, _condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins {
    // Relational queries don't support manual joins - they use 'with' instead
    // Return self to allow chaining, but joins are ignored
    return this;
  }

  select(
    _selections?: Record<string, AnyColumnType | SQL | SQLWrapper>
  ): PostgresQueryBuilderWithJoins {
    // Selections are already handled in the relational query setup
    // Return self to allow chaining
    return this;
  }

  where(condition: SQL | SQLWrapper): PostgresQueryBuilderWithJoins {
    this.whereConditions.push(condition);
    return this;
  }

  orderBy(...clauses: (AnyColumnType | SQL | SQLWrapper)[]): PostgresQueryBuilderWithJoins {
    this.orderByClauses.push(...clauses);
    return this;
  }

  limit(count: number): PostgresQueryBuilderWithJoins {
    this.limitValue = count;
    return this;
  }

  offset(count: number): PostgresQueryBuilderWithJoins {
    this.offsetValue = count;
    return this;
  }

  groupBy(...columns: (AnyColumnType | SQL | SQLWrapper)[]): PostgresQueryBuilderWithJoins {
    this.groupByColumns.push(...columns);
    return this;
  }

  async execute(): Promise<Record<string, unknown>[]> {
    // Build options object from accumulated query modifiers
    const options: {
      where?: unknown;
      orderBy?: unknown;
      limit?: number;
      offset?: number;
    } = {};

    // Combine where conditions if any
    if (this.whereConditions.length > 0) {
      // For relational queries, we need to pass the where condition
      // Drizzle's relational API expects a where object, not SQL
      // Combine multiple conditions using and() to ensure all predicates are applied
      if (this.whereConditions.length === 1) {
        options.where = this.whereConditions[0];
      } else {
        // Combine multiple conditions using and()
        options.where = and(...this.whereConditions);
      }
    }

    // Combine orderBy clauses if any
    if (this.orderByClauses.length > 0) {
      options.orderBy =
        this.orderByClauses.length === 1 ? this.orderByClauses[0] : this.orderByClauses;
    }

    if (this.limitValue !== undefined) {
      options.limit = this.limitValue;
    }

    if (this.offsetValue !== undefined) {
      options.offset = this.offsetValue;
    }

    // Execute the relational query
    const results = await this.queryFn(options);

    // Convert results to Record<string, unknown>[] format
    // Results from Drizzle relational queries are already nested objects
    return results as Record<string, unknown>[];
  }
}

/**
 * PostgreSQL query builder implementation.
 *
 * Supports all PostgreSQL-compatible Drizzle drivers:
 * - postgres-js (PostgresJsDatabase)
 * - node-postgres (NodePgDatabase)
 * - neon-http (NeonHttpDatabase)
 *
 * @class PostgresQueryBuilder
 * @extends {BaseQueryBuilder}
 * @since 1.0.0 (expanded to support all PostgreSQL drivers in 1.1.0)
 */
export class PostgresQueryBuilder extends BaseQueryBuilder {
  private db: PostgresDatabaseType;

  constructor(
    db: PostgresDatabaseType,
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    hooks?: FilterHandlerHooks
  ) {
    super(schema, relationshipManager, 'postgres', hooks);
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
   * Build join condition for array foreign keys in PostgreSQL
   * Uses PostgreSQL's ANY() operator: targetColumn = ANY(sourceArrayColumn)
   */
  protected buildArrayJoinCondition(
    targetColumn: AnyColumnType,
    sourceArrayColumn: AnyColumnType
  ): SQL {
    const pgTargetColumn = this.asPgColumn(targetColumn);
    const pgSourceArrayColumn = this.asPgColumn(sourceArrayColumn);

    // PostgreSQL syntax: targetColumn = ANY(sourceArrayColumn)
    return sql`${pgTargetColumn} = ANY(${pgSourceArrayColumn})`;
  }

  /**
   * Build relational query using Drizzle's relational query API
   * This returns nested objects instead of flattened fields
   */
  private buildRelationalQuery(
    primaryTable: string,
    columns?: string[],
    context?: QueryContext
  ): {
    query: PostgresQueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>;
    };
    isNested: boolean; // Flag to indicate data is already nested
  } | null {
    // Check if db.query is available (requires schema with relations passed to drizzle())
    const dbWithQuery = this.db as unknown as { query?: Record<string, unknown> };
    if (!dbWithQuery.query || !dbWithQuery.query[primaryTable]) {
      return null; // Relational query API not available, fall back to manual joins
    }

    const tableQuery = dbWithQuery.query[primaryTable] as {
      findMany?: (options?: {
        with?: Record<string, unknown>;
        where?: unknown;
        orderBy?: unknown;
        limit?: number;
        offset?: number;
        columns?: Record<string, boolean>;
      }) => Promise<unknown[]>;
    };

    if (!tableQuery?.findMany) {
      return null;
    }

    // Build with object from requested columns
    const withObject: Record<string, unknown> = {};
    const selections: Record<string, AnyColumnType> = {};
    const columnMapping: Record<string, string> = {};

    // Group columns by relationship
    const relationshipColumns = new Map<string, Set<string>>();
    const primaryTableColumns = new Set<string>();
    let hasArrayRelationship = false;

    if (columns && columns.length > 0) {
      for (const columnId of columns) {
        const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);

        if (columnPath.isNested && columnPath.relationshipPath) {
          // Check if this is an array relationship
          if (this.relationshipManager.isArrayRelationship(columnPath.relationshipPath)) {
            // Array relationships can't use Drizzle relational API - need manual joins
            hasArrayRelationship = true;
            continue;
          }

          // Extract relationship alias (first part of columnId)
          const alias = columnId.split('.')[0];
          if (alias) {
            if (!relationshipColumns.has(alias)) {
              relationshipColumns.set(alias, new Set());
            }
            relationshipColumns.get(alias)?.add(columnPath.field);
          }
        } else {
          // Primary table column
          primaryTableColumns.add(columnPath.field);
        }
      }

      // If we have array relationships, we can't use relational queries - need manual joins
      if (hasArrayRelationship) {
        return null;
      }

      // Process joinPaths from context to include relationships required by filters
      if (context && context.joinPaths.size > 0) {
        for (const [targetTable, relationshipPath] of context.joinPaths) {
          // Get the relationship alias from the path
          if (relationshipPath.length > 0) {
            // Find the relationship by target table
            const relationship = this.relationshipManager.getRelationshipByAlias(
              primaryTable,
              targetTable
            );

            // If relationship exists and not already in relationshipColumns, add it
            if (relationship && !relationshipColumns.has(targetTable)) {
              relationshipColumns.set(targetTable, new Set());
              // Add all fields from the relationship (or at least id)
              relationshipColumns.get(targetTable)?.add('id');
            }
          }
        }
      }

      // Build with object for each relationship
      for (const [alias, fields] of relationshipColumns) {
        const relationship = this.relationshipManager.getRelationshipByAlias(primaryTable, alias);
        if (relationship) {
          // Build columns object for this relationship
          const relationshipColumnsObj: Record<string, boolean> = {};
          for (const field of fields) {
            relationshipColumnsObj[field] = true;
          }

          // Add to with object - use alias as the key (should match relation name in schema)
          withObject[alias] = {
            columns: relationshipColumnsObj,
          };
        }
      }

      // Build primary table columns selection
      const primaryColumnsObj: Record<string, boolean> = {};
      for (const field of primaryTableColumns) {
        primaryColumnsObj[field] = true;
      }

      // Create a query function that will be executed later
      const queryFn = async (options?: {
        where?: unknown;
        orderBy?: unknown;
        limit?: number;
        offset?: number;
      }) => {
        const queryOptions: {
          columns: Record<string, boolean>;
          with?: Record<string, unknown>;
          where?: unknown;
          orderBy?: unknown;
          limit?: number;
          offset?: number;
        } = {
          columns: primaryColumnsObj,
          ...options,
        };

        if (Object.keys(withObject).length > 0) {
          queryOptions.with = withObject;
        }

        return tableQuery.findMany?.(queryOptions) || [];
      };

      // Build column metadata
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        for (const field of primaryTableColumns) {
          const col = (primaryTableSchema as unknown as Record<string, AnyColumnType>)[field];
          if (col) {
            selections[field] = col;
            columnMapping[field] = field;
          }
        }
      }

      for (const [alias, fields] of relationshipColumns) {
        const relationship = this.relationshipManager.getRelationshipByAlias(primaryTable, alias);
        if (relationship) {
          const relatedTableSchema = this.schema[relationship.to];
          if (relatedTableSchema) {
            for (const field of fields) {
              const col = (relatedTableSchema as unknown as Record<string, AnyColumnType>)[field];
              if (col) {
                const columnId = `${alias}.${field}`;
                selections[columnId] = col;
                columnMapping[columnId] = columnId;
              }
            }
          }
        }
      }

      // Create wrapper that implements PostgresQueryBuilderWithJoins
      const wrapper = new RelationalQueryWrapper(queryFn);

      return {
        query: wrapper,
        columnMetadata: {
          selections,
          columnMapping,
        },
        isNested: true, // Relational queries return nested data
      };
    }

    return null;
  }

  /**
   * Build SELECT query with joins
   * Attempts to use Drizzle relational queries first, falls back to manual joins
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
    isNested?: boolean; // Flag to indicate if data is already nested from relational query
  } {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    // Try to use Drizzle relational queries first (for non-array relationships)
    const relationalQuery = this.buildRelationalQuery(primaryTable, columns, context);
    if (relationalQuery) {
      return {
        query: relationalQuery.query,
        columnMetadata: relationalQuery.columnMetadata,
        isNested: relationalQuery.isNested,
      };
    }

    // Fall back to manual SQL joins (for array relationships or when relational API unavailable)
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
      isNested: false, // Manual joins return flat data
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

  /**
   * Override buildColumnSelections to handle JSON accessor columns
   * For PostgreSQL, we need to use the ->> operator to extract nested JSONB fields
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
              const pgColumn = this.asPgColumn(columnReference.column);
              // Use ->> operator to extract the nested JSONB field as text
              // Format: column->>'field'
              const jsonExtract = sql<string>`${pgColumn}->>${jsonField}`;
              selections[columnId] = jsonExtract as unknown as AnyColumnType;
            }
          }
        }
      }
    }

    return selections;
  }
}
