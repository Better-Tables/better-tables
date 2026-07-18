/**
 * @fileoverview Drizzle ORM implementation of the toolkit's PredicateEmitter
 * @module @better-tables/drizzle-adapter/drizzle-predicate-emitter
 *
 * @description
 * Implements `@better-tables/adapters-toolkit`'s `PredicateEmitter<TColumn,
 * TPredicate>` interface for Drizzle ORM: every leaf SQL predicate — `eq`,
 * `like`/`ilike`, JSONB extraction, PostgreSQL native-array operators, large
 * `IN`-list batching — lives here. `FilterRouter` (toolkit) decides WHICH of
 * these methods to call for a given filter operator and how to combine
 * multiple results; this class only ever builds or combines the predicates
 * it's handed.
 *
 * This is almost entirely code moved verbatim out of `filter-handler.ts`
 * (plan 007) — the operator-category handler bodies (`handleTextOperator`
 * etc.) and their private helpers. JSONB and PostgreSQL array-column
 * handling stay here rather than moving to the toolkit: they are
 * inescapably dialect-specific (raw `sql` template construction, Drizzle
 * column-metadata introspection), and plan 007 explicitly scopes moving
 * them out to a later phase (phase 1 is the ORM-agnostic seam only).
 *
 * @security
 * This class implements multiple layers of security to prevent SQL injection:
 * 1. **Parameterized Queries**: All user-provided values are passed as parameters through Drizzle's
 *    query builder, never directly interpolated into SQL strings.
 * 2. **Input Validation**: All filter values are validated before use, including type checks,
 *    length limits, and pattern matching for JSONB field names.
 * 3. **Defense in Depth**: Even validated inputs are escaped (e.g., single quotes doubled)
 *    before use in sql.raw() calls, providing protection if validation is bypassed.
 * 4. **Controlled Input**: JSONB field names come from validated columnId paths, not direct
 *    user input, reducing attack surface.
 * 5. **Error Message Sanitization**: Error messages don't expose internal schema structure
 *    or sensitive information that could aid attackers.
 *
 * @since 1.0.0
 */

import type { PredicateEmitter } from '@better-tables/adapters-toolkit';
import { computeDatePeriodRange } from '@better-tables/adapters-toolkit';
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
import type {
  AnyColumnType,
  AnyTableType,
  ColumnOrExpression,
  ColumnPath,
  DatabaseDriver,
  FilterHandlerHooks,
} from './types';
import { QueryError } from './types';
import { getArrayElementType, isArrayColumn } from './utils/drizzle-schema-utils';

/**
 * Drizzle's implementation of the toolkit's `PredicateEmitter` interface.
 *
 * @class DrizzlePredicateEmitter
 *
 * @since 1.0.0
 */
