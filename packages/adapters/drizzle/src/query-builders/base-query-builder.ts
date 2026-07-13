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
import type {
  FilterGroupNode,
  FilterState,
  PaginationParams,
  SortingParams,
} from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  max,
  min,
  sql,
  sum,
} from 'drizzle-orm';
import { collectFilterLeaves, FilterHandler } from '../filter-handler';
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
 * Stringify a primary-key value for use as a `Map` key, consistently
 * between phase 1's key array and phase 2's per-row primary-key field.
 * Mirrors the primitive-vs-complex-type handling in
 * `DataTransformer.groupByMainTableKey` (adapters-toolkit) so the two
 * stay in sync even though they run in separate packages.
 */
function fanOutKeyToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Two-phase pagination wrapper for fan-out (one-to-many/array) joins (plan
 * 020, ADAPTER-03). Implements {@link QueryBuilderWithJoins} so it's a
 * drop-in `dataQuery` for `buildCompleteQuery`'s callers, which only ever
 * call `.execute()` on it -- the join/where/orderBy/limit/offset methods
 * are unreachable no-ops because the two phases are already fully built by
 * the time this wrapper is constructed (see `buildFanOutPaginatedDataQuery`).
 *
 * `execute()` runs phase 1 (the DISTINCT-primary-key page query) first; an
 * empty phase-1 result short-circuits to `[]` without ever issuing phase 2
 * with an empty `IN ()` list. Otherwise phase 2 (the full data query
 * filtered to exactly those keys, no LIMIT/OFFSET) runs and its rows --
 * every joined row for exactly one page's worth of primary keys -- are
 * returned for the existing flat-to-nested transform to group.
 *
 * Phase 1's key order is the *authoritative* page order: it's derived from
 * `GROUP BY pk` with `ORDER BY` aggregates (MIN/MAX) of the requested sort
 * columns plus a `pk asc` tiebreaker (see `buildFanOutKeyPageQuery`), which
 * is the only ordering that's actually consistent with "one row per primary
 * key". Phase 2 re-applies plain `applySorting` on raw, non-aggregated
 * columns with no primary-key tiebreaker -- correct for ordering *within* a
 * primary key's group of related rows, but not a reliable source of
 * cross-primary-key order: it can disagree with phase 1 outright under
 * multi-column sorts (aggregating MIN/MAX per column independently is not
 * the same as sorting by the tuple of columns from one row), and under
 * sort-value ties or empty `sorting` it has no explicit tiebreaker/`ORDER
 * BY` at all, leaving primary-row order to depend on the database's
 * unspecified default row order.
 *
 * So after phase 2 returns, its flat rows are stably reordered here to
 * match phase 1's key order exactly (`Array.prototype.sort` is a stable
 * sort per spec, so rows sharing a primary key keep the relative order
 * phase 2's `ORDER BY` gave them -- phase 2 sorting still determines
 * intra-group order, e.g. which of a user's posts comes first). This is
 * O(n) with a key-to-index map and issues no extra queries.
 */
class FanOutPaginatedQuery implements QueryBuilderWithJoins {
  constructor(
    private readonly phase1Query: QueryBuilderWithJoins,
    private readonly buildPhase2Query: (keys: unknown[]) => QueryBuilderWithJoins,
    private readonly primaryKeyColumnName: string
  ) {}

  leftJoin(_table: AnyTableType, _condition: SQL | SQLWrapper): QueryBuilderWithJoins {
    return this;
  }

  innerJoin(_table: AnyTableType, _condition: SQL | SQLWrapper): QueryBuilderWithJoins {
    return this;
  }

  select(_selections?: Record<string, AnyColumnType | SQL | SQLWrapper>): QueryBuilderWithJoins {
    return this;
  }

  where(_condition: SQL | SQLWrapper): QueryBuilderWithJoins {
    return this;
  }

  orderBy(..._clauses: (AnyColumnType | SQL | SQLWrapper)[]): QueryBuilderWithJoins {
    return this;
  }

  limit(_count: number): QueryBuilderWithJoins {
    return this;
  }

  offset(_count: number): QueryBuilderWithJoins {
    return this;
  }

