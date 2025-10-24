import type { ColumnType, FilterOperator, FilterState } from '@better-tables/core';
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
 * Filter handler that maps Better Tables filter operators to Drizzle conditions
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
   */
  buildFilterCondition(filter: FilterState): SQL | SQLWrapper {
    const columnPath = this.relationshipManager.resolveColumnPath(filter.columnId);
    const column = this.getColumn(columnPath);

    if (!column) {
      throw new QueryError(`Column not found: ${filter.columnId}`, {
        columnId: filter.columnId,
        table: columnPath.table,
      });
    }

    return this.mapOperatorToCondition(column, filter.operator, filter.values, filter.includeNull);
  }

  /**
   * Get case-insensitive like condition based on database type
   */
  private getCaseInsensitiveLike(column: AnyColumnType, pattern: string): SQL | SQLWrapper {
    if (this.databaseType === 'sqlite') {
      // SQLite doesn't support ilike, so we use like with LOWER() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else {
      // PostgreSQL and other databases support ilike
      return ilike(column, pattern);
    }
  }

  /**
   * Map filter operator to Drizzle condition
   */
  private mapOperatorToCondition(
    column: AnyColumnType,
    operator: FilterOperator,
    values: unknown[],
    includeNull?: boolean
  ): SQL | SQLWrapper {
    const conditions: (SQL | SQLWrapper)[] = [];

    // Handle null inclusion
    if (includeNull && (operator === 'isNull' || operator === 'isNotNull')) {
      conditions.push(isNull(column));
    }

    switch (operator) {
      // Text operators
      case 'contains':
        conditions.push(this.getCaseInsensitiveLike(column, `%${values[0]}%`));
        break;

      case 'equals':
        conditions.push(eq(column, values[0]));
        break;

      case 'startsWith':
        conditions.push(this.getCaseInsensitiveLike(column, `${values[0]}%`));
        break;

      case 'endsWith':
        conditions.push(this.getCaseInsensitiveLike(column, `%${values[0]}`));
        break;

      case 'isEmpty': {
        const isEmptyCondition = or(isNull(column), eq(column, ''));
        if (isEmptyCondition) {
          conditions.push(isEmptyCondition);
        }
        break;
      }

      case 'isNotEmpty': {
        const isNotEmptyCondition = and(isNotNull(column), not(eq(column, '')));
        if (isNotEmptyCondition) {
          conditions.push(isNotEmptyCondition);
        }
        break;
      }

      // Number operators
      case 'notEquals':
        conditions.push(not(eq(column, values[0])));
        break;

      case 'greaterThan':
        conditions.push(gt(column, values[0] as number));
        break;

      case 'greaterThanOrEqual':
        conditions.push(gte(column, values[0] as number));
        break;

      case 'lessThan':
        conditions.push(lt(column, values[0] as number));
        break;

      case 'lessThanOrEqual':
        conditions.push(lte(column, values[0] as number));
        break;

      case 'between':
        if (values.length >= 2) {
          const betweenCondition = and(
            gte(column, values[0] as number),
            lte(column, values[1] as number)
          );
          if (betweenCondition) {
            conditions.push(betweenCondition);
          }
        }
        break;

      case 'notBetween':
        if (values.length >= 2) {
          const notBetweenCondition = or(
            lt(column, values[0] as number),
            gt(column, values[1] as number)
          );
          if (notBetweenCondition) {
            conditions.push(notBetweenCondition);
          }
        }
        break;

      // Date operators
      case 'is': {
        const dateValue = this.parseFilterDate(values[0]);
        // For SQLite with timestamp mode, compare as numbers
        if (this.databaseType === 'sqlite' && typeof dateValue === 'number') {
          conditions.push(sql`${column} = ${dateValue}`);
        } else {
          conditions.push(eq(column, dateValue));
        }
        break;
      }

      case 'isNot': {
        const dateValue = this.parseFilterDate(values[0]);
        // For SQLite with timestamp mode, compare as numbers
        if (this.databaseType === 'sqlite' && typeof dateValue === 'number') {
          conditions.push(sql`${column} != ${dateValue}`);
        } else {
          conditions.push(not(eq(column, dateValue)));
        }
        break;
      }

      case 'before': {
        const dateValue = this.parseFilterDate(values[0]);
        // For SQLite with timestamp mode, compare as numbers
        if (this.databaseType === 'sqlite' && typeof dateValue === 'number') {
          conditions.push(sql`${column} < ${dateValue}`);
        } else {
          conditions.push(lt(column, dateValue));
        }
        break;
      }

      case 'after': {
        const dateValue = this.parseFilterDate(values[0]);
        // For SQLite with timestamp mode, compare as numbers
        if (this.databaseType === 'sqlite' && typeof dateValue === 'number') {
          conditions.push(sql`${column} > ${dateValue}`);
        } else {
          conditions.push(gt(column, dateValue));
        }
        break;
      }

      case 'isToday':
        conditions.push(this.buildDateCondition(column, 'today'));
        break;

      case 'isYesterday':
        conditions.push(this.buildDateCondition(column, 'yesterday'));
        break;

      case 'isThisWeek':
        conditions.push(this.buildDateCondition(column, 'thisWeek'));
        break;

      case 'isThisMonth':
        conditions.push(this.buildDateCondition(column, 'thisMonth'));
        break;

      case 'isThisYear':
        conditions.push(this.buildDateCondition(column, 'thisYear'));
        break;

      // Option operators
      case 'isAnyOf':
        if (values.length > 0) {
          conditions.push(inArray(column, values));
        }
        break;

      case 'isNoneOf':
        if (values.length > 0) {
          conditions.push(notInArray(column, values));
        }
        break;

      // Multi-option operators
      case 'includes':
        conditions.push(this.buildArrayContainsCondition(column, values[0]));
        break;

      case 'excludes':
        conditions.push(not(this.buildArrayContainsCondition(column, values[0])));
        break;

      case 'includesAny':
        if (values.length > 0) {
          conditions.push(this.buildArrayIncludesAnyCondition(column, values));
        }
        break;

      case 'includesAll':
        if (values.length > 0) {
          conditions.push(this.buildArrayIncludesAllCondition(column, values));
        }
        break;

      case 'excludesAny':
        if (values.length > 0) {
          conditions.push(not(this.buildArrayIncludesAnyCondition(column, values)));
        }
        break;

      case 'excludesAll':
        if (values.length > 0) {
          conditions.push(not(this.buildArrayIncludesAllCondition(column, values)));
        }
        break;

      // Boolean operators
      case 'isTrue':
        conditions.push(eq(column, true));
        break;

      case 'isFalse':
        conditions.push(eq(column, false));
        break;

      // Universal operators
      case 'isNull':
        conditions.push(isNull(column));
        break;

      case 'isNotNull':
        conditions.push(isNotNull(column));
        break;

      default:
        throw new QueryError(`Unsupported filter operator: ${operator}`, { operator, values });
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

  /**
   * Parse filter value to Date object or timestamp (database-specific)
   */
  private parseFilterDate(value: unknown): Date | number {
    // For SQLite with timestamp mode, keep numbers as-is
    if (this.databaseType === 'sqlite' && typeof value === 'number') {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      // For SQLite, convert to timestamp
      return this.databaseType === 'sqlite' ? parsed.getTime() : parsed;
    }
    if (typeof value === 'number') {
      return new Date(value);
    }
    throw new QueryError('Invalid date value for filter', { value });
  }

  /**
   * Build date condition for relative dates
   */
  private buildDateCondition(column: AnyColumnType, period: string): SQL {
    const now = new Date();

    switch (period) {
      case 'today': {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
        const condition = and(gte(column, startOfDay), lte(column, endOfDay));
        if (!condition) {
          throw new QueryError('Failed to create date condition', { period });
        }
        return condition;
      }

      case 'yesterday': {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const startOfYesterday = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        const condition = and(gte(column, startOfYesterday), lte(column, endOfYesterday));
        if (!condition) {
          throw new QueryError('Failed to create date condition', { period });
        }
        return condition;
      }

      case 'thisWeek': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return gte(column, startOfWeek);
      }

      case 'thisMonth': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return gte(column, startOfMonth);
      }

      case 'thisYear': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return gte(column, startOfYear);
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
        return sql`JSON_EXTRACT(${column}, '$') LIKE '%${JSON.stringify(value)}%'`;
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
        // SQLite doesn't have JSON_OVERLAPS, so we use a workaround
        const conditions = values.map(
          (val) => sql`JSON_EXTRACT(${column}, '$') LIKE '%${JSON.stringify(val)}%'`
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
        // SQLite doesn't have JSON_CONTAINS, so we use a workaround
        const conditions = values.map(
          (val) => sql`JSON_EXTRACT(${column}, '$') LIKE '%${JSON.stringify(val)}%'`
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
  handleCrossTableFilters(filters: FilterState[]): {
    conditions: (SQL | SQLWrapper)[];
    requiredJoins: Set<string>;
  } {
    const conditions: (SQL | SQLWrapper)[] = [];
    const requiredJoins = new Set<string>();

    for (const filter of filters) {
      const columnPath = this.relationshipManager.resolveColumnPath(filter.columnId);

      if (columnPath.isNested && columnPath.relationshipPath) {
        // Add required joins
        for (const relationship of columnPath.relationshipPath) {
          requiredJoins.add(relationship.to);
        }
      }

      const condition = this.buildFilterCondition(filter);
      if (condition) {
        conditions.push(condition);
      }
    }

    return { conditions, requiredJoins };
  }

  /**
   * Build compound filter conditions
   */
  buildCompoundConditions(
    filters: FilterState[],
    operator: 'and' | 'or' = 'and'
  ): SQL | SQLWrapper {
    const { conditions } = this.handleCrossTableFilters(filters);

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
   * Validate filter values
   */
  validateFilterValues(operator: FilterOperator, values: unknown[]): boolean {
    switch (operator) {
      case 'between':
      case 'notBetween':
        return values.length >= 2;

      case 'isAnyOf':
      case 'isNoneOf':
      case 'includesAny':
      case 'includesAll':
      case 'excludesAny':
      case 'excludesAll':
        return values.length > 0;

      case 'isEmpty':
      case 'isNotEmpty':
      case 'isNull':
      case 'isNotNull':
      case 'isToday':
      case 'isYesterday':
      case 'isThisWeek':
      case 'isThisMonth':
      case 'isThisYear':
        return values.length === 0;

      default:
        return values.length >= 1;
    }
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
