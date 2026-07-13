/**
 * @fileoverview Base query builder with shared logic
 * @module @better-tables/drizzle-adapter/query-builders/base
 *
 * @description
 * Abstract base class for database-specific query builders. Contains shared
 * validation and utility methods used by all driver implementations.
 *
 * @since 1.0.0
 */

import {
  calculateLevenshteinDistance,
  generateAlias,
  generatePathKey,
  getPrimaryKeyMap,
  quoteIdentifier as quoteIdentifierRaw,
} from '@better-tables/adapters-toolkit';
import type { FilterState, PaginationParams, SortingParams } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  isNotNull,
  max,
  min,
  sql,
  sum,
} from 'drizzle-orm';
import { FilterHandler } from '../filter-handler';
import type { RelationshipManager } from '../relationship-manager';
import type {
  AggregateFunction,
  AnyColumnType,
  AnyTableType,
  ColumnPath,
  ComputedFieldWithResolvedSortSql,
  DatabaseDriver,
  FilterHandlerHooks,
  JoinConfig,
  MySQLQueryBuilderWithJoins,
  PostgresQueryBuilderWithJoins,
  QueryBuilderWithJoins,
  QueryContext,
  RelationshipPath,
  SQLiteQueryBuilderWithJoins,
} from '../types';
import { QueryError } from '../types';
import {
  getColumnNames,
  getForeignKeyColumns,
  getPrimaryKeyColumns,
} from '../utils/drizzle-schema-utils';

/**
 * Minimal structural view of a Drizzle database's `select().from()` entry
 * point — exactly what the shared query skeletons in {@link BaseQueryBuilder}
 * need. All three dialect database types (Postgres/MySQL/SQLite) satisfy this
 * at runtime; the per-dialect `asPgTable`/`asMySqlTable`/`asSQLiteTable` and
 * column casts they used to sprinkle through triplicated method bodies were
 * compile-time-only, so a single contained cast in each subclass's `getDb()`
 * replaces all of them (plan 007 step 5).
 */
export interface DialectDb {
  select(selection?: Record<string, AnyColumnType | SQL | SQLWrapper>): {
    from(table: AnyTableType): QueryBuilderWithJoins;
  };
}

/**
 * Abstract base class for query builders.
 * Contains shared logic for all database drivers: the manual-join SELECT
 * skeleton, COUNT (with distinct-primary-key guard under joins), aggregate /
 * filter-options / min-max queries, join application, filter/sort/pagination
 * application, validation, and identifier quoting. Dialect subclasses supply
 * only: the db handle (`getDb`), the identifier quote char, array-FK join
 * syntax, JSON-accessor column selections, and (Postgres) relational-query
 * support.
 *
 * @abstract
 * @class BaseQueryBuilder
 * @since 1.0.0
 */
export abstract class BaseQueryBuilder {
  protected schema: Record<string, AnyTableType>;
  protected relationshipManager: RelationshipManager;
  protected filterHandler: FilterHandler;
  protected primaryKeyMap: Record<string, { columnName: string; column: AnyColumnType }>;

