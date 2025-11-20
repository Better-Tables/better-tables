/**
 * @fileoverview Filter condition builder for Drizzle ORM
 * @module @better-tables/drizzle-adapter/filter-handler
 *
 * @description
 * Handles the translation of Better Tables filter operators to Drizzle ORM SQL conditions.
 * This module provides a comprehensive mapping of all supported filter operators to their
 * corresponding Drizzle SQL expressions, ensuring type-safe and database-agnostic filtering.
 *
 * Key capabilities:
 * - Maps filter operators to Drizzle SQL conditions
 * - Handles text, number, date, boolean, and custom column types
 * - Supports case-insensitive search across all database drivers
 * - Handles array/JSON column filtering
 * - Provides database-specific optimizations
 * - Validates filter values before application
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

import type { ColumnType, FilterOperator, FilterState } from '@better-tables/core';
import { getOperatorDefinition, validateOperatorValues } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  not,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { RelationshipManager } from './relationship-manager';
import type { AnyColumnType, AnyTableType, ColumnPath, DatabaseDriver } from './types';
import { QueryError } from './types';

/**
 * Filter handler that maps Better Tables filter operators to Drizzle conditions.
 *
 * @class FilterHandler
 * @description Handles conversion of filter states to SQL WHERE conditions
 *
 * @property {Record<string, AnyTableType>} schema - The schema containing all tables
 * @property {RelationshipManager} relationshipManager - Manager for resolving relationships
 * @property {DatabaseDriver} databaseType - The database driver being used
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
  private databaseType: DatabaseDriver;

  constructor(
    schema: Record<string, AnyTableType>,
    relationshipManager: RelationshipManager,
    databaseType: DatabaseDriver
  ) {
    this.schema = schema;
    this.relationshipManager = relationshipManager;
    this.databaseType = databaseType;
  }

  /**
   * Build filter condition from filter state
   * @param filter - The filter state to build condition for
   * @param primaryTable - The primary table for this query context
   */
  buildFilterCondition(filter: FilterState, primaryTable: string): SQL | SQLWrapper {
    const columnPath = this.relationshipManager.resolveColumnPath(filter.columnId, primaryTable);
    const column = this.getColumn(columnPath);

    if (!column) {
      throw new QueryError(`Column not found: ${filter.columnId}`, {
        columnId: filter.columnId,
        table: columnPath.table,
      });
    }

    return this.mapOperatorToCondition(
      column,
      filter.operator,
      filter.values,
      filter.includeNull,
      filter.type
    );
  }

  /**
   * Get case-insensitive like condition based on database type
   */
  private getCaseInsensitiveLike(column: AnyColumnType, pattern: string): SQL | SQLWrapper {
    if (this.databaseType === 'sqlite') {
      // SQLite doesn't support ilike, so we use like with LOWER() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else if (this.databaseType === 'mysql') {
      // MySQL doesn't support ilike, so we use like with LOWER() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else {
      // PostgreSQL supports ilike
      return ilike(column, pattern);
    }
  }

  /**
   * Cast value to date SQL based on database type
   */
  private castToDateSQL(value: Date | number | string): SQL {
    if (this.databaseType === 'sqlite') {
      return sql`${value}`;
    }
    if (this.databaseType === 'postgres') {
      return sql`${value}::timestamp`;
    }
    // MySQL
    return sql`CAST(${value} AS DATETIME)`;
  }

  /**
   * Create date comparison condition
   */
  private createDateComparisonCondition(
    column: AnyColumnType,
    operator: '=' | '!=' | '<' | '>' | '>=' | '<=',
    value: Date | number | string
  ): SQL | SQLWrapper {
    // For SQLite with timestamp mode, compare as numbers if value is number
    if (this.databaseType === 'sqlite' && typeof value === 'number') {
      return sql`${column} ${sql.raw(operator)} ${value}`;
    }

    // For PostgreSQL and MySQL, ensure proper casting
    const castValue = this.castToDateSQL(value);
    return sql`${column} ${sql.raw(operator)} ${castValue}`;
  }

  /**
   * Create date range condition (inclusive)
   */
  private createDateRangeCondition(
    column: AnyColumnType,
    startDate: Date | string,
    endDate: Date | string
  ): SQL | SQLWrapper {
    // Format dates for SQL
    const startVal =
      typeof startDate === 'string'
        ? startDate
        : this.databaseType === 'sqlite'
          ? startDate.getTime()
          : startDate.toISOString();

    const endVal =
      typeof endDate === 'string'
        ? endDate
        : this.databaseType === 'sqlite'
          ? endDate.getTime()
          : endDate.toISOString();

    if (this.databaseType === 'postgres' || this.databaseType === 'mysql') {
      const startCast = this.castToDateSQL(startVal);
      const endCast = this.castToDateSQL(endVal);
      return sql`${column} >= ${startCast} AND ${column} <= ${endCast}`;
    }

    // Generic fallback (works for SQLite number timestamps too)
    const condition = and(gte(column, startVal), lte(column, endVal));
    if (!condition) {
      // Should effectively never happen with valid inputs
      throw new QueryError('Failed to create date range condition');
    }
    return condition;
  }

  /**
   * Decomposed operator handler
   */
  private mapOperatorToCondition(
    column: AnyColumnType,
    operator: FilterOperator,
    values: unknown[],
    includeNull?: boolean,
    columnType?: string
  ): SQL | SQLWrapper {
    const conditions: (SQL | SQLWrapper)[] = [];

    // Handle null inclusion
    if (includeNull && operator !== 'isNull' && operator !== 'isNotNull') {
      conditions.push(isNull(column));
    }

    let condition: SQL | SQLWrapper | undefined;

    // Dispatch to specific handlers
    if (this.isTextOperator(operator)) {
      condition = this.handleTextOperator(column, operator, values);
    } else if (this.isNumberOperator(operator)) {
      condition = this.handleNumberOperator(column, operator, values);
    } else if (this.isDateOperator(operator)) {
      condition = this.handleDateOperator(column, operator, values, columnType);
    } else if (this.isBooleanOperator(operator)) {
      condition = this.handleBooleanOperator(column, operator, values);
    } else if (this.isOptionOperator(operator)) {
      condition = this.handleOptionOperator(column, operator, values);
    } else if (this.isMultiOptionOperator(operator)) {
      condition = this.handleMultiOptionOperator(column, operator, values);
    } else if (this.isUniversalOperator(operator)) {
      condition = this.handleUniversalOperator(column, operator);
    } else {
      throw new QueryError(`Unsupported filter operator: ${operator}`, { operator, values });
    }

    if (condition) {
      conditions.push(condition);
    }

    if (conditions.length === 0) {
      throw new QueryError('No valid conditions generated', { operator, values });
    }

    if (conditions.length === 1) {
      const condition = conditions[0];
      if (!condition) {
        throw new QueryError('No valid condition found', { operator, values });
      }
      return condition;
    }

    const combinedCondition = and(...conditions);
    if (!combinedCondition) {
      throw new QueryError('Failed to combine conditions', { operator, values });
    }
    return combinedCondition;
  }

  // Helpers to classify operators
  private isTextOperator(op: string): boolean {
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
  private isNumberOperator(op: string): boolean {
    return [
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'between',
      'notBetween',
    ].includes(op);
  }
  private isDateOperator(op: string): boolean {
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
  private isBooleanOperator(op: string): boolean {
    return ['isTrue', 'isFalse'].includes(op);
  }
  private isOptionOperator(op: string): boolean {
    return ['isAnyOf', 'isNoneOf'].includes(op);
  }
  private isMultiOptionOperator(op: string): boolean {
    return [
      'includes',
      'excludes',
      'includesAny',
      'includesAll',
      'excludesAny',
      'excludesAll',
    ].includes(op);
  }
  private isUniversalOperator(op: string): boolean {
    return ['isNull', 'isNotNull'].includes(op);
  }

  // --- Specific Operator Handlers ---

  private handleTextOperator(
    column: AnyColumnType,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'contains':
        return this.getCaseInsensitiveLike(column, `%${values[0]}%`);
      case 'equals':
        return eq(column, values[0]);
      case 'startsWith':
        return this.getCaseInsensitiveLike(column, `${values[0]}%`);
      case 'endsWith':
        return this.getCaseInsensitiveLike(column, `%${values[0]}`);
      case 'isEmpty':
        return or(isNull(column), eq(column, ''));
      case 'isNotEmpty':
        return and(isNotNull(column), not(eq(column, '')));
      case 'notEquals':
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  private handleNumberOperator(
    column: AnyColumnType,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'greaterThan':
        return gt(column, values[0] as number);
      case 'greaterThanOrEqual':
        return gte(column, values[0] as number);
      case 'lessThan':
        return lt(column, values[0] as number);
      case 'lessThanOrEqual':
        return lte(column, values[0] as number);
      case 'between':
        return values.length >= 2
          ? and(gte(column, values[0] as number), lte(column, values[1] as number))
          : undefined;
      case 'notBetween':
        return values.length >= 2
          ? or(lt(column, values[0] as number), gt(column, values[1] as number))
          : undefined;
      case 'equals':
        return eq(column, values[0]);
      case 'notEquals':
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  private handleDateOperator(
    column: AnyColumnType,
    operator: string,
    values: unknown[],
    columnType?: string
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'is':
        return columnType === 'date'
          ? this.createDateComparisonCondition(column, '=', this.parseFilterDate(values[0]))
          : eq(column, values[0]);
      case 'isNot':
        return columnType === 'date'
          ? this.createDateComparisonCondition(column, '!=', this.parseFilterDate(values[0]))
          : not(eq(column, values[0]));
      case 'before':
        return this.createDateComparisonCondition(column, '<', this.parseFilterDate(values[0]));
      case 'after':
        return this.createDateComparisonCondition(column, '>', this.parseFilterDate(values[0]));
      case 'isToday':
        return this.buildDateCondition(column, 'today');
      case 'isYesterday':
        return this.buildDateCondition(column, 'yesterday');
      case 'isThisWeek':
        return this.buildDateCondition(column, 'thisWeek');
      case 'isThisMonth':
        return this.buildDateCondition(column, 'thisMonth');
      case 'isThisYear':
        return this.buildDateCondition(column, 'thisYear');
      default:
        return undefined;
    }
  }

  private handleBooleanOperator(
    column: AnyColumnType,
    operator: string,
    _values: unknown[]
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'isTrue':
        return eq(column, true);
      case 'isFalse':
        return eq(column, false);
      default:
        return undefined;
    }
  }

  private handleOptionOperator(
    column: AnyColumnType,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'isAnyOf':
        return values.length > 0 ? inArray(column, values) : undefined;
      case 'isNoneOf':
        return values.length > 0 ? notInArray(column, values) : undefined;
      case 'equals':
        return eq(column, values[0]);
      case 'notEquals':
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  private handleMultiOptionOperator(
    column: AnyColumnType,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'includes':
        return this.buildArrayContainsCondition(column, values[0]);
      case 'excludes':
        return not(this.buildArrayContainsCondition(column, values[0]));
      case 'includesAny':
        return values.length > 0 ? this.buildArrayIncludesAnyCondition(column, values) : undefined;
      case 'includesAll':
        return values.length > 0 ? this.buildArrayIncludesAllCondition(column, values) : undefined;
      case 'excludesAny':
        return values.length > 0
          ? not(this.buildArrayIncludesAnyCondition(column, values))
          : undefined;
      case 'excludesAll':
        return values.length > 0
          ? not(this.buildArrayIncludesAllCondition(column, values))
          : undefined;
      default:
        return undefined;
    }
  }

  private handleUniversalOperator(
    column: AnyColumnType,
    operator: string
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      default:
        return undefined;
    }
  }

  /**
   * Parse filter value to Date object or timestamp (database-specific)
   */
  private parseFilterDate(value: unknown): Date | number | string {
    // For SQLite with timestamp mode, keep numbers as-is
    if (this.databaseType === 'sqlite' && typeof value === 'number') {
      return value;
    }

    if (value instanceof Date) {
      // For PostgreSQL and MySQL, convert Date to ISO string for proper serialization
      if (this.databaseType === 'postgres' || this.databaseType === 'mysql') {
        return value.toISOString();
      }
      return value;
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      // For SQLite, convert to timestamp
      if (this.databaseType === 'sqlite') {
        return parsed.getTime();
      }
      // For PostgreSQL and MySQL, return ISO string
      if (this.databaseType === 'postgres' || this.databaseType === 'mysql') {
        return parsed.toISOString();
      }
      return parsed;
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      // For PostgreSQL and MySQL, convert to ISO string
      if (this.databaseType === 'postgres' || this.databaseType === 'mysql') {
        return date.toISOString();
      }
      return date;
    }
    throw new QueryError('Invalid date value for filter', { value });
  }

  /**
   * Build date condition for relative dates
   */
  private buildDateCondition(column: AnyColumnType, period: string): SQL | SQLWrapper {
    const now = new Date();

    switch (period) {
      case 'today': {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
        return this.createDateRangeCondition(column, startOfDay, endOfDay);
      }

      case 'yesterday': {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const startOfYesterday = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        return this.createDateRangeCondition(column, startOfYesterday, endOfYesterday);
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
        return this.createDateRangeCondition(column, startOfWeek, inclusiveEndOfWeek);
      }

      case 'thisMonth': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const inclusiveEndOfMonth = new Date(endOfMonth.getTime() - 1);
        return this.createDateRangeCondition(column, startOfMonth, inclusiveEndOfMonth);
      }

      case 'thisYear': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
        const inclusiveEndOfYear = new Date(endOfYear.getTime() - 1);
        return this.createDateRangeCondition(column, startOfYear, inclusiveEndOfYear);
      }

      default:
        throw new QueryError(`Unsupported date period: ${period}`, { period });
    }
  }

  /**
   * Build array contains condition - database-specific implementation
   */
  private buildArrayContainsCondition(column: AnyColumnType, value: unknown): SQL {
    switch (this.databaseType) {
      case 'postgres':
        return sql`${column} @> ${JSON.stringify([value])}`;
      case 'mysql':
        return sql`JSON_CONTAINS(${column}, ${JSON.stringify([value])})`;
      case 'sqlite':
        // Use JSON_EACH for safe exact matching in arrays
        // Note: This requires the json_each table-valued function (standard in modern SQLite)
        return sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ${value})`;
      default:
        throw new QueryError(`Unsupported database type: ${this.databaseType}`, {
          databaseType: this.databaseType,
        });
    }
  }

  /**
   * Build array includes any condition - database-specific implementation
   */
  private buildArrayIncludesAnyCondition(column: AnyColumnType, values: unknown[]): SQL {
    switch (this.databaseType) {
      case 'postgres':
        return sql`${column} && ${JSON.stringify(values)}`;
      case 'mysql':
        return sql`JSON_OVERLAPS(${column}, ${JSON.stringify(values)})`;
      case 'sqlite': {
        // Use JSON_EACH for overlapping check
        // We use a correlated subquery with EXISTS
        const conditions = values.map(
          (val) => sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ${val})`
        );
        return sql`(${sql.join(conditions, sql` OR `)})`;
      }
      default:
        throw new QueryError(`Unsupported database type: ${this.databaseType}`, {
          databaseType: this.databaseType,
        });
    }
  }

  /**
   * Build array includes all condition - database-specific implementation
   */
  private buildArrayIncludesAllCondition(column: AnyColumnType, values: unknown[]): SQL {
    switch (this.databaseType) {
      case 'postgres':
        return sql`${column} @> ${JSON.stringify(values)}`;
      case 'mysql':
        return sql`JSON_CONTAINS(${column}, ${JSON.stringify(values)})`;
      case 'sqlite': {
        // Use JSON_EACH for contains all check
        const conditions = values.map(
          (val) => sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ${val})`
        );
        return sql`(${sql.join(conditions, sql` AND `)})`;
      }
      default:
        throw new QueryError(`Unsupported database type: ${this.databaseType}`, {
          databaseType: this.databaseType,
        });
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
      try {
        // Validate filter values before processing
        const validationResult = validateOperatorValues(
          filter.operator,
          filter.values,
          filter.type
        );
        if (validationResult !== true) {
          // Check if the operator is supported by this adapter even if core doesn't recognize it
          const supportedOperators = this.getSupportedOperators(filter.type || 'text');
          const isSupportedByAdapter = supportedOperators.includes(filter.operator);

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
              throw new QueryError(
                `Invalid filter values for operator ${filter.operator}: expected ${expectedCount} valid values`,
                {
                  operator: filter.operator,
                  values: filter.values,
                }
              );
            }
          } else if (typeof validationResult === 'string') {
            // Operator is not supported by adapter, throw error
            if (validationResult === 'Unknown operator') {
              throw new QueryError(`Invalid filter operator: ${filter.operator}`, {
                operator: filter.operator,
                error: validationResult,
              });
            } else {
              throw new QueryError(`Invalid filter configuration: ${validationResult}`, {
                operator: filter.operator,
                error: validationResult,
              });
            }
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
        if (condition) {
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
   * Validate filter values
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
   * Get supported operators for column type
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
