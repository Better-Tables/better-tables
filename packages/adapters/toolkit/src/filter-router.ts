/**
 * @fileoverview ORM-agnostic filter operator classification and dispatch
 * @module @better-tables/adapters-toolkit/filter-router
 *
 * @description
 * `FilterRouter` owns everything about mapping a Better Tables filter
 * operator to a SQL condition that does NOT require an ORM client:
 * operator category classification (`isTextOperator` etc.), the
 * classify-then-dispatch skeleton that used to be `FilterHandler`'s
 * `mapOperatorToCondition`, value-shape/count validation, and the pure date
 * arithmetic behind the relative date-period operators (`isToday`,
 * `isThisWeek`, ...).
 *
 * Everything that actually *constructs* a leaf SQL predicate — `eq`,
 * `like`/`ilike`, JSONB extraction, PostgreSQL array operators, and so on —
 * is dialect-specific and lives on the adapter's own {@link PredicateEmitter}
 * implementation (e.g. Drizzle's `DrizzlePredicateEmitter`). The router
 * never imports an ORM client; it only calls through the emitter interface.
 *
 * Router vs. emitter responsibility split (this matters for plan 017, see
 * below): the router decides WHICH leaf predicate(s) a filter needs and how
 * multiple leaves COMBINE (`and`/`or`); the emitter only ever produces a
 * single leaf predicate or combines predicates the router hands it.
 */

import type { ColumnType, FilterOperator } from '@better-tables/core';
import { getOperatorDefinition, validateOperatorValues } from '@better-tables/core';

/**
 * Thrown by {@link FilterRouter.mapOperatorToCondition} when an operator
 * doesn't match any known category. In practice this is unreachable through
 * normal use (core's operator validation and `getSupportedOperators` both
 * reject unknown operators before this point) — it exists as a defensive
 * invariant check, not a user-facing validation error.
 */
export class FilterRouterError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FilterRouterError';
  }
}

/**
 * Dialect-specific leaf predicate construction, implemented once per
 * adapter. `TColumn` is the adapter's own column/expression representation
 * (e.g. Drizzle's `AnyColumnType | SQL | SQLWrapper`); `TPredicate` is its
 * SQL condition representation (e.g. Drizzle's `SQL | SQLWrapper`). Both
 * stay fully opaque to {@link FilterRouter} — it only ever passes them
 * through.
 *
 * Each `xOperator` method mirrors one of {@link FilterRouter}'s operator
 * category classifiers and receives exactly the operators that classifier
 * matches; returning `undefined` signals "no condition for this input"
 * (e.g. empty/invalid values), which the router treats as an empty filter
 * rather than an error.
 */
export interface PredicateEmitter<TColumn, TPredicate> {
  textOperator(column: TColumn, operator: string, values: unknown[]): TPredicate | undefined;
  numberOperator(column: TColumn, operator: string, values: unknown[]): TPredicate | undefined;
  dateOperator(
    column: TColumn,
    operator: string,
    values: unknown[],
    columnType?: string
  ): TPredicate | undefined;
  booleanOperator(column: TColumn, operator: string, values: unknown[]): TPredicate | undefined;
  optionOperator(column: TColumn, operator: string, values: unknown[]): TPredicate | undefined;
  multiOptionOperator(column: TColumn, operator: string, values: unknown[]): TPredicate | undefined;
  universalOperator(column: TColumn, operator: string): TPredicate | undefined;

  /** IS NULL leaf predicate — used by the router when `includeNull` is set. */
  isNullCondition(column: TColumn): TPredicate;

  /** Combine two or more predicates with AND. */
  and(...conditions: TPredicate[]): TPredicate;

  /** Combine two or more predicates with OR. */
  or(...conditions: TPredicate[]): TPredicate;
}

/** A relative date period supported by the `isX` date operators. */
export type DatePeriod = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear';

/** Inclusive boundaries of a relative date period, in local time. */
export interface DatePeriodRange {
  start: Date;
  end: Date;
}

/**
 * Compute the inclusive [start, end] boundary of a relative date period,
 * anchored to "now" at call time. Pure date arithmetic — extracted from what
 * was `FilterHandler.buildDateCondition` so it has zero SQL/ORM dependency;
 * adapters turn the returned range into a dialect-specific range condition
 * (e.g. Drizzle's `createDateRangeCondition`).
 */