  constructor(
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    databaseType: DatabaseDriver,
    hooks?: FilterHandlerHooks
  ) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    this.filterHandler = new FilterHandler(schema, relationshipManager, databaseType, hooks);
    // Primary keys are auto-detected from the schema
    this.primaryKeyMap = getPrimaryKeyMap(schema, {
      getColumnNames,
      getForeignKeyColumns,
      getPrimaryKeyColumns,
    });
  }

  /**
   * Type-safe helper to cast Drizzle's complex query builder types to our QueryBuilderWithJoins interface.
   * This is safe because Drizzle's query builders implement all methods in our interface,
   * but TypeScript cannot statically verify this due to Drizzle's complex generic types.
   */
  protected asQueryBuilder<T>(query: T): QueryBuilderWithJoins {
    return query as QueryBuilderWithJoins;
  }

  /**
   * Type-safe helper to cast Drizzle's PostgreSQL query builder types to our PostgresQueryBuilderWithJoins interface.
   */
  protected asPostgresQueryBuilder<T>(query: T): PostgresQueryBuilderWithJoins {
    return query as PostgresQueryBuilderWithJoins;
  }

  /**
   * Type-safe helper to cast Drizzle's MySQL query builder types to our MySQLQueryBuilderWithJoins interface.
   */
  protected asMySQLQueryBuilder<T>(query: T): MySQLQueryBuilderWithJoins {
    return query as MySQLQueryBuilderWithJoins;
  }

  /**
   * Type-safe helper to cast Drizzle's SQLite query builder types to our SQLiteQueryBuilderWithJoins interface.
   */
  protected asSQLiteQueryBuilder<T>(query: T): SQLiteQueryBuilderWithJoins {
    return query as SQLiteQueryBuilderWithJoins;
  }

  /**
   * Dialect hook: the underlying Drizzle database handle, viewed through the
   * minimal structural {@link DialectDb} interface the shared skeletons need.
   * Each subclass implements this with a single contained cast of its own
   * strongly-typed db instance.
   */
  protected abstract getDb(): DialectDb;

  /**
   * Dialect hook: the identifier quote character.
   * - PostgreSQL: double quote (")
   * - MySQL: backtick (`)
   * - SQLite: double quote (")
   */
  protected abstract readonly quoteChar: '"' | '`';

  /**
   * Quote (escape-and-wrap) a SQL identifier with the dialect's quote char.
   * Escaping happens inside the toolkit's quoteIdentifier (ADAPTER-04), so
   * it can never be skipped or done with the wrong dialect's quote char.
   *
   * @param identifier - The raw identifier to quote
   * @returns SQL expression with the quoted identifier
   */
  protected quoteIdentifier(identifier: string): SQL | SQLWrapper {
    return sql.raw(quoteIdentifierRaw(identifier, this.quoteChar));
  }

  /**
   * Apply a join order (from `optimizeJoinOrder`) to a query.
   * Shared join-application loop hoisted from the three dialect builders
   * (plan 007 step 5) — their copies differed only in compile-time casts.
   */
  protected applyJoins(
    query: QueryBuilderWithJoins,
    joinOrder: RelationshipPath[]
  ): QueryBuilderWithJoins {
    let result = query;
    for (const relationship of joinOrder) {
      const targetTable = this.schema[relationship.to];
      if (!targetTable) {
        throw new QueryError(`Target table not found: ${relationship.to}`, {
          targetTable: relationship.to,
        });
      }

      const joinCondition = this.buildJoinCondition(relationship);

      if (relationship.joinType === 'left') {
        result = result.leftJoin(targetTable, joinCondition);
      } else {
        result = result.innerJoin(targetTable, joinCondition);
      }
    }
    return result;
  }

  /**
   * Apply pre-built join configs (from `getRequiredJoinsForColumn`) to a query.
   * Shared loop hoisted from the dialect aggregate/min-max builders.
   */
  protected applyJoinConfigs(
    query: QueryBuilderWithJoins,
    joinConfigs: JoinConfig[]
  ): QueryBuilderWithJoins {
    let result = query;
    for (const joinConfig of joinConfigs) {
      if (joinConfig.type === 'left') {
        result = result.leftJoin(joinConfig.table, joinConfig.condition);
      } else {
        result = result.innerJoin(joinConfig.table, joinConfig.condition);
      }
    }
    return result;
  }

  /**
   * Build SELECT query with manual joins (flat results).
   *
   * Shared implementation for all dialects. PostgreSQL overrides this to
   * first attempt Drizzle's relational query API (nested results) and falls
   * back to this manual-join skeleton; JSON-accessor handling is injected
   * through each dialect's `buildColumnSelections` override.
   */
  buildSelectQuery(
    context: QueryContext,
    primaryTable: string,
    columns?: string[],
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>
  ): {
    query: QueryBuilderWithJoins;
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

    const db = this.getDb();
    const baseQuery =
      Object.keys(selections).length > 0
        ? db.select(selections).from(primaryTableSchema)
        : db.select().from(primaryTableSchema);

    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);
    const query = this.applyJoins(baseQuery, joinOrder);

    return {
      query,
      columnMetadata: {
        selections,
        columnMapping,
      },
      isNested: false, // Manual joins return flat data
    };
  }

  /**
   * Build COUNT query for pagination.
   *
   * Shared implementation for all dialects, including plan 003's
   * distinct-primary-key guard: when joins are present, COUNT(DISTINCT pk)
   * avoids counting duplicated rows fanned out by one-to-many joins.
   */
  buildCountQuery(context: QueryContext, primaryTable: string): QueryBuilderWithJoins {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, {
        primaryTable: primaryTable,
      });
    }

    const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);

    // If there are joins, count distinct primary keys to avoid inflated counts
    const primaryKeyInfo = this.primaryKeyMap[primaryTable];
    const hasJoins = joinOrder.length > 0;

    const db = this.getDb();
    const baseQuery =
      hasJoins && primaryKeyInfo
        ? // Use count distinct on primary key to avoid counting duplicate rows from joins
          db
            .select({ count: countDistinct(primaryKeyInfo.column) })
            .from(primaryTableSchema)
        : db.select({ count: count() }).from(primaryTableSchema);

    return this.applyJoins(baseQuery, joinOrder);
  }

  /**
   * Build aggregate query for faceted values.
   * Shared implementation for all dialects.
   */
  buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction = 'count',
    primaryTable: string
  ): QueryBuilderWithJoins {
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

    const column = columnReference.column;
    const aggregateFn = this.getAggregateFunction(column, aggregateFunction);

    const baseQuery = this.getDb()
      .select({
        value: column,
        count: aggregateFn,
      })
      .from(mainTableSchema);

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );
    const query = this.applyJoinConfigs(baseQuery, requiredJoins);

    return query.where(isNotNull(column)).groupBy(column).orderBy(column);
  }

  /**
   * Build filter options query.
   * Shared implementation for all dialects.
   */
  buildFilterOptionsQuery(columnId: string, primaryTable: string): QueryBuilderWithJoins {
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

    const baseQuery = this.getDb()
      .select({
        value: column,
        count: count(),
      })
      .from(primaryTableSchema);

    let query: QueryBuilderWithJoins = baseQuery;
    if (columnPath.isNested && columnPath.relationshipPath) {
      const joinOrder = this.relationshipManager.optimizeJoinOrder(
        new Map([[columnPath.table, columnPath.relationshipPath || []]]),
        primaryTable
      );
      query = this.applyJoins(query, joinOrder);
    }

    return query.where(isNotNull(column)).groupBy(column).orderBy(column);
  }

  /**
   * Build min/max values query.
   * Shared implementation for all dialects.
   */
  buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string
  ): QueryBuilderWithJoins {
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

    const column = columnReference.column;

    const baseQuery = this.getDb()
      .select({
        min: min(column),
        max: max(column),
      })
      .from(primaryTableSchema);

    const requiredJoins = this.relationshipManager.getRequiredJoinsForColumn(
      columnPath,
      primaryTable
    );
    const query = this.applyJoinConfigs(baseQuery, requiredJoins);

    return query.where(isNotNull(column));
  }

  /**
   * Apply filters to query
   *
   * NOTE(plan-017): this flat collect-then-and(...) is the seam where the
   * recursive AND/OR filter-group walk from the contract-v2 design doc
   * (plans/design/core-contract-v2.md §1.5) will slot in: a FilterNode tree
   * replaces the flat FilterState[] here, leaves resolve through
   * FilterHandler.buildFilterCondition, and groups combine recursively via
   * and()/or() by node logic. The router/emitter split (plan 007 step 4)
   * already keeps condition COMBINATION at this layer, with leaf predicate
   * construction behind the PredicateEmitter interface.
   */
  applyFilters(
    query: QueryBuilderWithJoins,
    filters: FilterState[],
    primaryTable: string,
    additionalConditions?: (SQL | SQLWrapper)[]
  ): QueryBuilderWithJoins {
    const allConditions: (SQL | SQLWrapper)[] = [];

    // Add conditions from regular filters
    if (filters && filters.length > 0) {
      const { conditions } = this.filterHandler.handleCrossTableFilters(filters, primaryTable);
      const validConditions = conditions.filter(
        (condition): condition is SQL | SQLWrapper => condition !== undefined
      );
      allConditions.push(...validConditions);
    }

    // Add additional SQL conditions (e.g., from computed field filterSql)
    if (additionalConditions && additionalConditions.length > 0) {
      allConditions.push(...additionalConditions);
    }

    if (allConditions.length === 0) {
      return query;
    }

    return query.where(and(...allConditions) as SQL | SQLWrapper);
  }

  /**
   * Apply sorting to query
   */
  applySorting(
    query: QueryBuilderWithJoins,
    sorting: SortingParams[],
    primaryTable: string,
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>
  ): QueryBuilderWithJoins {
    if (!sorting || sorting.length === 0) {
      return query;
    }

    const orderByClauses = sorting.map((sort) => {
      // Check if this is a computed field with sortSql (check for resolved SQL expression)
      const computedField = computedFields?.[sort.columnId];
      if (computedField?.__resolvedSortSql !== undefined) {
        // The SQL expression is already in SELECT with an alias matching the field name
        // We reference it by the field name (which matches the alias)
        // Use database-specific identifier quoting (delegated to subclasses).
        // Note: The alias comes from a validated computed field name, not user
        // input. Escaping now happens inside quoteIdentifier() itself (ADAPTER-04)
        // so it can never be skipped or done with the wrong dialect's quote char.
        const alias = sort.columnId;
        const orderByExpression = this.quoteIdentifier(alias);
        return sort.direction === 'desc' ? desc(orderByExpression) : asc(orderByExpression);
      }

      // Fall back to regular column resolution
      const columnPath = this.relationshipManager.resolveColumnPath(sort.columnId, primaryTable);
      const column = this.getColumn(columnPath);

      if (!column) {
        throw new QueryError(`Column not found for sorting: ${sort.columnId}`, {
          columnId: sort.columnId,
        });
      }

      return sort.direction === 'desc' ? desc(column) : asc(column);
    });

    return query.orderBy(...orderByClauses);
  }

  /**
   * Apply pagination to query
   */
  applyPagination(
    query: QueryBuilderWithJoins,
    pagination: PaginationParams
  ): QueryBuilderWithJoins {
    if (!pagination) {
      return query;
    }

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    return query.limit(limit).offset(offset);
  }

  /**
   * Type helper to access columns from a table.
   * Tables in Drizzle have columns as properties, but the base type doesn't expose an index signature.
   * We use a type assertion through the table's actual structure to safely access columns.
   */
  private getTableColumn(table: AnyTableType, columnName: string): AnyColumnType | undefined {
    // TypeScript doesn't recognize that Drizzle tables have column index signatures,
    // so we assert to access them safely. This is type-safe at runtime.
    type TableWithIndex = typeof table & Record<string, AnyColumnType>;
    return (table as TableWithIndex)[columnName];
  }

  /**
   * Build join condition with proper type safety
   * Handles both regular foreign keys and array foreign keys
   */
  protected buildJoinCondition(relationship: RelationshipPath): SQL | SQLWrapper {
    const sourceTable = this.schema[relationship.from];
    const targetTable = this.schema[relationship.to];

    if (!sourceTable || !targetTable) {
      throw new QueryError(
        `Tables not found for join: ${relationship.from} -> ${relationship.to}`,
        { relationship }
      );
    }

    const sourceColumn = this.getTableColumn(sourceTable, relationship.localKey);
    const targetColumn = this.getTableColumn(targetTable, relationship.foreignKey);

    if (!sourceColumn || !targetColumn) {
      throw new QueryError(
        `Columns not found for join: ${relationship.localKey} -> ${relationship.foreignKey}`,
        { relationship }
      );
    }

    // Handle array foreign keys differently
    // For array FKs: targetTable.id = ANY(sourceTable.arrayColumn)
    // For regular FKs: sourceTable.fk = targetTable.id
    if (relationship.isArray) {
      return this.buildArrayJoinCondition(targetColumn, sourceColumn);
    }

    return eq(sourceColumn, targetColumn);
  }

  /**
   * Build join condition for array foreign keys
   * Uses database-specific syntax to check if target column value is in source array column
   *
   * @param _targetColumn - The target column to check (unused in base implementation, used in subclasses)
   * @param _sourceArrayColumn - The source array column (unused in base implementation, used in subclasses)
   * @returns SQL condition for array foreign key join
   *
   * @remarks
   * Subclasses must override this method with driver-specific implementations:
   * - PostgreSQL: Uses ANY() operator with native arrays
   * - MySQL: Uses JSON_SEARCH() for JSON array columns
   * - SQLite: Uses json_each() for JSON array columns
   */
  protected buildArrayJoinCondition(
    _targetColumn: AnyColumnType,
    _sourceArrayColumn: AnyColumnType
  ): SQL | SQLWrapper {
    // Base implementation throws - subclasses must override with driver-specific syntax
    throw new QueryError('Array foreign key joins are not supported for this database driver', {
      suggestion: 'This method must be overridden by database-specific query builder subclasses',
    });
  }

  /**
   * Build flat selections for relationship filtering
   */
  protected buildFlatSelectionsForRelationships(
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};

    const primaryTableSchema = this.schema[primaryTable];
    if (primaryTableSchema) {
      const primaryTableColumnNames = getColumnNames(primaryTableSchema);

      for (const colName of primaryTableColumnNames) {
        const col = this.getTableColumn(primaryTableSchema, colName);
        if (col) {
          selections[colName] = col;
        }
      }
    }

    return selections;
  }

  /**
   * Build column selections with proper type safety
   */
  protected buildColumnSelections(
    columns: string[],
    primaryTable: string
  ): Record<string, AnyColumnType> {
    const selections: Record<string, AnyColumnType> = {};
    const relationshipPathsIncluded = new Set<string>();

    const hasRelationshipColumns = columns.some((col) => col.includes('.'));

    const primaryTablePrimaryKey = this.primaryKeyMap[primaryTable];
    if (primaryTablePrimaryKey) {
      selections[primaryTablePrimaryKey.columnName] = primaryTablePrimaryKey.column;
    }

    if (hasRelationshipColumns) {
      const primaryTableSchema = this.schema[primaryTable];
      if (primaryTableSchema) {
        const primaryTableColumnNames = getColumnNames(primaryTableSchema);

        for (const colName of primaryTableColumnNames) {
          const col = this.getTableColumn(primaryTableSchema, colName);
          if (col && !selections[colName]) {
            selections[colName] = col;
          }
        }
      }
    }

    for (const columnId of columns) {
      const columnPath = this.relationshipManager.resolveColumnPath(columnId, primaryTable);
      const columnReference = this.relationshipManager.getColumnReference(columnPath, primaryTable);

      if (columnPath.isNested && columnPath.relationshipPath) {
        const relationshipPathKey = generatePathKey(columnPath.relationshipPath);

        if (!relationshipPathsIncluded.has(relationshipPathKey)) {
          const relationship = columnPath.relationshipPath[columnPath.relationshipPath.length - 1];
          const realTableName = relationship?.to || columnPath.table;

          const relatedTable = this.schema[realTableName];
          if (relatedTable) {
            const columnNames = getColumnNames(relatedTable);

            for (const colName of columnNames) {
              const col = this.getTableColumn(relatedTable, colName);
              if (col) {
                const aliasedKey = generateAlias(columnPath.relationshipPath, colName);
                selections[aliasedKey] = col;
              }
            }
          }
          relationshipPathsIncluded.add(relationshipPathKey);
        }
      } else {
        if (columnReference) {
          selections[columnId] = columnReference.column;
        }
      }
    }

    return selections;
  }

  /**
   * Get aggregate function with proper type safety
   */
  protected getAggregateFunction(
    column: AnyColumnType,
    functionName: AggregateFunction
  ): SQL | SQLWrapper {
    switch (functionName) {
      case 'count':
        return count();
      case 'sum':
        return sum(column);
      case 'avg':
        return avg(column);
      case 'min':
        return min(column);
      case 'max':
        return max(column);
      case 'distinct':
        return countDistinct(column);
      default:
        return count();
    }
  }

  /**
   * Get column from schema
   */
  protected getColumn(columnPath: ColumnPath): AnyColumnType | null {
    const realTableName =
      columnPath.isNested && columnPath.relationshipPath
        ? columnPath.relationshipPath[columnPath.relationshipPath.length - 1]?.to ||
          columnPath.table
        : columnPath.table;

    const table = this.schema[realTableName];
    if (!table) {
      return null;
    }

    return this.getTableColumn(table, columnPath.field) || null;
  }

  /**
   * Build complete query with all parameters
   */
  buildCompleteQuery(params: {
    columns?: string[];
    filters?: FilterState[];
    sorting?: SortingParams[];
    pagination?: PaginationParams;
    primaryTable: string;
    additionalConditions?: (SQL | SQLWrapper)[]; // Additional SQL conditions to apply (e.g., from computed field filterSql)
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>; // Computed fields with sortSql for sorting (pre-resolved)
  }): {
    dataQuery: QueryBuilderWithJoins;
    countQuery: QueryBuilderWithJoins;
    columnMetadata: {
      selections: Record<string, AnyColumnType>;
      columnMapping: Record<string, string>;
    };
    isNested?: boolean; // Flag to indicate if data is already nested from relational query
  } {
    // Filter out computed fields from sorts before building query context
    // Computed fields are handled separately in applySorting
    const computedFieldNames = params.computedFields ? Object.keys(params.computedFields) : [];
    const sortsForContext =
      params.sorting
        ?.filter((sort) => !computedFieldNames.includes(sort.columnId))
        .map((sort) => ({ columnId: sort.columnId })) || [];

    const context = this.relationshipManager.buildQueryContext(
      {
        columns: params.columns || [],
        filters: params.filters?.map((filter) => ({ columnId: filter.columnId })) || [],
        sorts: sortsForContext,
      },
      params.primaryTable
    );

    const selectResult = this.buildSelectQuery(
      context,
      params.primaryTable,
      params.columns,
      params.computedFields
    );
    const { query: dataQuery, columnMetadata, isNested } = selectResult;
    let finalDataQuery = this.applyFilters(
      dataQuery,
      params.filters || [],
      params.primaryTable,
      params.additionalConditions
    );
    finalDataQuery = this.applySorting(
      finalDataQuery,
      params.sorting || [],
      params.primaryTable,
      params.computedFields
    );
    if (params.pagination) {
      finalDataQuery = this.applyPagination(finalDataQuery, params.pagination);
    }

    let countQuery = this.buildCountQuery(context, params.primaryTable);
    countQuery = this.applyFilters(
      countQuery,
      params.filters || [],
      params.primaryTable,
      params.additionalConditions
    );

    return {
      dataQuery: finalDataQuery,
      countQuery,
      columnMetadata,
      ...(isNested !== undefined && { isNested }),
    };
  }

  /**
   * Type guard to check if an object has a specific property.
   */
  protected hasProperty<K extends PropertyKey>(obj: object, prop: K): obj is Record<K, unknown> {
    return prop in obj;
  }

  /**
   * Get query execution plan
   */
  getQueryPlan(query: QueryBuilderWithJoins): string {
    try {
      if (this.hasProperty(query, 'explain')) {
        const explainResult = query.explain;
        if (typeof explainResult === 'function') {
          // Bind the explain method to the query instance to preserve 'this' context
          const boundExplain = explainResult.bind(query);
          const result = boundExplain();
          return typeof result === 'string' ? result : 'Query plan not available';
        }
      }
      return 'Query plan not available';
    } catch {
      return 'Query plan not available';
    }
  }

  /**
   * Validate query before execution
   */
  validateQuery(query: QueryBuilderWithJoins): boolean {
    try {
      if (!query || query === null || query === undefined) {
        return false;
      }
      return this.hasProperty(query, 'execute') && typeof query.execute === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Validation methods
   */
  protected validateColumnId(columnId: string, primaryTable: string): void {
    if (!columnId || typeof columnId !== 'string') {
      throw new QueryError('Column ID must be a non-empty string', {
        columnId,
        type: typeof columnId,
      });
    }

    if (columnId.trim() !== columnId) {
      throw new QueryError('Column ID cannot have leading or trailing whitespace', {
        columnId,
        suggestion: columnId.trim(),
      });
    }

    if (!this.relationshipManager.validateColumnAccess(columnId, primaryTable)) {
      const accessibleColumns = this.relationshipManager.getAccessibleColumns(primaryTable);
      throw new QueryError(`Column '${columnId}' is not accessible`, {
        columnId,
        accessibleColumns: accessibleColumns.slice(0, 10),
        totalAccessibleColumns: accessibleColumns.length,
        suggestion: this.findSimilarColumn(columnId, accessibleColumns),
      });
    }
  }

  protected validateAggregateFunction(functionName: AggregateFunction): void {
    const validFunctions: AggregateFunction[] = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];

    if (!validFunctions.includes(functionName)) {
      throw new QueryError(`Invalid aggregate function: '${functionName}'`, {
        functionName,
        validFunctions,
        suggestion: this.findSimilarFunction(functionName, validFunctions),
      });
    }
  }

  protected validateAggregateColumnCompatibility(
    column: AnyColumnType,
    functionName: AggregateFunction
  ): void {
    if (functionName === 'count' || functionName === 'distinct') {
      return;
    }

    try {
      this.getAggregateFunction(column, functionName);
    } catch {
      throw new QueryError(`Column is not compatible with aggregate function '${functionName}'`, {
        functionName,
        columnType: 'unknown',
        compatibleFunctions: ['count', 'distinct'],
        suggestion: 'Use count() or distinct() for this column type',
      });
    }
  }

  protected validateMinMaxColumnCompatibility(column: AnyColumnType): void {
    try {
      min(column);
      max(column);
    } catch {
      throw new QueryError('Column is not compatible with min/max functions', {
        columnType: 'unknown',
        suggestion: 'Min/max functions require numeric, date, or string columns',
      });
    }
  }

  protected findSimilarColumn(targetColumn: string, availableColumns: string[]): string | null {
    const target = targetColumn.toLowerCase();

    const exactMatch = availableColumns.find((col) => col.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    const partialMatch = availableColumns.find(
      (col) => col.toLowerCase().includes(target) || target.includes(col.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const col of availableColumns) {
      const distance = calculateLevenshteinDistance(target, col.toLowerCase());
      if (distance < bestDistance && distance <= 2) {
        bestDistance = distance;
        bestMatch = col;
      }
    }

    return bestMatch;
  }

  protected findSimilarFunction(
    targetFunction: string,
    validFunctions: AggregateFunction[]
  ): AggregateFunction | null {
    const target = targetFunction.toLowerCase();

    const exactMatch = validFunctions.find((func) => func.toLowerCase() === target);
    if (exactMatch) return exactMatch;

    const partialMatch = validFunctions.find(
      (func) => func.toLowerCase().includes(target) || target.includes(func.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    return null;
  }
}
