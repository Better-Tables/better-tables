/**
 * @fileoverview Filter condition builder for Drizzle ORM
 * @module @better-tables/drizzle-adapter/filter-handler
 *
 * @description
 * Handles the translation of Better Tables filter operators to Drizzle ORM SQL conditions.
 *
 * As of plan 007 this class is a thin composition of two halves:
 * - `FilterRouter` (`@better-tables/adapters-toolkit`): ORM-agnostic operator
 *   classification, dispatch, value validation, and date-period math.
 * - `DrizzlePredicateEmitter` (this package): every Drizzle-specific leaf
 *   predicate — `eq`/`like`/`ilike`, JSONB extraction, PostgreSQL array
 *   operators, large IN-list batching.
 *
 * The public API (constructor, `buildFilterCondition`,
 * `handleCrossTableFilters`, `buildCompoundConditions`, ...) is unchanged, so
 * `base-query-builder.ts` call sites and the filter-handler test suites work
 * exactly as before the split.
 *
 * Supported operators include:
 * - Text: contains, equals, startsWith, endsWith, isEmpty, isNotEmpty, notEquals
 * - Number: equals, notEquals, greaterThan, lessThan, between, etc.
 * - Date: is, isNot, before, after, isToday, isThisWeek, isThisMonth, isThisYear
 * - Boolean: isTrue, isFalse
 * - Option: equals, notEquals, isAnyOf, isNoneOf
 * - Multi-Option: includes, excludes, includesAny, includesAll, excludesAny, excludesAll
 *
 * @example
 * ```typescript
 * const handler = new FilterHandler(schema, relationshipManager, 'postgres');
 * const condition = handler.buildFilterCondition(
 *   { columnId: 'email', operator: 'contains', values: ['@example.com'] },
 *   'users'
 * );
 * ```
 *
 * @see {@link FilterState} from @better-tables/core
 * @since 1.0.0
 */

import { FilterRouter, FilterRouterError } from '@better-tables/adapters-toolkit';
import type {
  ColumnType,
  FilterGroupNode,
  FilterNode,
  FilterOperator,
  FilterState,
} from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode, validateOperatorValues } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { and, or, sql } from 'drizzle-orm';
import { DrizzlePredicateEmitter } from './drizzle-predicate-emitter';
import type { RelationshipManager } from './relationship-manager';
import type {
  AnyColumnType,
  AnyTableType,
  ColumnOrExpression,
  ColumnPath,
  DatabaseDriver,
  FilterHandlerHooks,
  InvalidFilterBehavior,
} from './types';
import { DrizzleAdapterError, QueryError } from './types';

/**
 * Collect every {@link FilterState} leaf out of a `filters` value that may be
 * a flat implicit-AND array or a {@link FilterGroupNode} tree (plan 017).
 *
 * @description
 * Used wherever a caller needs the full, order-preserving set of columns a
 * filters value actually references — regardless of AND/OR nesting — most
 * importantly for JOIN planning (`RelationshipManager.buildQueryContext`
 * needs every leaf's `columnId`, or joins required by a leaf buried inside a
 * group would be silently missing from the query). A bare array is returned
 * unchanged (already leaves); a tree is flattened via core's
 * `flattenFilterNode`.
 */
export function collectFilterLeaves(
  filters: FilterState[] | FilterGroupNode | undefined
): FilterState[] {
  if (filters === undefined) {
    return [];
  }
  if (Array.isArray(filters)) {
    return filters;
  }
  return flattenFilterNode(filters);
}

/**
 * Recursively drop every leaf targeting `excludeColumnId` from a
 * {@link FilterNode}, per plan 021's self-exclusion faceting convention (see
 * `FacetQueryParams` in `@better-tables/core`): a group that becomes empty
 * after pruning its children is itself dropped (returns `null`), and a
 * group left with exactly one surviving child is unwrapped to that child --
 * the same normalization core's own `normalizeFilterNode` uses for
 * empty/singleton groups, kept consistent here rather than left as a
 * dangling single-child group.
 *
 * The current {@link FilterGroupNode} shape only has boolean `'and'/'or'`
 * groups over leaves or nested groups -- there is no NOT-like negation
 * construct a leaf could hide behind, so "is this leaf's columnId the
 * excluded one" is an unambiguous, purely structural check at every level
 * of the tree; this function never needs to special-case a shape it
 * doesn't recognize.
 */