export function computeDatePeriodRange(period: DatePeriod): DatePeriodRange {
  const now = new Date();

  switch (period) {
    case 'today': {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { start: startOfDay, end: endOfDay };
    }

    case 'yesterday': {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const startOfYesterday = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate()
      );
      const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { start: startOfYesterday, end: endOfYesterday };
    }

    case 'thisWeek': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      endOfWeek.setHours(0, 0, 0, 0);

      // Use explicit range since end date is exclusive for 'thisWeek' calculation logic
      // But the helper does inclusive, so we adjust end date to be end of previous day
      const inclusiveEndOfWeek = new Date(endOfWeek.getTime() - 1);
      return { start: startOfWeek, end: inclusiveEndOfWeek };
    }

    case 'thisMonth': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const inclusiveEndOfMonth = new Date(endOfMonth.getTime() - 1);
      return { start: startOfMonth, end: inclusiveEndOfMonth };
    }

    case 'thisYear': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
      const inclusiveEndOfYear = new Date(endOfYear.getTime() - 1);
      return { start: startOfYear, end: inclusiveEndOfYear };
    }

    default: {
      // Exhaustiveness guard — TypeScript already rejects invalid `period`
      // values at the call site since DatePeriod is a closed union.
      const _exhaustive: never = period;
      throw new FilterRouterError(`Unsupported date period: ${_exhaustive}`, {
        period: _exhaustive,
      });
    }
  }
}

/**
 * Routes a Better Tables filter operator to the correct
 * {@link PredicateEmitter} leaf method and combines the result with an
 * optional `includeNull` branch. This is the ORM-agnostic half of what was
 * `FilterHandler`; adapters compose it with their own `PredicateEmitter`
 * implementation.
 *
 * @see {@link https://github.com/Better-Tables/better-tables|plan 007 design}
 */
export class FilterRouter<TColumn, TPredicate> {
  constructor(private emitter: PredicateEmitter<TColumn, TPredicate>) {}

  // --- Operator category classifiers ---

  isTextOperator(op: string): boolean {
    return [
      'contains',
      'equals',
      'startsWith',
      'endsWith',
      'isEmpty',
      'isNotEmpty',
      'notEquals',
    ].includes(op);
  }
  isNumberOperator(op: string): boolean {
    return [
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'between',
      'notBetween',
    ].includes(op);
  }
  isDateOperator(op: string): boolean {
    return [
      'is',
      'isNot',
      'before',
      'after',
      'isToday',
      'isYesterday',
      'isThisWeek',
      'isThisMonth',
      'isThisYear',
    ].includes(op);
  }
  isBooleanOperator(op: string): boolean {
    return ['isTrue', 'isFalse'].includes(op);
  }
  isOptionOperator(op: string): boolean {
    return ['isAnyOf', 'isNoneOf'].includes(op);
  }
  isMultiOptionOperator(op: string): boolean {
    return [
      'includes',
      'excludes',
      'includesAny',
      'includesAll',
      'excludesAny',
      'excludesAll',
    ].includes(op);
  }
  isUniversalOperator(op: string): boolean {
    return ['isNull', 'isNotNull'].includes(op);
  }