  groupBy(..._columns: (AnyColumnType | SQL | SQLWrapper)[]): QueryBuilderWithJoins {
    return this;
  }

  async execute(): Promise<Record<string, unknown>[]> {
    const keyRows = await this.phase1Query.execute();
    if (keyRows.length === 0) {
      return [];
    }

    const keys = keyRows.map((row) => (row as { pk: unknown }).pk);
    const phase2Rows = await this.buildPhase2Query(keys).execute();

    // Reconcile phase-2 row order with phase 1's authoritative key order
    // (see class docstring). `Array.prototype.sort` is a stable sort, so
    // rows for the same primary key retain the relative order phase 2's
    // `ORDER BY` produced.
    const keyOrder = new Map<string, number>();
    keys.forEach((key, index) => {
      keyOrder.set(fanOutKeyToString(key), index);
    });

    const unknownKeyOrder = keys.length;
    return [...phase2Rows].sort((a, b) => {
      const aOrder =
        keyOrder.get(fanOutKeyToString(a[this.primaryKeyColumnName])) ?? unknownKeyOrder;
      const bOrder =
        keyOrder.get(fanOutKeyToString(b[this.primaryKeyColumnName])) ?? unknownKeyOrder;
      return aOrder - bOrder;
    });
  }
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
   * Resolve the full join order a facet query needs (plan 021, ADAPTER-06):
   * joins required by the facet `columnId` itself, plus joins required by
   * every leaf in `filters` (expected to already be self-excluded by the
   * caller -- see `pruneFilterNodeForColumn` in `filter-handler.ts`, which
   * `DrizzleAdapter.getFacetedValues`/`getMinMaxValues`/`getFilterOptions`
   * apply before reaching here). Reuses
   * `RelationshipManager.buildQueryContext`/`optimizeJoinOrder`, the same
   * join-planning path `buildCompleteQuery` uses for the main data/count
   * queries, so a facet query and the main query agree on how a given
   * column combination joins.
   */
  protected buildFacetJoinOrder(
    columnId: string,
    primaryTable: string,
    filters?: FilterState[] | FilterGroupNode
  ): RelationshipPath[] {
    const context = this.relationshipManager.buildQueryContext(
      {
        columns: [columnId],
        filters: collectFilterLeaves(filters).map((filter) => ({ columnId: filter.columnId })),
      },
      primaryTable
    );
    return this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);
  }

  /**
   * Build aggregate query for faceted values.
   * Shared implementation for all dialects.
   *
   * `filters` (plan 021, ADAPTER-06) is optional and, when present, is
   * expected to already be self-excluded for `columnId` by the caller. It's
   * ANDed with the column's own `isNotNull` guard via `applyFilters`'
   * `additionalConditions` -- one combined `WHERE`, not two competing
   * `.where()` calls (Drizzle's query builder only keeps the last `.where()`
   * call, it does not chain them).
   *
   * Join-inflation guard: under a join (whether from `columnId` itself or
   * from a filter leaf), a plain `count()` over-counts rows fanned out by
   * the join. When `aggregateFunction` is `'count'` and a join is present,
   * this uses `countDistinct(primaryKey)` instead -- the same guard
   * `buildCountQuery` already applies to pagination totals. Other aggregate
   * functions (`sum`/`avg`/`min`/`max`/`distinct`) are unaffected; guarding
   * those against join fan-out is a separate, pre-existing concern outside
   * this plan's scope (facet *counts* specifically).
   */
  buildAggregateQuery<TColumnId extends string>(
    columnId: TColumnId,
    aggregateFunction: AggregateFunction = 'count',
    primaryTable: string,
    filters?: FilterState[] | FilterGroupNode
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
    const joinOrder = this.buildFacetJoinOrder(columnId, primaryTable, filters);
    const primaryKeyInfo = this.primaryKeyMap[primaryTable];
    const aggregateFn =
      aggregateFunction === 'count' && joinOrder.length > 0 && primaryKeyInfo
        ? countDistinct(primaryKeyInfo.column)
        : this.getAggregateFunction(column, aggregateFunction);

    const baseQuery = this.getDb()
      .select({
        value: column,
        count: aggregateFn,
      })
      .from(mainTableSchema);

    const joinedQuery = this.applyJoins(baseQuery, joinOrder);
    const query = this.applyFilters(joinedQuery, filters || [], primaryTable, [isNotNull(column)]);

    return query.groupBy(column).orderBy(column);
  }

  /**
   * Build filter options query.
   * Shared implementation for all dialects.
   *
   * See {@link buildAggregateQuery}'s docs for the `filters` self-exclusion
   * expectation and the combined-`WHERE`/distinct-guard rationale, both
   * shared verbatim by this method's `count` column.
   */
  buildFilterOptionsQuery(
    columnId: string,
    primaryTable: string,
    filters?: FilterState[] | FilterGroupNode
  ): QueryBuilderWithJoins {
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

    const joinOrder = this.buildFacetJoinOrder(columnId, primaryTable, filters);
    const primaryKeyInfo = this.primaryKeyMap[primaryTable];
    const countFn =
      joinOrder.length > 0 && primaryKeyInfo ? countDistinct(primaryKeyInfo.column) : count();

    const baseQuery = this.getDb()
      .select({
        value: column,
        count: countFn,
      })
      .from(primaryTableSchema);

    const joinedQuery = this.applyJoins(baseQuery, joinOrder);
    const query = this.applyFilters(joinedQuery, filters || [], primaryTable, [isNotNull(column)]);

    return query.groupBy(column).orderBy(column);
  }

  /**
   * Build min/max values query.
   * Shared implementation for all dialects.
   *
   * `filters` (plan 021, ADAPTER-06) follows the same self-exclusion
   * expectation as {@link buildAggregateQuery}. No distinct-guard is needed
   * here: `MIN`/`MAX` of a value duplicated by a fan-out join is identical
   * to `MIN`/`MAX` of the de-duplicated set, unlike `count()`.
   */
  buildMinMaxQuery<TColumnId extends string>(
    columnId: TColumnId,
    primaryTable: string,
    filters?: FilterState[] | FilterGroupNode
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

    const joinOrder = this.buildFacetJoinOrder(columnId, primaryTable, filters);
    const joinedQuery = this.applyJoins(baseQuery, joinOrder);
    return this.applyFilters(joinedQuery, filters || [], primaryTable, [isNotNull(column)]);
  }

  /**
   * Apply filters to query
   *
   * Handles both shapes `FetchDataParams.filters` accepts (design
   * `plans/design/core-contract-v2.md` §1.5, plan 017): a flat `FilterState[]`
   * (implicit AND — the existing per-filter path via
   * `FilterHandler.handleCrossTableFilters`, unchanged) or a `FilterGroupNode`
   * tree, which recurses through `FilterHandler.buildTreeCondition` and
   * combines child conditions via `and()`/`or()` by each node's `logic`. The
   * router/emitter split (plan 007 step 4) keeps condition COMBINATION at
   * this layer either way, with leaf predicate construction behind the
   * `PredicateEmitter` interface.
   */
  applyFilters(
    query: QueryBuilderWithJoins,
    filters: FilterState[] | FilterGroupNode,
    primaryTable: string,
    additionalConditions?: (SQL | SQLWrapper)[]
  ): QueryBuilderWithJoins {
    const allConditions: (SQL | SQLWrapper)[] = [];

    // Add conditions from regular filters. `filters` is falsy-tolerant
    // (null/undefined) for the same reason the pre-plan-017 flat path was --
    // callers historically pass `filters || []` and some (including this
    // class's own test suite) still pass a bare `null`.
    if (filters) {
      if (Array.isArray(filters)) {
        if (filters.length > 0) {
          const { conditions } = this.filterHandler.handleCrossTableFilters(filters, primaryTable);
          const validConditions = conditions.filter(
            (condition): condition is SQL | SQLWrapper => condition !== undefined
          );
          allConditions.push(...validConditions);
        }
      } else {
        const condition = this.filterHandler.buildTreeCondition(filters, primaryTable);
        if (condition !== undefined) {
          allConditions.push(condition);
        }
      }
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
   * Detect whether a join order contains a fan-out (one-to-many/array)
   * relationship (plan 020, ADAPTER-03). `RelationshipPath.cardinality`
   * already carries this: `'many'` means the join multiplies primary-table
   * rows (one-to-many), `'one'` means it doesn't (many-to-one/one-to-one).
   * Array-FK relationships are always detected with `cardinality: 'many'`
   * (see `RelationshipDetector`), so checking `isArray` too is belt-and-
   * suspenders, not a separate case. A many-to-one-only join order (gate
   * false) never row-multiplies, so pagination there is already correct.
   */
  protected hasFanOutJoin(joinOrder: RelationshipPath[]): boolean {
    return joinOrder.some(
      (relationship) => relationship.cardinality === 'many' || relationship.isArray === true
    );
  }

  /**
   * Build ORDER BY clauses for the phase-1 fan-out key-page query (plan
   * 020). Phase 1 groups by the primary key only, so any sort column from
   * a joined table (or the primary table, functionally determined by the
   * group) must be wrapped in an aggregate to stay valid SQL under GROUP
   * BY across Postgres/MySQL/SQLite. MIN for ascending and MAX for
   * descending sorts each group by its most-extreme matching value in the
   * requested direction -- deterministic and dialect-portable, at the cost
   * of not having one canonical "the" value to sort a fanned-out group by
   * (there isn't one; the multi-valued semantics are inherently ambiguous).
   */
  protected buildFanOutOrderByClauses(
    sorting: SortingParams[],
    primaryTable: string,
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>
  ): (SQL | SQLWrapper)[] {
    if (!sorting || sorting.length === 0) {
      return [];
    }

    return sorting.map((sort) => {
      const computedField = computedFields?.[sort.columnId];
      if (computedField?.__resolvedSortSql !== undefined) {
        return sort.direction === 'desc'
          ? desc(max(computedField.__resolvedSortSql))
          : asc(min(computedField.__resolvedSortSql));
      }

      const columnPath = this.relationshipManager.resolveColumnPath(sort.columnId, primaryTable);
      const column = this.getColumn(columnPath);

      if (!column) {
        throw new QueryError(`Column not found for sorting: ${sort.columnId}`, {
          columnId: sort.columnId,
        });
      }

      return sort.direction === 'desc' ? desc(max(column)) : asc(min(column));
    });
  }

  /**
   * Build phase 1 of the two-phase fan-out pagination fix (plan 020):
   * the page of DISTINCT primary keys under the same joins/filters as the
   * real data query, `GROUP BY` the primary key, ordered by aggregates of
   * the requested sort columns (see `buildFanOutOrderByClauses`) with the
   * primary key itself as a final deterministic tiebreaker, then
   * LIMIT/OFFSET. This is what makes a "page of `limit`" mean `limit`
   * distinct primary rows instead of `limit` fanned-out join rows.
   */
  protected buildFanOutKeyPageQuery(
    joinOrder: RelationshipPath[],
    primaryTable: string,
    primaryKeyInfo: { columnName: string; column: AnyColumnType },
    filters: FilterState[] | FilterGroupNode,
    sorting: SortingParams[],
    pagination: PaginationParams,
    additionalConditions?: (SQL | SQLWrapper)[],
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql>
  ): QueryBuilderWithJoins {
    const primaryTableSchema = this.schema[primaryTable];
    if (!primaryTableSchema) {
      throw new QueryError(`Primary table not found: ${primaryTable}`, { primaryTable });
    }

    const baseQuery = this.getDb().select({ pk: primaryKeyInfo.column }).from(primaryTableSchema);
    const joinedQuery = this.applyJoins(baseQuery, joinOrder);
    const filteredQuery = this.applyFilters(
      joinedQuery,
      filters,
      primaryTable,
      additionalConditions
    );
    const groupedQuery = filteredQuery.groupBy(primaryKeyInfo.column);

    const orderByClauses = this.buildFanOutOrderByClauses(sorting, primaryTable, computedFields);
    const orderedQuery = groupedQuery.orderBy(...orderByClauses, asc(primaryKeyInfo.column));

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    return orderedQuery.limit(limit).offset(offset);
  }

  /**
   * Build the full two-phase fan-out `dataQuery` (plan 020): phase 1 (see
   * `buildFanOutKeyPageQuery`) plus a phase-2 builder closure that reruns
   * the normal flat select/filter/sort pipeline with an added `WHERE
   * primaryKey IN (phase-1 keys)` and no LIMIT/OFFSET, deferred inside a
   * {@link FanOutPaginatedQuery} so phase 1 only executes when the caller
   * calls `.execute()` on the returned `dataQuery`.
   */
  protected buildFanOutPaginatedDataQuery(params: {
    context: QueryContext;
    joinOrder: RelationshipPath[];
    primaryTable: string;
    primaryKeyInfo: { columnName: string; column: AnyColumnType };
    columns?: string[] | undefined;
    computedFields?: Record<string, ComputedFieldWithResolvedSortSql> | undefined;
    filters: FilterState[] | FilterGroupNode;
    sorting: SortingParams[];
    pagination: PaginationParams;
    additionalConditions?: (SQL | SQLWrapper)[] | undefined;
  }): QueryBuilderWithJoins {
    const {
      context,
      joinOrder,
      primaryTable,
      primaryKeyInfo,
      columns,
      computedFields,
      filters,
      sorting,
      pagination,
      additionalConditions,
    } = params;

    const phase1Query = this.buildFanOutKeyPageQuery(
      joinOrder,
      primaryTable,
      primaryKeyInfo,
      filters,
      sorting,
      pagination,
      additionalConditions,
      computedFields
    );

    const buildPhase2Query = (keys: unknown[]): QueryBuilderWithJoins => {
      const phase2SelectResult = this.buildSelectQuery(
        context,
        primaryTable,
        columns,
        computedFields
      );
      const primaryKeyInCondition = inArray(primaryKeyInfo.column, keys);
      let phase2Query = this.applyFilters(phase2SelectResult.query, filters, primaryTable, [
        ...(additionalConditions || []),
        primaryKeyInCondition,
      ]);
      phase2Query = this.applySorting(phase2Query, sorting, primaryTable, computedFields);
      return phase2Query;
    };

    return new FanOutPaginatedQuery(phase1Query, buildPhase2Query, primaryKeyInfo.columnName);
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
    filters?: FilterState[] | FilterGroupNode;
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

    // Join planning must see every leaf's columnId, including ones nested
    // inside a FilterGroupNode tree (plan 017) — collectFilterLeaves flattens
    // either shape so a leaf buried in a group still contributes its JOIN.
    const context = this.relationshipManager.buildQueryContext(
      {
        columns: params.columns || [],
        filters: collectFilterLeaves(params.filters).map((filter) => ({
          columnId: filter.columnId,
        })),
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
    const { columnMetadata, isNested } = selectResult;

    // Plan 020 (ADAPTER-03): under a fan-out (one-to-many/array) join,
    // LIMIT/OFFSET on the row-multiplied flat join result under-fills pages
    // -- a "page of `limit`" flat rows can be fewer than `limit` distinct
    // primary rows. Gate on the join order actually carrying a fan-out
    // relationship (never true on the Postgres relational-query path,
    // which nests instead of flattening -- `isNested` is the signal) and
    // rewrite pagination as two phases (see `buildFanOutPaginatedDataQuery`).
    // A many-to-one-only join order (gate false) keeps this exact
    // single-query path, byte-for-byte unchanged.
    const joinOrder = this.relationshipManager.optimizeJoinOrder(
      context.joinPaths,
      params.primaryTable
    );
    const primaryKeyInfo = this.primaryKeyMap[params.primaryTable];
    const isFanOutJoin = !isNested && this.hasFanOutJoin(joinOrder);

    let finalDataQuery: QueryBuilderWithJoins;
    if (isFanOutJoin && params.pagination && primaryKeyInfo) {
      finalDataQuery = this.buildFanOutPaginatedDataQuery({
        context,
        joinOrder,
        primaryTable: params.primaryTable,
        primaryKeyInfo,
        columns: params.columns,
        computedFields: params.computedFields,
        filters: params.filters || [],
        sorting: params.sorting || [],
        pagination: params.pagination,
        additionalConditions: params.additionalConditions,
      });
    } else {
      finalDataQuery = this.applyFilters(
        selectResult.query,
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