function pruneNodeForColumn(node: FilterNode, excludeColumnId: string): FilterNode | null {
  if (isFilterGroupNode(node)) {
    const prunedChildren = node.children
      .map((child) => pruneNodeForColumn(child, excludeColumnId))
      .filter((child): child is FilterNode => child !== null);

    if (prunedChildren.length === 0) {
      return null;
    }
    if (prunedChildren.length === 1) {
      // and/or of one thing is that thing -- unwrap the singleton, mirroring
      // normalizeFilterNode's convention for empty/singleton groups.
      return prunedChildren[0] as FilterNode;
    }
    return { kind: 'group', logic: node.logic, children: prunedChildren };
  }

  return node.columnId === excludeColumnId ? null : node;
}

/**
 * Self-exclusion for facet queries (plan 021, ADAPTER-06): given the
 * caller's full active `filters` (flat array or {@link FilterGroupNode}
 * tree) and the `columnId` a facet is being computed for, return the same
 * filters with every leaf targeting `columnId` removed -- so a facet for a
 * column never has its own active filter applied against it (the standard
 * faceting convention: a multi-select facet keeps showing its sibling
 * options/counts instead of collapsing to only what's already selected).
 *
 * Returns `undefined` unchanged for `undefined` input, an (possibly empty)
 * array for flat input, and either a `FilterGroupNode` or a flat array for
 * tree input -- mirroring `DrizzleAdapter`'s own
 * `normalizeIncomingFilters` convention of wrapping a lone surviving leaf
 * in a single-element array rather than returning a bare `FilterState`.
 */
export function pruneFilterNodeForColumn(
  filters: FilterState[] | FilterGroupNode | undefined,
  excludeColumnId: string
): FilterState[] | FilterGroupNode | undefined {
  if (filters === undefined) {
    return undefined;
  }
  if (Array.isArray(filters)) {
    return filters.filter((filter) => filter.columnId !== excludeColumnId);
  }

  const pruned = pruneNodeForColumn(filters, excludeColumnId);
  if (pruned === null) {
    return [];
  }
  return isFilterGroupNode(pruned) ? pruned : [pruned];
}

/**
 * Filter handler that maps Better Tables filter operators to Drizzle conditions.
 *
 * @class FilterHandler
 * @description Handles conversion of filter states to SQL WHERE conditions by
 * composing the toolkit's `FilterRouter` (operator classification/dispatch)
 * with this package's `DrizzlePredicateEmitter` (leaf SQL construction).
 *
 * @property {Record<string, AnyTableType>} schema - The schema containing all tables
 * @property {RelationshipManager} relationshipManager - Manager for resolving relationships
 * @property {DatabaseDriver} databaseType - The database driver being used
 *
 * @security
 * All value parameterization and injection defenses live in
 * `DrizzlePredicateEmitter` — see its module docs. This class only resolves
 * column paths and orchestrates; it never interpolates user values into SQL.
 *
 * @example
 * ```typescript
 * const handler = new FilterHandler(schema, relationshipManager, 'postgres');
 * const condition = handler.buildFilterCondition(
 *   { columnId: 'email', operator: 'contains', values: ['test'] },
 *   'users'
 * );
 * ```
 *
 * @since 1.0.0
 */
export class FilterHandler {
  private schema: Record<string, AnyTableType>;
  private relationshipManager: RelationshipManager;
  private hooks?: FilterHandlerHooks;
  private emitter: DrizzlePredicateEmitter;
  private router: FilterRouter<ColumnOrExpression, SQL | SQLWrapper>;
  private onInvalidFilter: InvalidFilterBehavior;