  /**
   * Map filter operator to a SQL condition.
   *
   * @description
   * Central dispatcher that classifies `operator` into a category and
   * delegates leaf predicate construction to the emitter. Combining an
   * `includeNull` branch with the operator's own condition (or combining
   * multiple leaves) is ROUTER responsibility — the emitter only ever
   * builds or combines the predicates it's handed.
   *
   * NOTE(plan-017): today `values`/`operator` always describe a single flat
   * `FilterState` leaf, and callers combine multiple filters with a flat
   * `and(...)` one level up (see `FilterHandler.handleCrossTableFilters` /
   * `buildCompoundConditions` in the Drizzle package, and
   * `base-query-builder.ts`'s `applyFilters`). Plan 017's recursive AND/OR
   * filter-group walk slots in at that same "combine multiple leaves"
   * layer — it doesn't change this method's leaf-emission contract at all,
   * since a filter *group* is just a node whose children are recursively
   * resolved to conditions and then combined via `emitter.and`/`emitter.or`,
   * exactly like this method already does for the `includeNull` branch.
   *
   * @throws {FilterRouterError} If the operator matches no known category
   */
  mapOperatorToCondition(
    column: TColumn,
    operator: FilterOperator,
    values: unknown[],
    includeNull?: boolean,
    columnType?: string
  ): TPredicate | undefined {
    const conditions: TPredicate[] = [];

    // Handle null inclusion
    if (includeNull && operator !== 'isNull' && operator !== 'isNotNull') {
      conditions.push(this.emitter.isNullCondition(column));
    }

    let condition: TPredicate | undefined;

    // Dispatch to the emitter's leaf handler for this operator's category
    if (this.isTextOperator(operator)) {
      condition = this.emitter.textOperator(column, operator, values);
    } else if (this.isNumberOperator(operator)) {
      condition = this.emitter.numberOperator(column, operator, values);
    } else if (this.isDateOperator(operator)) {
      condition = this.emitter.dateOperator(column, operator, values, columnType);
    } else if (this.isBooleanOperator(operator)) {
      condition = this.emitter.booleanOperator(column, operator, values);
    } else if (this.isOptionOperator(operator)) {
      condition = this.emitter.optionOperator(column, operator, values);
    } else if (this.isMultiOptionOperator(operator)) {
      condition = this.emitter.multiOptionOperator(column, operator, values);
    } else if (this.isUniversalOperator(operator)) {
      condition = this.emitter.universalOperator(column, operator);
    } else {
      throw new FilterRouterError(`Unsupported filter operator: ${operator}`, {
        operator,
        values,
      });
    }

    if (condition !== undefined) {
      conditions.push(condition);
    }

    // If no conditions were generated (e.g., empty values), return undefined
    // This allows callers to handle empty filters gracefully
    if (conditions.length === 0) {
      return undefined;
    }

    if (conditions.length === 1) {
      const only = conditions[0];
      if (only === undefined) {
        throw new FilterRouterError('No valid condition found', { operator, values });
      }
      return only;
    }

    // When includeNull is true, we want: (main_condition OR column IS NULL)
    // For other cases (shouldn't happen, but defensive), use AND
    return includeNull ? this.emitter.or(...conditions) : this.emitter.and(...conditions);
  }

  /**
   * Get expected value count for an operator.
   */
  getExpectedValueCount(operator: FilterOperator): number {
    const definition = getOperatorDefinition(operator);
    if (!definition) {
      return 1; // Default fallback
    }

    if (typeof definition.valueCount === 'number') {
      return definition.valueCount;
    }

    // For operators that accept "at least 1" value (variable)
    return 1;
  }

  /**
   * Validate filter values against core's operator definitions.
   */
  validateFilterValues(
    operator: FilterOperator,
    values: unknown[],
    columnType?: ColumnType
  ): boolean {
    const result = validateOperatorValues(operator, values, columnType);
    return result === true;
  }

  /**
   * Get supported operators for a column type.
   */
  getSupportedOperators(columnType: ColumnType): FilterOperator[] {
    const baseOperators: FilterOperator[] = ['isNull', 'isNotNull'];

    switch (columnType) {
      case 'text':
        return [
          ...baseOperators,
          'contains',
          'equals',
          'startsWith',
          'endsWith',
          'isEmpty',
          'isNotEmpty',
          'notEquals',
        ];

      case 'number':
        return [
          ...baseOperators,
          'equals',
          'notEquals',
          'greaterThan',
          'greaterThanOrEqual',
          'lessThan',
          'lessThanOrEqual',
          'between',
          'notBetween',
        ];

      case 'date':
        return [
          ...baseOperators,
          'is',
          'isNot',
          'before',
          'after',
          'isToday',
          'isYesterday',
          'isThisWeek',
          'isThisMonth',
          'isThisYear',
        ];

      case 'boolean':
        return [...baseOperators, 'isTrue', 'isFalse'];

      case 'option':
        return [...baseOperators, 'equals', 'notEquals', 'isAnyOf', 'isNoneOf'];

      case 'multiOption':
        return [
          ...baseOperators,
          'includes',
          'excludes',
          'includesAny',
          'includesAll',
          'excludesAny',
          'excludesAll',
        ];

      default:
        return baseOperators;
    }
  }
}
