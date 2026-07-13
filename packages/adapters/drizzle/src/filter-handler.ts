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
import type { ColumnType, FilterOperator, FilterState } from '@better-tables/core';
import { validateOperatorValues } from '@better-tables/core';
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
} from './types';
import { QueryError } from './types';

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

  constructor(
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    databaseType: DatabaseDriver,
    hooks?: FilterHandlerHooks
  ) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    if (hooks !== undefined) {
      this.hooks = hooks;
    }
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
      try {
        // Validate filter values before processing
        const validationResult = validateOperatorValues(
          filter.operator,
          filter.values,
          filter.type
        );
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
            const hasValidValues =
              expectedCount === 0 || (filter.values && filter.values.length >= expectedCount);

            if (
              !hasValidValues ||
              (expectedCount > 0 && filter.values.some((v) => v === undefined))
            ) {
              // Skip invalid filters silently - this allows for partial filter states in UI
              continue;
            }
          } else if (typeof validationResult === 'string') {
            // Operator is not supported by adapter or validation failed
            // We skip these silently to allow for partial states
            continue;
          } else {
            // Skip invalid filters silently for value validation errors
            continue;
          }
        }

        const columnPath = this.relationshipManager.resolveColumnPath(
          filter.columnId,
          primaryTable
        );

        if (columnPath.isNested && columnPath.relationshipPath) {
          // Add required joins
          for (const relationship of columnPath.relationshipPath) {
            requiredJoins.add(relationship.to);
          }
        }

        const condition = this.buildFilterCondition(filter, primaryTable);
        // Only add condition if it's defined (undefined means empty/invalid filter)
        if (condition !== undefined && condition !== null) {
          conditions.push(condition);
        }
      } catch (error) {
        // Re-throw the error to surface the issue instead of silently ignoring it
        throw new Error(
          `Invalid filter configuration for column '${filter.columnId}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { conditions, requiredJoins };
  }

  /**
   * Build compound filter conditions
   *
   * NOTE(plan-017): this flat and()/or() over per-filter leaf conditions —
   * together with `applyFilters` in base-query-builder.ts — is where the
   * recursive AND/OR filter-group walk from the contract-v2 design doc
   * (plans/design/core-contract-v2.md §1.5) will slot in: a group node's
   * children each resolve to a condition via `buildFilterCondition` (leaves)
   * or recursion (subgroups), then combine with and()/or() by node logic.
   * The router/emitter split underneath is already shaped for it — the
   * router owns condition COMBINATION, the emitter owns leaf predicates.
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