export class DrizzlePredicateEmitter
  implements PredicateEmitter<ColumnOrExpression, SQL | SQLWrapper>
{
  private schema: Record<string, AnyTableType>;
  private databaseType: DatabaseDriver;
  private hooks?: FilterHandlerHooks;

  /**
   * Regular expression for validating JSONB field names.
   * Only allows alphanumeric characters, underscores, and hyphens to prevent SQL injection.
   * This pattern ensures field names are safe for use in SQL string literals.
   */
  private static readonly SAFE_JSONB_FIELD_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

  /**
   * Maximum allowed length for JSONB field names.
   * Prevents excessively long field names that could cause performance issues
   * or be used in denial-of-service attacks.
   */
  private static readonly MAX_JSONB_FIELD_NAME_LENGTH = 255;

  /**
   * Maximum number of batches per group before using nested grouping.
   * When combining too many batches with or()/and(), Drizzle can lose parameter bindings.
   * Grouping batches into chunks creates a tree structure that preserves bindings.
   */
  private static readonly MAX_BATCHES_PER_GROUP = 200;

  private assertPresentValueType(
    value: unknown,
    expected: 'string' | 'number',
    operator: string
  ): void {
    if (typeof value === expected) {
      return;
    }

    throw new QueryError(`Invalid filter value type: expected ${expected}`, {
      operator,
      expected,
      received: typeof value,
    });
  }

  constructor(
    schema: Record<string, AnyTableType>,
    databaseType: DatabaseDriver,
    hooks?: FilterHandlerHooks
  ) {
    this.schema = schema;
    this.databaseType = databaseType;
    if (hooks !== undefined) {
      this.hooks = hooks;
    }
  }

  // --- PredicateEmitter interface ---

  isNullCondition(column: ColumnOrExpression): SQL | SQLWrapper {
    return this.createIsNullCondition(column);
  }

  and(...conditions: (SQL | SQLWrapper)[]): SQL | SQLWrapper {
    const combined = and(...conditions);
    if (!combined) {
      throw new QueryError('Failed to combine conditions', { conditionCount: conditions.length });
    }
    return combined;
  }

  or(...conditions: (SQL | SQLWrapper)[]): SQL | SQLWrapper {
    const combined = or(...conditions);
    if (!combined) {
      throw new QueryError('Failed to combine conditions', { conditionCount: conditions.length });
    }
    return combined;
  }

  textOperator(
    column: ColumnOrExpression,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    // Validate values array is not empty for operators that require values
    const requiresValue = ['contains', 'equals', 'startsWith', 'endsWith', 'notEquals'].includes(
      operator
    );
    if (requiresValue && (!values || values.length === 0 || values[0] === undefined)) {
      return undefined;
    }

    switch (operator) {
      case 'contains': {
        const value = values[0];
        this.assertPresentValueType(value, 'string', operator);
        return this.getCaseInsensitiveLike(column, `%${value}%`);
      }
      case 'equals':
        this.assertPresentValueType(values[0], 'string', operator);
        return eq(column, values[0]);
      case 'startsWith': {
        const value = values[0];
        this.assertPresentValueType(value, 'string', operator);
        return this.getCaseInsensitiveLike(column, `${value}%`);
      }
      case 'endsWith': {
        const value = values[0];
        this.assertPresentValueType(value, 'string', operator);
        return this.getCaseInsensitiveLike(column, `%${value}`);
      }
      case 'isEmpty':
        return or(this.createIsNullCondition(column), eq(column, ''));
      case 'isNotEmpty':
        return and(this.createIsNotNullCondition(column), not(eq(column, '')));
      case 'notEquals':
        this.assertPresentValueType(values[0], 'string', operator);
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  numberOperator(
    column: ColumnOrExpression,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    // Validate values array for operators that require values
    const requiresSingleValue = [
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'equals',
      'notEquals',
    ].includes(operator);
    const requiresTwoValues = ['between', 'notBetween'].includes(operator);

    if (requiresSingleValue && (!values || values.length === 0 || values[0] === undefined)) {
      return undefined;
    }
    if (
      requiresTwoValues &&
      (!values || values.length < 2 || values[0] === undefined || values[1] === undefined)
    ) {
      return undefined;
    }

    // Type validation: Ensure numeric values are numbers
    if (requiresSingleValue) {
      this.assertPresentValueType(values[0], 'number', operator);
    }
    if (requiresTwoValues) {
      this.assertPresentValueType(values[0], 'number', operator);
      this.assertPresentValueType(values[1], 'number', operator);
    }

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
        return and(gte(column, values[0] as number), lte(column, values[1] as number));
      case 'notBetween':
        return or(lt(column, values[0] as number), gt(column, values[1] as number));
      case 'equals':
        return eq(column, values[0]);
      case 'notEquals':
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  dateOperator(
    column: ColumnOrExpression,
    operator: string,
    values: unknown[],
    columnType?: string
  ): SQL | SQLWrapper | undefined {
    // Validate values array for operators that require values
    const requiresValue = ['is', 'isNot', 'before', 'after'].includes(operator);
    if (requiresValue && (!values || values.length === 0 || values[0] === undefined)) {
      return undefined;
    }

    // Check if this is a timestamp column (even if columnType from frontend isn't 'date')
    const isTimestamp = this.isTimestampColumn(column);
    const shouldUseDateComparison = columnType === 'date' || isTimestamp;

    switch (operator) {
      case 'is':
        if (shouldUseDateComparison) {
          // For date 'is' operator, use a date range (start of day to end of day)
          // This ensures we match all records on that date, regardless of time
          const dateValue = this.parseFilterDate(values[0]);
          const date =
            typeof dateValue === 'string'
              ? new Date(dateValue)
              : typeof dateValue === 'number'
                ? new Date(dateValue)
                : dateValue;

          // Create start of day (00:00:00.000) in UTC to avoid timezone issues
          const startOfDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
          );

          // Create end of day (23:59:59.999) in UTC
          const endOfDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
          );

          return this.createDateRangeCondition(column, startOfDay, endOfDay);
        }
        return eq(column, values[0]);
      case 'isNot':
        if (shouldUseDateComparison) {
          // For date 'isNot' operator, exclude the entire day
          // Use De Morgan's law: NOT (date >= start AND date <= end) = (date < start OR date > end)
          const dateValue = this.parseFilterDate(values[0]);
          const date =
            typeof dateValue === 'string'
              ? new Date(dateValue)
              : typeof dateValue === 'number'
                ? new Date(dateValue)
                : dateValue;

          // Create start of day (00:00:00.000) in UTC
          const startOfDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
          );

          // Create end of day (23:59:59.999) in UTC
          const endOfDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
          );

          // Use OR with < and > instead of NOT with AND for better compatibility
          // This is equivalent to: NOT (date >= startOfDay AND date <= endOfDay)
          return or(
            this.createDateComparisonCondition(column, '<', startOfDay),
            this.createDateComparisonCondition(column, '>', endOfDay)
          );
        }
        return not(eq(column, values[0]));
      case 'before':
        if (shouldUseDateComparison) {
          // For date 'before' operator, match records before the start of the specified day
          const dateValue = this.parseFilterDate(values[0]);
          const date =
            typeof dateValue === 'string'
              ? new Date(dateValue)
              : typeof dateValue === 'number'
                ? new Date(dateValue)
                : dateValue;

          // Create start of day (00:00:00.000) in UTC - records before this
          const startOfDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
          );

          return this.createDateComparisonCondition(column, '<', startOfDay);
        }
        return this.createDateComparisonCondition(column, '<', this.parseFilterDate(values[0]));
      case 'after':
        if (shouldUseDateComparison) {
          // For date 'after' operator, match records after the end of the specified day
          const dateValue = this.parseFilterDate(values[0]);
          const date =
            typeof dateValue === 'string'
              ? new Date(dateValue)
              : typeof dateValue === 'number'
                ? new Date(dateValue)
                : dateValue;

          // Create end of day (23:59:59.999) in UTC - records after this
          const endOfDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
          );

          return this.createDateComparisonCondition(column, '>', endOfDay);
        }
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
      case 'between':
      case 'notBetween': {
        // Two-value range operators: match records within (or outside) the
        // span from the START of the first date's day to the END of the
        // second date's day, inclusive — the same day-granularity the
        // single-value operators above use.
        if (values.length < 2 || values[0] === undefined || values[1] === undefined) {
          return undefined;
        }
        const toDate = (raw: unknown): Date => {
          const parsed = this.parseFilterDate(raw);
          return typeof parsed === 'string' || typeof parsed === 'number'
            ? new Date(parsed)
            : parsed;
        };
        const startDate = toDate(values[0]);
        const endDate = toDate(values[1]);
        const startOfDay = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0
          )
        );
        const endOfDay = new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999
          )
        );
        if (operator === 'between') {
          return this.createDateRangeCondition(column, startOfDay, endOfDay);
        }
        return or(
          this.createDateComparisonCondition(column, '<', startOfDay),
          this.createDateComparisonCondition(column, '>', endOfDay)
        );
      }
      default:
        return undefined;
    }
  }

  booleanOperator(
    column: ColumnOrExpression,
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

  optionOperator(
    column: ColumnOrExpression,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    // Validate values array
    if (!values || values.length === 0) {
      // Some operators don't require values, but most do
      if (['isAnyOf', 'isNoneOf'].includes(operator)) {
        return undefined;
      }
      // For equality operators (canonical is/isNot + equals/notEquals aliases)
      if (['is', 'isNot', 'equals', 'notEquals'].includes(operator)) {
        return undefined;
      }
    }

    // Check if this is a PostgreSQL array column for isAnyOf/isNoneOf operators
    if (
      (operator === 'isAnyOf' || operator === 'isNoneOf') &&
      !this.isSqlExpression(column) &&
      this.isPostgresArrayColumn(column)
    ) {
      const elementType = this.getPostgresArrayElementType(column);
      if (!elementType) {
        // Fallback to text if type cannot be determined
        const fallbackType = 'text';
        const arrayLiteral = this.buildPostgresArrayLiteral(
          values.filter((v) => v !== undefined),
          fallbackType
        );

        if (operator === 'isAnyOf') {
          // Use PostgreSQL overlap operator: column && ARRAY[values]::type[]
          return sql`${column} && ${arrayLiteral}`;
        } else {
          // Use negated overlap: NOT (column && ARRAY[values]::type[])
          return sql`NOT (${column} && ${arrayLiteral})`;
        }
      }

      // Filter out undefined values
      const validValues = values.filter((v) => v !== undefined);
      if (validValues.length === 0) {
        return undefined;
      }

      const arrayLiteral = this.buildPostgresArrayLiteral(validValues, elementType);

      if (operator === 'isAnyOf') {
        // Use PostgreSQL overlap operator: column && ARRAY[values]::type[]
        return sql`${column} && ${arrayLiteral}`;
      } else {
        // Use negated overlap: NOT (column && ARRAY[values]::type[])
        return sql`NOT (${column} && ${arrayLiteral})`;
      }
    }

    // For non-array columns, use existing behavior
    switch (operator) {
      case 'isAnyOf': {
        // Filter out undefined values before passing to inArray
        const validValues = values.filter((v) => v !== undefined);
        if (validValues.length === 0) {
          return undefined;
        }
        // For PostgreSQL, use parameterized array literal for very large arrays
        // PostgreSQL supports up to 65535 parameters, but large arrays can cause issues with inArray
        // Use parameterized ARRAY with = ANY() for arrays larger than 1000 values
        // This maintains security through proper parameterization while avoiding inArray issues
        if (this.databaseType === 'postgres' && validValues.length > 1000) {
          return this.buildLargeArrayAnyCondition(column, validValues);
        }
        return inArray(column, validValues);
      }
      case 'isNoneOf': {
        // Filter out undefined values before passing to notInArray
        const validValuesForNone = values.filter((v) => v !== undefined);
        if (validValuesForNone.length === 0) {
          return undefined;
        }
        // For PostgreSQL, use parameterized array literal for very large arrays
        if (this.databaseType === 'postgres' && validValuesForNone.length > 1000) {
          return this.buildLargeArrayAllCondition(column, validValuesForNone);
        }
        return notInArray(column, validValuesForNone);
      }
      case 'is':
      case 'equals':
        if (values[0] === undefined) {
          return undefined;
        }
        return eq(column, values[0]);
      case 'isNot':
      case 'notEquals':
        if (values[0] === undefined) {
          return undefined;
        }
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  multiOptionOperator(
    column: ColumnOrExpression,
    operator: string,
    values: unknown[]
  ): SQL | SQLWrapper | undefined {
    // Validate values array
    if (!values || values.length === 0) {
      return undefined;
    }

    // Filter out undefined values for array operations
    const validValues = values.filter((v) => v !== undefined);
    if (validValues.length === 0) {
      return undefined;
    }

    // Check if this is a PostgreSQL array column
    const isPostgresArray = !this.isSqlExpression(column) && this.isPostgresArrayColumn(column);

    if (isPostgresArray) {
      const elementType = this.getPostgresArrayElementType(column) || 'text';

      switch (operator) {
        case 'includes': {
          // Use @> operator with single-element array: column @> ARRAY[value]::type[]
          const arrayLiteral = this.buildPostgresArrayLiteral([validValues[0]], elementType);
          return sql`${column} @> ${arrayLiteral}`;
        }
        case 'excludes': {
          // Use NOT (@>) operator: NOT (column @> ARRAY[value]::type[])
          const arrayLiteral = this.buildPostgresArrayLiteral([validValues[0]], elementType);
          return sql`NOT (${column} @> ${arrayLiteral})`;
        }
        case 'includesAny': {
          // Use && (overlap) operator: column && ARRAY[values]::type[]
          const arrayLiteral = this.buildPostgresArrayLiteral(validValues, elementType);
          return sql`${column} && ${arrayLiteral}`;
        }
        case 'includesAll': {
          // Use @> (contains) operator: column @> ARRAY[values]::type[]
          const arrayLiteral = this.buildPostgresArrayLiteral(validValues, elementType);
          return sql`${column} @> ${arrayLiteral}`;
        }
        case 'excludesAny': {
          // Use NOT (&&) operator: NOT (column && ARRAY[values]::type[])
          const arrayLiteral = this.buildPostgresArrayLiteral(validValues, elementType);
          return sql`NOT (${column} && ${arrayLiteral})`;
        }
        case 'excludesAll': {
          // Use NOT (@>) operator: NOT (column @> ARRAY[values]::type[])
          const arrayLiteral = this.buildPostgresArrayLiteral(validValues, elementType);
          return sql`NOT (${column} @> ${arrayLiteral})`;
        }
        default:
          return undefined;
      }
    }

    // For non-array columns (JSONB), use existing behavior
    switch (operator) {
      case 'includes':
        if (values[0] === undefined) {
          return undefined;
        }
        return this.buildArrayContainsCondition(column, values[0]);
      case 'excludes':
        if (values[0] === undefined) {
          return undefined;
        }
        return not(this.buildArrayContainsCondition(column, values[0]));
      case 'includesAny':
        return this.buildArrayIncludesAnyCondition(column, validValues);
      case 'includesAll':
        return this.buildArrayIncludesAllCondition(column, validValues);
      case 'excludesAny':
        return not(this.buildArrayIncludesAnyCondition(column, validValues));
      case 'excludesAll':
        return not(this.buildArrayIncludesAllCondition(column, validValues));
      default:
        return undefined;
    }
  }

  universalOperator(column: ColumnOrExpression, operator: string): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'isNull':
        return this.createIsNullCondition(column);
      case 'isNotNull':
        return this.createIsNotNullCondition(column);
      default:
        return undefined;
    }
  }

  // --- JSONB extraction (dialect-specific; kept out of the toolkit) ---

  /**
   * Build JSONB extraction SQL expression.
   *
   * @description
   * Extracts a field from a JSONB column using database-specific syntax.
   * This method generates safe SQL expressions that extract JSONB field values
   * for use in filter conditions.
   *
   * **Security**: Multiple layers of validation prevent SQL injection:
   * 1. Type checking: Ensures field name is a string
   * 2. Length validation: Prevents excessively long field names
   * 3. Pattern validation: Only allows safe characters (alphanumeric, underscore, hyphen)
   * 4. Escaping: Single quotes are doubled (PostgreSQL-style escaping)
   * 5. Controlled input: Field name comes from validated columnId, not user input
   *
   * @param columnPath - The column path containing JSONB accessor info
   * @returns SQL expression for the extracted JSONB field
   *
   * @throws {QueryError} If the column is not found or the JSONB accessor format is invalid
   */
  buildJsonbExtraction(columnPath: ColumnPath): SQL {
    const column = this.getColumn(columnPath);
    if (!column) {
      throw new QueryError(`Column not found for JSONB extraction: ${columnPath.columnId}`, {
        columnId: columnPath.columnId,
        table: columnPath.table,
        field: columnPath.field,
      });
    }

    // Extract the field name from the columnId (e.g., "title" from "survey.title")
    const parts = columnPath.columnId.split('.');
    if (parts.length !== 2 || !parts[1]) {
      throw new QueryError(`Invalid JSONB accessor format: ${columnPath.columnId}`, {
        columnId: columnPath.columnId,
        expectedFormat: 'column.field',
        receivedParts: parts.length,
      });
    }

    const jsonbField = parts[1];

    // Explicit type check: Ensure field name is a string
    if (typeof jsonbField !== 'string') {
      throw new QueryError(
        `Invalid JSONB field name type: expected string, got ${typeof jsonbField}`,
        {
          columnId: columnPath.columnId,
          field: jsonbField,
        }
      );
    }

    // Length validation: Prevent excessively long field names
    if (jsonbField.length > DrizzlePredicateEmitter.MAX_JSONB_FIELD_NAME_LENGTH) {
      throw new QueryError(
        `JSONB field name exceeds maximum length: ${jsonbField.length} > ${DrizzlePredicateEmitter.MAX_JSONB_FIELD_NAME_LENGTH}`,
        {
          columnId: columnPath.columnId,
          field: jsonbField,
          maxLength: DrizzlePredicateEmitter.MAX_JSONB_FIELD_NAME_LENGTH,
        }
      );
    }

    // Pattern validation: Only allow safe characters (alphanumeric, underscore, hyphen)
    // This prevents injection of malicious SQL in field names
    if (!DrizzlePredicateEmitter.SAFE_JSONB_FIELD_NAME_PATTERN.test(jsonbField)) {
      throw new QueryError(`Invalid JSONB field name: ${jsonbField}`, {
        columnId: columnPath.columnId,
        field: jsonbField,
        reason:
          'Field name contains invalid characters. Only alphanumeric, underscore, and hyphen are allowed.',
      });
    }

    // Escape single quotes in field name for SQL safety (PostgreSQL-style escaping)
    // This provides defense-in-depth even if validation is bypassed
    const escapedField = jsonbField.replace(/'/g, "''");

    // Build database-specific JSONB extraction
    switch (this.databaseType) {
      case 'postgres': {
        // PostgreSQL: column->>'field' extracts text from JSONB
        // The ->> operator returns text, which is safe for string operations
        // Use sql.raw to inject the validated and escaped field name as a string literal
        // Security: Field name is validated (pattern + length) and escaped before use
        return sql`${column}->>${sql.raw(`'${escapedField}'`)}`;
      }
      case 'mysql': {
        // MySQL: JSON_UNQUOTE(JSON_EXTRACT(column, '$.field')) extracts text
        // JSON_EXTRACT returns JSON, JSON_UNQUOTE converts to text
        // Security: Field name is validated (pattern + length) and escaped before use
        return sql`JSON_UNQUOTE(JSON_EXTRACT(${column}, ${sql.raw(`'$.${escapedField}'`)}))`;
      }
      case 'sqlite': {
        // SQLite: json_extract(column, '$.field') extracts value
        // Returns the JSON value, which can be used directly in comparisons
        // Security: Field name is validated (pattern + length) and escaped before use
        return sql`json_extract(${column}, ${sql.raw(`'$.${escapedField}'`)})`;
      }
      default: {
        throw new QueryError(
          `Unsupported database type for JSONB extraction: ${this.databaseType}`,
          {
            databaseType: this.databaseType,
            supportedTypes: ['postgres', 'mysql', 'sqlite'],
          }
        );
      }
    }
  }

  // --- Private leaf-building helpers (moved verbatim from filter-handler.ts) ---

  /**
   * Type guard to check if a value is a SQL expression (not a column type).
   */
  private isSqlExpression(value: ColumnOrExpression): value is SQL | SQLWrapper {
    // Primitive types are never SQL expressions
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    // Primary check: SQL expressions have 'sql' or 'queryChunks' properties
    // These are internal Drizzle properties that identify SQL instances
    if ('sql' in value || 'queryChunks' in value) {
      return true;
    }

    // Secondary check: SQL expressions don't have column-specific properties
    // Columns have properties like 'table', 'name', 'dataType', etc.
    // If these properties exist, it's definitely a column, not a SQL expression
    if ('table' in value || 'name' in value || 'dataType' in value) {
      return false;
    }

    // Additional check: SQL expressions from sql template tag may have specific constructor
    // This is a fallback for edge cases where the above checks don't work
    const constructorName = value.constructor?.name;
    if (constructorName === 'SQL' || constructorName === 'SQLWrapper') {
      return true;
    }

    // Default: If we can't determine, assume it's a column type
    return false;
  }

  /**
   * Create IS NULL condition for both columns and SQL expressions.
   */
  private createIsNullCondition(column: ColumnOrExpression): SQL | SQLWrapper {
    if (this.isSqlExpression(column)) {
      return sql`${column} IS NULL`;
    }
    return isNull(column);
  }

  /**
   * Create IS NOT NULL condition for both columns and SQL expressions.
   */
  private createIsNotNullCondition(column: ColumnOrExpression): SQL | SQLWrapper {
    if (this.isSqlExpression(column)) {
      return sql`${column} IS NOT NULL`;
    }
    return isNotNull(column);
  }

  /**
   * Get case-insensitive LIKE condition based on database type.
   */
  private getCaseInsensitiveLike(column: ColumnOrExpression, pattern: string): SQL | SQLWrapper {
    if (this.databaseType === 'sqlite') {
      // SQLite doesn't support ILIKE, so we use LIKE with LOWER() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else if (this.databaseType === 'mysql') {
      // MySQL doesn't support ILIKE, so we use LIKE with LOWER() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else {
      // PostgreSQL supports ILIKE natively
      if (this.isSqlExpression(column)) {
        // Use like() with LOWER() to ensure pattern is parameterized
        return like(sql`LOWER(${column})`, pattern.toLowerCase());
      }
      // Drizzle's ilike() function properly parameterizes the pattern
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
   * Create date comparison condition.
   */
  private createDateComparisonCondition(
    column: ColumnOrExpression,
    operator: '=' | '!=' | '<' | '>' | '>=' | '<=',
    value: Date | number | string
  ): SQL | SQLWrapper {
    if (this.databaseType === 'sqlite') {
      // Bind a Date and let Drizzle's typed operators run it through the
      // COLUMN's `mapToDriverValue` — which stores `mode: 'timestamp'` as Unix
      // SECONDS and `mode: 'timestamp_ms'` as milliseconds. Passing a raw
      // number binds the wrong unit (a `getTime()` millisecond value never
      // matches a seconds-mode column), and passing a pre-`getTime()`'d number
      // through `gte`/`lte` crashes the mapper's `value.getTime()` call. A
      // number filter value is treated as JS-epoch milliseconds.
      const dateObj = value instanceof Date ? value : new Date(value);
      switch (operator) {
        case '=':
          return eq(column, dateObj);
        case '!=':
          return not(eq(column, dateObj));
        case '<':
          return lt(column, dateObj);
        case '>':
          return gt(column, dateObj);
        case '>=':
          return gte(column, dateObj);
        case '<=':
          return lte(column, dateObj);
      }
    }

    // PostgreSQL / MySQL: cast an ISO string at the SQL level.
    const dateValue = value instanceof Date ? value.toISOString() : value;
    const castValue = this.castToDateSQL(dateValue);
    return sql`${column} ${sql.raw(operator)} ${castValue}`;
  }

  /**
   * Create date range condition (inclusive).
   */
  private createDateRangeCondition(
    column: ColumnOrExpression,
    startDate: Date | string,
    endDate: Date | string
  ): SQL | SQLWrapper {
    if (this.databaseType === 'postgres' || this.databaseType === 'mysql') {
      // Format dates for SQL: keep strings as-is, Dates as ISO strings.
      const startVal = typeof startDate === 'string' ? startDate : startDate.toISOString();
      const endVal = typeof endDate === 'string' ? endDate : endDate.toISOString();
      const startCast = this.castToDateSQL(startVal);
      const endCast = this.castToDateSQL(endVal);
      return sql`${column} >= ${startCast} AND ${column} <= ${endCast}`;
    }

    // SQLite: bind Date objects (not pre-converted numbers) so Drizzle's typed
    // operators run them through the column's `mapToDriverValue`, which stores
    // `mode: 'timestamp'` as Unix SECONDS and `mode: 'timestamp_ms'` as
    // milliseconds. Passing `startDate.getTime()` here bound the wrong unit AND
    // crashed the mapper (`value.getTime is not a function`) when the number
    // reached `mapToDriverValue`'s Date path. A string bound is normalized to a
    // Date first.
    const startObj = startDate instanceof Date ? startDate : new Date(startDate);
    const endObj = endDate instanceof Date ? endDate : new Date(endDate);
    const condition = and(gte(column, startObj), lte(column, endObj));
    if (!condition) {
      // Should effectively never happen with valid inputs
      throw new QueryError('Failed to create date range condition');
    }
    return condition;
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
   * Build date condition for relative dates (today, this week, ...).
   *
   * @description
   * The period boundary arithmetic itself is ORM-agnostic and lives in the
   * toolkit's `computeDatePeriodRange` (plan 007) — this method just turns
   * the resulting `{ start, end }` into a dialect-specific range condition.
   */
  private buildDateCondition(column: ColumnOrExpression, period: string): SQL | SQLWrapper {
    if (
      period !== 'today' &&
      period !== 'yesterday' &&
      period !== 'thisWeek' &&
      period !== 'thisMonth' &&
      period !== 'thisYear'
    ) {
      throw new QueryError(`Unsupported date period: ${period}`, { period });
    }
    const { start, end } = computeDatePeriodRange(period);
    return this.createDateRangeCondition(column, start, end);
  }

  /**
   * Build array contains condition - database-specific implementation.
   */
  private buildArrayContainsCondition(column: ColumnOrExpression, value: unknown): SQL {
    switch (this.databaseType) {
      case 'postgres': {
        // Check if this is a native PostgreSQL array column
        if (!this.isSqlExpression(column) && this.isPostgresArrayColumn(column)) {
          const elementType = this.getPostgresArrayElementType(column) || 'text';
          const arrayLiteral = this.buildPostgresArrayLiteral([value], elementType);
          // Use @> operator for native arrays: column @> ARRAY[value]::type[]
          return sql`${column} @> ${arrayLiteral}`;
        }
        // For JSONB columns, use existing JSON.stringify approach
        return sql`${column} @> ${JSON.stringify([value])}`;
      }
      case 'mysql':
        return sql`JSON_CONTAINS(${column}, ${JSON.stringify([value])})`;
      case 'sqlite':
        // Use JSON_EACH for safe exact matching in arrays
        return sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ${value})`;
      default:
        throw new QueryError(`Unsupported database type: ${this.databaseType}`, {
          databaseType: this.databaseType,
        });
    }
  }

  /**
   * Build array includes any condition - database-specific implementation.
   */
  private buildArrayIncludesAnyCondition(column: ColumnOrExpression, values: unknown[]): SQL {
    switch (this.databaseType) {
      case 'postgres': {
        // Check if this is a native PostgreSQL array column
        if (!this.isSqlExpression(column) && this.isPostgresArrayColumn(column)) {
          const elementType = this.getPostgresArrayElementType(column) || 'text';
          const arrayLiteral = this.buildPostgresArrayLiteral(values, elementType);
          // Use && (overlap) operator for native arrays: column && ARRAY[values]::type[]
          return sql`${column} && ${arrayLiteral}`;
        }
        // For JSONB columns, use existing JSON.stringify approach
        return sql`${column} && ${JSON.stringify(values)}`;
      }
      case 'mysql':
        return sql`JSON_OVERLAPS(${column}, ${JSON.stringify(values)})`;
      case 'sqlite': {
        // Use JSON_EACH for overlapping check
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
   * Build array includes all condition - database-specific implementation.
   */
  private buildArrayIncludesAllCondition(column: ColumnOrExpression, values: unknown[]): SQL {
    switch (this.databaseType) {
      case 'postgres': {
        // Check if this is a native PostgreSQL array column
        if (!this.isSqlExpression(column) && this.isPostgresArrayColumn(column)) {
          const elementType = this.getPostgresArrayElementType(column) || 'text';
          const arrayLiteral = this.buildPostgresArrayLiteral(values, elementType);
          // Use @> (contains) operator for native arrays: column @> ARRAY[values]::type[]
          return sql`${column} @> ${arrayLiteral}`;
        }
        // For JSONB columns, use existing JSON.stringify approach
        return sql`${column} @> ${JSON.stringify(values)}`;
      }
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
   * Get column from schema (duplicated from FilterHandler's own copy since
   * buildJsonbExtraction needs it and lives here now — see plan 007 notes).
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
   * Check if a column is a PostgreSQL array column.
   */
  private isPostgresArrayColumn(column: AnyColumnType): boolean {
    // Only PostgreSQL supports native array types
    if (this.databaseType !== 'postgres') {
      return false;
    }

    // SQL expressions (like JSONB extractions) are not array columns
    if (this.isSqlExpression(column)) {
      return false;
    }

    return isArrayColumn(column);
  }

  /**
   * Get the element type of a PostgreSQL array column.
   */
  private getPostgresArrayElementType(column: AnyColumnType): string | null {
    if (!this.isPostgresArrayColumn(column)) {
      return null;
    }

    return getArrayElementType(column);
  }

  /**
   * Build a PostgreSQL array literal with proper type casting.
   */
  private buildPostgresArrayLiteral(values: unknown[], elementType: string): SQL {
    // Validate element type to prevent SQL injection
    const validTypes = ['uuid', 'text', 'integer', 'bigint', 'boolean', 'numeric', 'varchar'];
    if (!validTypes.includes(elementType)) {
      throw new QueryError(`Unsupported array element type: ${elementType}`, {
        elementType,
        validTypes,
        suggestion: 'Supported types are: uuid, text, integer, bigint, boolean, numeric, varchar',
      });
    }

    // Filter out null values (they are handled separately with isNull/isNotNull operators)
    const nonNullValues = values.filter((v) => v !== null && v !== undefined);

    // Handle empty arrays - return empty array literal
    if (nonNullValues.length === 0) {
      return sql`ARRAY[]::${sql.raw(elementType)}[]`;
    }

    // Build typed array elements
    const typedValues = nonNullValues.map((value) => {
      // Use Drizzle's sql template tag to safely cast each value
      return sql`${value}::${sql.raw(elementType)}`;
    });

    // Join typed values and cast the entire array
    return sql`ARRAY[${sql.join(typedValues, sql`, `)}]::${sql.raw(elementType)}[]`;
  }

  /**
   * Report whether `column` stores date/timestamp semantics even when the
   * filter's `columnType` isn't `'date'` — used by the router for
   * `between`/`notBetween` timestamp fallback.
   */
  prefersDateSemantics(column: ColumnOrExpression): boolean {
    return this.isTimestampColumn(column);
  }

  /**
   * Check if a column is a timestamp/date column.
   */
  private isTimestampColumn(column: ColumnOrExpression): boolean {
    // If it's a SQL expression, we can't determine the type
    if (this.isSqlExpression(column)) {
      return false;
    }

    const col = column as AnyColumnType;

    // Check columnType first (more specific than dataType)
    const columnType = (col as unknown as { columnType?: string }).columnType;
    if (columnType) {
      // Check for PostgreSQL timestamp column types
      if (
        columnType === 'PgTimestamp' ||
        columnType === 'PgTimestampString' ||
        columnType === 'PgTimestampNumber'
      ) {
        return true;
      }

      // Check for MySQL datetime/timestamp column types
      if (
        columnType === 'MySqlDateTime' ||
        columnType === 'MySqlTimestamp' ||
        columnType === 'MySqlDate'
      ) {
        return true;
      }

      // Check for SQLite timestamp column types
      // SQLite uses integer with mode: 'timestamp' or text with mode: 'date'
      if (
        columnType === 'SQLiteTimestamp' ||
        columnType === 'SQLiteDate' ||
        // SQLite integer columns with timestamp mode
        (columnType === 'SQLiteInteger' &&
          (col as unknown as { mode?: string }).mode === 'timestamp')
      ) {
        return true;
      }
    }

    // Check dataType as fallback (date is a valid dataType)
    const dataType = col.dataType;
    if (dataType === 'date') {
      return true;
    }

    // For SQLite, also check if it's an integer with timestamp mode
    if (this.databaseType === 'sqlite' && dataType === 'number') {
      const mode = (col as unknown as { mode?: string }).mode;
      if (mode === 'timestamp' || mode === 'date') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get PostgreSQL type name for a column (for casting purposes).
   */
  private getPostgresColumnType(column: ColumnOrExpression): string | null {
    // If it's a SQL expression, we can't determine the type
    if (this.isSqlExpression(column)) {
      return null;
    }

    const col = column as AnyColumnType;

    // Check columnType first (more specific than dataType)
    // For example, UUID has dataType: "string" but columnType: "PgUUID"
    const columnType = (col as unknown as { columnType?: string }).columnType;
    if (columnType) {
      // Map common Drizzle column types to PostgreSQL type names
      const columnTypeMap: Record<string, string> = {
        PgUUID: 'uuid',
        PgText: 'text',
        PgInteger: 'integer',
        PgBigInt: 'bigint',
        PgBigInt53: 'bigint',
        PgBoolean: 'boolean',
        PgNumeric: 'numeric',
        PgVarchar: 'varchar',
        PgTimestamp: 'timestamp',
        PgTimestampString: 'timestamp',
        PgTimestampNumber: 'timestamp',
      };

      if (columnType in columnTypeMap) {
        return columnTypeMap[columnType] ?? null;
      }
    }

    // Fallback: try to infer from dataType
    const dataType = col.dataType;
    if (dataType) {
      const typeMap: Record<string, string> = {
        uuid: 'uuid',
        string: 'text', // Note: UUIDs have dataType "string" but columnType "PgUUID"
        number: 'integer',
        bigint: 'bigint',
        boolean: 'boolean',
        numeric: 'numeric',
        varchar: 'varchar',
      };

      if (dataType in typeMap) {
        return typeMap[dataType] ?? null;
      }
    }

    return null;
  }

  /**
   * Build a parameterized PostgreSQL condition for large arrays using small-batch VALUES clauses.
   */
  private buildLargeArrayAnyCondition(
    column: ColumnOrExpression,
    values: unknown[]
  ): SQL | SQLWrapper {
    if (values.length === 0) {
      return sql`FALSE`;
    }

    // Check if hook provides custom implementation
    if (this.hooks?.buildLargeArrayCondition) {
      const customCondition = this.hooks.buildLargeArrayCondition(column, values, 'isAnyOf');
      if (customCondition !== null) {
        return customCondition;
      }
      // Hook returned null, continue with default implementation
    }

    // Use very small batches (50 values) to avoid parameter binding issues
    const BATCH_SIZE = 50;
    const batches: unknown[][] = [];

    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      batches.push(values.slice(i, i + BATCH_SIZE));
    }

    const columnType = this.getPostgresColumnType(column);

    // Build condition for each batch using sql.join() to preserve parameter bindings
    const batchConditions = batches.map((batch) => {
      const valueTuples = batch.map((value) => sql`(${value})`);
      const valuesClause = sql`(VALUES ${sql.join(valueTuples, sql`, `)}) AS t(val)`;

      if (columnType) {
        return sql`${column} IN (SELECT val::${sql.raw(columnType)} FROM ${valuesClause})`;
      }
      return sql`${column} IN (SELECT val FROM ${valuesClause})`;
    });

    // Combine all batches with OR
    if (batchConditions.length === 1) {
      const singleCondition = batchConditions[0];
      if (singleCondition) {
        return singleCondition;
      }
      return sql`FALSE`;
    }

    // Use nested grouping when there are too many batches to prevent parameter binding loss
    return this.combineBatchConditions(batchConditions, or, sql`FALSE`);
  }

  /**
   * Build a parameterized PostgreSQL condition for large arrays using small-batch VALUES clauses.
   */
  private buildLargeArrayAllCondition(
    column: ColumnOrExpression,
    values: unknown[]
  ): SQL | SQLWrapper {
    if (values.length === 0) {
      return sql`TRUE`; // NOT IN with empty set matches everything
    }

    // Check if hook provides custom implementation
    if (this.hooks?.buildLargeArrayCondition) {
      const customCondition = this.hooks.buildLargeArrayCondition(column, values, 'isNoneOf');
      if (customCondition !== null) {
        return customCondition;
      }
      // Hook returned null, continue with default implementation
    }

    // Use very small batches (50 values) to avoid parameter binding issues
    const BATCH_SIZE = 50;
    const batches: unknown[][] = [];

    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      batches.push(values.slice(i, i + BATCH_SIZE));
    }

    const columnType = this.getPostgresColumnType(column);

    // Build condition for each batch using sql.join() to preserve parameter bindings
    const batchConditions = batches.map((batch) => {
      const valueTuples = batch.map((value) => sql`(${value})`);
      const valuesClause = sql`(VALUES ${sql.join(valueTuples, sql`, `)}) AS t(val)`;

      if (columnType) {
        return sql`${column} NOT IN (SELECT val::${sql.raw(columnType)} FROM ${valuesClause})`;
      }
      return sql`${column} NOT IN (SELECT val FROM ${valuesClause})`;
    });

    // Combine all batches with AND (NOT IN requires all conditions to be true)
    if (batchConditions.length === 1) {
      const singleCondition = batchConditions[0];
      if (singleCondition) {
        return singleCondition;
      }
      return sql`TRUE`;
    }

    // Use nested grouping when there are too many batches to prevent parameter binding loss
    return this.combineBatchConditions(batchConditions, and, sql`TRUE`);
  }

  /**
   * Combine batch conditions using nested grouping when there are too many batches.
   * This prevents parameter binding loss that can occur when combining 200+ conditions.
   */
  private combineBatchConditions(
    batchConditions: (SQL | SQLWrapper)[],
    combiner: (...conditions: (SQL | SQLWrapper)[]) => SQL | SQLWrapper | undefined,
    fallback: SQL | SQLWrapper
  ): SQL | SQLWrapper {
    // Single batch - no need to combine
    if (batchConditions.length === 1) {
      const singleCondition = batchConditions[0];
      if (singleCondition) {
        return singleCondition;
      }
      return fallback;
    }

    // Use nested grouping when there are too many batches to prevent parameter binding loss
    if (batchConditions.length > DrizzlePredicateEmitter.MAX_BATCHES_PER_GROUP) {
      // Group batches into chunks
      const groups: (SQL | SQLWrapper)[][] = [];
      for (
        let i = 0;
        i < batchConditions.length;
        i += DrizzlePredicateEmitter.MAX_BATCHES_PER_GROUP
      ) {
        groups.push(batchConditions.slice(i, i + DrizzlePredicateEmitter.MAX_BATCHES_PER_GROUP));
      }

      // Combine each group
      const groupConditions = groups.map((group) => {
        if (group.length === 1) {
          const singleGroupCondition = group[0];
          if (singleGroupCondition) {
            return singleGroupCondition;
          }
          return fallback;
        }
        const groupCondition = combiner(...group);
        return groupCondition ?? fallback;
      });

      // Combine groups
      if (groupConditions.length === 1) {
        return groupConditions[0] ?? fallback;
      }
      const combinedCondition = combiner(...groupConditions);
      return combinedCondition ?? fallback;
    }

    // For smaller numbers of batches, use flat combination (more efficient)
    const combinedCondition = combiner(...batchConditions);
    return combinedCondition ?? fallback;
  }
}