  constructor(
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    databaseType: DatabaseDriver,
    hooks?: FilterHandlerHooks,
    onInvalidFilter: InvalidFilterBehavior = 'skip'
  ) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    if (hooks !== undefined) {
      this.hooks = hooks;
    }
    this.onInvalidFilter = onInvalidFilter;
    this.emitter = new DrizzlePredicateEmitter(schema, databaseType, hooks);
    this.router = new FilterRouter(this.emitter);
  }

  /**
   * Build filter condition from filter state.
   *
   * @description
   * Converts a filter state into a Drizzle SQL condition. This method handles
   * both direct column references and JSONB field extractions, ensuring type-safe
   * and secure SQL generation.
   *
   * @param filter - The filter state to build condition for
   * @param primaryTable - The primary table for this query context
   * @returns SQL condition for the filter, or undefined if no valid condition can be generated (e.g., empty values)
   *
   * @throws {QueryError} If the column is not found or the filter is invalid
   * @throws {RelationshipError} If the column path cannot be resolved
   *
   * @example
   * ```typescript
   * const condition = handler.buildFilterCondition(
   *   { columnId: 'email', operator: 'contains', values: ['@example.com'] },
   *   'users'
   * );
   * ```
   */
  buildFilterCondition(filter: FilterState, primaryTable: string): SQL | SQLWrapper | undefined {
    // Apply beforeBuildFilterCondition hook if provided
    let processedFilter = filter;
    if (this.hooks?.beforeBuildFilterCondition) {
      const hookResult = this.hooks.beforeBuildFilterCondition(filter, primaryTable);
      if (hookResult === null) {
        // Hook returned null, skip processing
        return undefined;
      }
      processedFilter = hookResult;
    }

    const columnPath = this.relationshipManager.resolveColumnPath(
      processedFilter.columnId,
      primaryTable
    );

    // Check if this is a JSONB accessor (columnId contains dot but is not a relationship)
    const isJsonbAccessor = this.isJsonbAccessor(columnPath);

    // Get the column or JSONB extraction expression
    let columnOrExpression: ColumnOrExpression;
    if (isJsonbAccessor) {
      columnOrExpression = this.emitter.buildJsonbExtraction(columnPath);
    } else {
      const column = this.getColumn(columnPath);
      if (!column) {
        // Limit information disclosure: Don't expose full schema structure in production
        // Only include minimal debugging information
        throw new QueryError(`Column not found: ${processedFilter.columnId}`, {
          columnId: processedFilter.columnId,
          table: columnPath.table,
          field: columnPath.field,
        });
      }
      columnOrExpression = column;
    }

    let condition: SQL | SQLWrapper | undefined;
    try {
      condition = this.router.mapOperatorToCondition(
        columnOrExpression,
        processedFilter.operator,
        processedFilter.values,
        processedFilter.includeNull,
        processedFilter.type
      );
    } catch (error) {
      // Preserve this package's public error contract: the router's own
      // error type is internal to the toolkit seam.
      if (error instanceof FilterRouterError) {
        throw new QueryError(error.message, error.details);
      }
      throw error;
    }

    // Return undefined if no valid condition was generated (e.g., empty values)
    // This allows callers to handle empty filters gracefully
    if (!condition) {
      return undefined as unknown as SQL | SQLWrapper;
    }

    // Apply afterBuildFilterCondition hook if provided
    if (this.hooks?.afterBuildFilterCondition) {
      return this.hooks.afterBuildFilterCondition(condition, processedFilter);
    }

    return condition;
  }

  /**
   * Check if a column path represents a JSONB accessor.
   *
   * @description
   * JSONB accessors are identified by having a dot in the columnId but not being
   * a nested relationship. This distinguishes them from relationship paths:
   * - JSONB accessor: `survey.title` (where `survey` is a JSONB column)
   * - Relationship: `profile.bio` (where `profile` is a related table)
   *
   * The relationship manager resolves JSONB accessors as non-nested paths with
   * the base column name as the field, allowing us to detect them here.
   *
   * @param columnPath - The column path to check
   * @returns True if this is a JSONB accessor, false otherwise
   */
  private isJsonbAccessor(columnPath: ColumnPath): boolean {
    // JSONB accessors have dots in columnId but isNested is false
    // (e.g., "survey.title" where "survey" is a JSONB column)
    return columnPath.columnId.includes('.') && !columnPath.isNested;
  }

  /**
   * Resolve a filter leaf that produced no WHERE condition because it was
   * malformed. Under `onInvalidFilter: 'throw'` this raises a {@link QueryError};
   * under `'skip'` (the default) it returns `undefined` so the leaf is dropped,
   * emitting a value-free `[better-tables]` warning only when the drop widens
   * results (an invalid operator) rather than for normal mid-edit UI state
   * (incomplete values).
   *
   * @param warnWhenSkipping - whether `'skip'` mode should warn. `true` for the
   *   result-widening invalid-operator case; `false` for incomplete values,
   *   where a warning would fire on every keystroke.
   * @returns always `undefined` (in `'skip'` mode); never returns in `'throw'`.
   */
  private handleDroppedLeaf(
    filter: FilterState,
    reason: string,
    warnWhenSkipping: boolean
  ): undefined {
    if (this.onInvalidFilter === 'throw') {
      throw new QueryError(
        `Filter on "${filter.columnId}" cannot be applied: ${reason} ` +
          'It was rejected because this adapter is configured with onInvalidFilter: "throw". ' +
          'Provide a valid operator and values, or set onInvalidFilter to "skip" to drop it instead.',
        { columnId: filter.columnId, operator: filter.operator, type: filter.type }
      );
    }
    if (warnWhenSkipping) {
      // Value-free by convention -- never log `filter.values`, matching
      // `normalizeFilterNode` / `deserializeFiltersFromURL`.
      // biome-ignore lint/suspicious/noConsole: intentional warning for a dropped filter that widens results
      console.warn(
        `[better-tables] Dropped filter on "${filter.columnId}": ${reason} ` +
          'The query will run WITHOUT this filter and may return more rows than intended.'
      );
    }
    return undefined;
  }

  /**
   * Validate and build a single filter leaf's condition (plan 017 extracted
   * this from {@link handleCrossTableFilters}'s loop body so both the flat
   * path and {@link buildTreeCondition}'s recursive walk share one leaf
   * contract). Returns `undefined` to mean "skip this leaf" — either because
   * core/adapter validation rejects it or because {@link buildFilterCondition}
   * itself found no condition to build (e.g. empty values).
   *
   * A malformed leaf (invalid operator, or incomplete values) is routed through
   * {@link handleDroppedLeaf}, which either drops it (`onInvalidFilter: 'skip'`,
   * the default) or throws a {@link QueryError} (`'throw'`) for callers whose
   * filters must all apply — see {@link InvalidFilterBehavior}.
   *
   * @throws {QueryError} When `onInvalidFilter: 'throw'` and a leaf is malformed.
   * @throws {Error} Wraps any resolution/build error with the offending
   *   `columnId`, surfacing it instead of silently swallowing it.
   */
  private buildLeafCondition(
    filter: FilterState,
    primaryTable: string
  ): SQL | SQLWrapper | undefined {
    try {
      // Validate filter values before processing
      const validationResult = validateOperatorValues(filter.operator, filter.values, filter.type);
      if (validationResult !== true) {
        // Check if the operator is supported by this adapter even if core doesn't recognize it
        // Only check adapter support if we have a valid filter type
        // Without a type, we can't safely determine which operators are supported
        let isSupportedByAdapter = false;
        if (filter.type) {
          const supportedOperators = this.getSupportedOperators(filter.type);
          isSupportedByAdapter = supportedOperators.includes(filter.operator);
        }

        // If operator is supported by adapter, allow it even if core validation fails
        // This handles cases like notEquals for text columns, where core only defines it for numbers
        if (isSupportedByAdapter) {
          // Operator is supported by adapter, proceed with building condition
          // But first ensure values are valid to avoid runtime errors (e.g. undefined operands)
          const expectedCount = this.getExpectedValueCount(filter.operator);
          // includeNull: true with empty values means "match null rows only"
          // (Option A, CORE-10) - it satisfies the value requirement here the
          // same way core's `validateFilter` treats it, so the leaf reaches
          // `buildFilterCondition` -> the router's IS NULL degradation
          // instead of being silently dropped.
          const nullOnlyIntent = filter.includeNull === true && filter.values.length === 0;
          const hasValidValues =
            expectedCount === 0 ||
            nullOnlyIntent ||
            (filter.values && filter.values.length >= expectedCount);

          if (
            !hasValidValues ||
            (expectedCount > 0 && filter.values.some((v) => v === undefined))
          ) {
            // Supported operator, but the values are missing/incomplete. In the
            // UI this is normal mid-edit state, so `'skip'` drops it silently.
            // Under `'throw'` it is a malformed programmatic filter and raises.
            return this.handleDroppedLeaf(
              filter,
              `operator "${filter.operator}" requires values that are missing or incomplete.`,
              false
            );
          }

          // Reaching here means core validation FAILED yet we have enough values
          // to build a predicate anyway — the operator is over-specified (surplus
          // values that translation silently ignores, e.g. `isEmpty` or a
          // single-value operator handed extra values). It still applies
          // correctly, so `'skip'` keeps it (no widening, unchanged behavior).
          // But `'throw'` promises to reject EVERY leaf core rejects, so surface
          // it — a caller in strict mode wants malformed filters flagged, not
          // quietly trimmed. `nullOnlyIntent` is a real match-null request, not a
          // tolerated malformation, so it is exempt.
          if (this.onInvalidFilter === 'throw' && !nullOnlyIntent) {
            return this.handleDroppedLeaf(
              filter,
              `operator "${filter.operator}" received values that do not match its expected shape for type "${filter.type ?? 'unknown'}".`,
              false
            );
          }
        } else {
          // The operator is not valid for this filter's type (unknown operator,
          // or one this adapter does not advertise for the type).
          //
          // This is NOT a partial UI state -- it is a malformed filter, and
          // dropping it WIDENS the result set: under implicit-AND a dropped
          // leaf returns MORE rows than asked for, so a scoping filter that is
          // silently discarded reads as "no restriction". Under `'skip'` it is
          // dropped with a warning (plan 038: partial URL/UI state must still
          // fetch); under `'throw'` it raises.
          return this.handleDroppedLeaf(
            filter,
            `operator "${filter.operator}" is not valid for type "${filter.type ?? 'unknown'}".`,
            true
          );
        }
      }

      const condition = this.buildFilterCondition(filter, primaryTable);
      // undefined means empty/invalid filter - treat the same as "skip"
      return condition !== undefined && condition !== null ? condition : undefined;
    } catch (error) {
      // Adapter errors (including a configured `onInvalidFilter: 'throw'`) are
      // already descriptive and carry a stable `code` — surface them unchanged
      // instead of flattening them into a generic Error and losing the type.
      if (error instanceof DrizzleAdapterError) {
        throw error;
      }
      // Re-throw anything else with the offending column for context.
      throw new Error(
        `Invalid filter configuration for column '${filter.columnId}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle cross-table filters
   */
  handleCrossTableFilters(
    filters: FilterState[],
    primaryTable: string
  ): {
    conditions: (SQL | SQLWrapper)[];
    requiredJoins: Set<string>;
  } {
    const conditions: (SQL | SQLWrapper)[] = [];
    const requiredJoins = new Set<string>();

    for (const filter of filters) {
      const condition = this.buildLeafCondition(filter, primaryTable);
      if (condition === undefined) {
        continue;
      }

      const columnPath = this.relationshipManager.resolveColumnPath(filter.columnId, primaryTable);
      if (columnPath.isNested && columnPath.relationshipPath) {
        // Add required joins
        for (const relationship of columnPath.relationshipPath) {
          requiredJoins.add(relationship.to);
        }
      }

      conditions.push(condition);
    }

    return { conditions, requiredJoins };
  }

  /**
   * Recursively translate a {@link FilterNode} — a filter leaf or a nested
   * AND/OR {@link FilterGroupNode} — into a single combined SQL condition
   * (plan 017; design `plans/design/core-contract-v2.md` §1.5).
   *
   * @description
   * Delegates node classification (leaf vs. group) and AND/OR combination to
   * the toolkit's `FilterRouter.buildNodeCondition`, supplying
   * {@link buildLeafCondition} as the leaf resolver so cross-table column
   * resolution, JSONB extraction, and the existing validate/skip semantics
   * apply identically inside a group as they do for a flat `FilterState[]`.
   *
   * @returns `undefined` when the tree has no surviving conditions (e.g. an
   *   empty group, or every leaf resolved to `undefined`)
   */
  buildTreeCondition(node: FilterNode, primaryTable: string): SQL | SQLWrapper | undefined {
    return this.router.buildNodeCondition(node, (leaf) =>
      this.buildLeafCondition(leaf, primaryTable)
    );
  }

  /**
   * Build compound filter conditions
   */
  buildCompoundConditions(
    filters: FilterState[],
    primaryTable: string,
    operator: 'and' | 'or' = 'and'
  ): SQL | SQLWrapper {
    const { conditions } = this.handleCrossTableFilters(filters, primaryTable);

    if (conditions.length === 0) {
      return sql`1=1`;
    }

    if (conditions.length === 1) {
      const condition = conditions[0];
      if (!condition) {
        throw new QueryError('No valid condition found', { operator, filters });
      }
      return condition;
    }

    const combinedCondition = operator === 'and' ? and(...conditions) : or(...conditions);
    if (!combinedCondition) {
      throw new QueryError('Failed to combine conditions', { operator, filters });
    }
    return combinedCondition;
  }

  /**
   * Get column from schema
   */
  private getColumn(columnPath: ColumnPath): AnyColumnType | null {
    // If nested, use the real table name from relationshipPath
    const realTableName =
      columnPath.isNested && columnPath.relationshipPath
        ? columnPath.relationshipPath[columnPath.relationshipPath.length - 1]?.to ||
          columnPath.table
        : columnPath.table;

    const table = this.schema[realTableName];
    if (!table) {
      return null;
    }

    return (table as unknown as Record<string, AnyColumnType>)[columnPath.field] || null;
  }

  /**
   * Get expected value count for an operator
   */
  getExpectedValueCount(operator: FilterOperator): number {
    return this.router.getExpectedValueCount(operator);
  }

  /**
   * Validate filter values
   */
  validateFilterValues(
    operator: FilterOperator,
    values: unknown[],
    columnType?: ColumnType
  ): boolean {
    return this.router.validateFilterValues(operator, values, columnType);
  }

  /**
   * Get supported operators for column type
   */
  getSupportedOperators(columnType: ColumnType): FilterOperator[] {
    return this.router.getSupportedOperators(columnType);
  }
}
