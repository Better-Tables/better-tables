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
import type {
  AnyColumnType,
  AnyTableType,
  ColumnOrExpression,
  ColumnPath,
  DatabaseDriver,
} from './types';
import { QueryError } from './types';
import { getArrayElementType, isArrayColumn } from './utils/drizzle-schema-utils';

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
 * **Best Practices**:
 * - Never use sql.raw() with user-provided values directly
 * - Always validate and escape values before using sql.raw()
 * - Use Drizzle's parameterized functions (eq, like, ilike, etc.) when possible
 * - Limit information disclosed in error messages
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
   * @security
   * This method ensures all filter values are properly parameterized through
   * Drizzle's query builder. User-provided values are never directly interpolated
   * into SQL strings, preventing SQL injection attacks.
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
    const columnPath = this.relationshipManager.resolveColumnPath(filter.columnId, primaryTable);

    // Check if this is a JSONB accessor (columnId contains dot but is not a relationship)
    const isJsonbAccessor = this.isJsonbAccessor(columnPath);

    // Get the column or JSONB extraction expression
    let columnOrExpression: ColumnOrExpression;
    if (isJsonbAccessor) {
      columnOrExpression = this.buildJsonbExtraction(columnPath);
    } else {
      const column = this.getColumn(columnPath);
      if (!column) {
        // Limit information disclosure: Don't expose full schema structure in production
        // Only include minimal debugging information
        throw new QueryError(`Column not found: ${filter.columnId}`, {
          columnId: filter.columnId,
          table: columnPath.table,
          field: columnPath.field,
        });
      }
      columnOrExpression = column;
    }

    const condition = this.mapOperatorToCondition(
      columnOrExpression,
      filter.operator,
      filter.values,
      filter.includeNull,
      filter.type
    );

    // Return undefined if no valid condition was generated (e.g., empty values)
    // This allows callers to handle empty filters gracefully
    if (!condition) {
      return undefined as unknown as SQL | SQLWrapper;
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
   *
   * @example
   * ```typescript
   * // JSONB accessor
   * isJsonbAccessor({
   *   columnId: 'survey.title',
   *   table: 'surveys',
   *   field: 'survey',
   *   isNested: false
   * }); // true
   *
   * // Relationship (not JSONB)
   * isJsonbAccessor({
   *   columnId: 'profile.bio',
   *   table: 'profile',
   *   field: 'bio',
   *   isNested: true
   * }); // false
   * ```
   */
  private isJsonbAccessor(columnPath: ColumnPath): boolean {
    // JSONB accessors have dots in columnId but isNested is false
    // (e.g., "survey.title" where "survey" is a JSONB column)
    return columnPath.columnId.includes('.') && !columnPath.isNested;
  }

  /**
   * Type guard to check if a value is a SQL expression (not a column type).
   *
   * @description
   * Drizzle ORM SQL expressions have specific properties that distinguish them from column types.
   * This method uses multiple checks to reliably identify SQL expressions:
   * - Checks for 'sql' property (present in SQL instances)
   * - Checks for 'queryChunks' property (internal Drizzle structure)
   * - Checks for Symbol-based type identification when available
   * - Checks for constructor name (SQL instances have specific constructor)
   *
   * **Note**: Column types from Drizzle have properties like 'table', 'name', 'dataType', etc.
   * SQL expressions do not have these properties, which helps distinguish them.
   *
   * @param value - The value to check
   * @returns True if the value is a SQL expression, false if it's a column type
   *
   * @example
   * ```typescript
   * const column = users.email;
   * const expression = sql`${users.metadata}->>'title'`;
   *
   * isSqlExpression(column); // false
   * isSqlExpression(expression); // true
   * ```
   *
   * @internal
   * This is a private helper method used internally for type narrowing.
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
    // Note: Constructor name checking is less reliable in minified code
    const constructorName = value.constructor?.name;
    if (constructorName === 'SQL' || constructorName === 'SQLWrapper') {
      return true;
    }

    // Default: If we can't determine, assume it's a column type
    // This is safer because column types are more common and have stricter type checking
    return false;
  }

  /**
   * Create IS NULL condition for both columns and SQL expressions.
   *
   * @description
   * Handles null checks for both direct column references and SQL expressions.
   * Uses Drizzle's `isNull()` function for columns and raw SQL for expressions.
   *
   * @param column - Column reference or SQL expression
   * @returns SQL condition for IS NULL check
   *
   * @example
   * ```typescript
   * // Direct column
   * createIsNullCondition(users.email); // Uses isNull(users.email)
   *
   * // SQL expression (JSONB extraction)
   * createIsNullCondition(sql`${users.metadata}->>'title'`); // Uses raw SQL
   * ```
   */
  private createIsNullCondition(column: ColumnOrExpression): SQL | SQLWrapper {
    if (this.isSqlExpression(column)) {
      return sql`${column} IS NULL`;
    }
    return isNull(column);
  }

  /**
   * Create IS NOT NULL condition for both columns and SQL expressions.
   *
   * @description
   * Handles non-null checks for both direct column references and SQL expressions.
   * Uses Drizzle's `isNotNull()` function for columns and raw SQL for expressions.
   *
   * @param column - Column reference or SQL expression
   * @returns SQL condition for IS NOT NULL check
   *
   * @example
   * ```typescript
   * // Direct column
   * createIsNotNullCondition(users.email); // Uses isNotNull(users.email)
   *
   * // SQL expression (JSONB extraction)
   * createIsNotNullCondition(sql`${users.metadata}->>'title'`); // Uses raw SQL
   * ```
   */
  private createIsNotNullCondition(column: ColumnOrExpression): SQL | SQLWrapper {
    if (this.isSqlExpression(column)) {
      return sql`${column} IS NOT NULL`;
    }
    return isNotNull(column);
  }

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
   *
   * @example
   * ```typescript
   * // For columnId "survey.title" where "survey" is a JSONB column
   * const expression = buildJsonbExtraction({
   *   columnId: 'survey.title',
   *   table: 'surveys',
   *   field: 'survey',
   *   isNested: false
   * });
   * // PostgreSQL: sql`${surveys.survey}->>'title'`
   * // MySQL: sql`JSON_UNQUOTE(JSON_EXTRACT(${surveys.survey}, '$.title'))`
   * // SQLite: sql`json_extract(${surveys.survey}, '$.title')`
   * ```
   *
   * @security
   * This method uses sql.raw() with validated and escaped field names.
   * The field name is validated to contain only safe characters and is escaped
   * before injection. This is safe because:
   * - Field names come from columnId (controlled, validated input)
   * - Multiple validation layers prevent malicious input
   * - Escaping prevents SQL injection even if validation is bypassed
   */
  private buildJsonbExtraction(columnPath: ColumnPath): SQL {
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
    if (jsonbField.length > FilterHandler.MAX_JSONB_FIELD_NAME_LENGTH) {
      throw new QueryError(
        `JSONB field name exceeds maximum length: ${jsonbField.length} > ${FilterHandler.MAX_JSONB_FIELD_NAME_LENGTH}`,
        {
          columnId: columnPath.columnId,
          field: jsonbField,
          maxLength: FilterHandler.MAX_JSONB_FIELD_NAME_LENGTH,
        }
      );
    }

    // Pattern validation: Only allow safe characters (alphanumeric, underscore, hyphen)
    // This prevents injection of malicious SQL in field names
    if (!FilterHandler.SAFE_JSONB_FIELD_NAME_PATTERN.test(jsonbField)) {
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

  /**
   * Get case-insensitive LIKE condition based on database type.
   *
   * @description
   * Generates a case-insensitive pattern matching condition. The implementation
   * varies by database:
   * - PostgreSQL: Uses native `ILIKE` operator for columns, `LIKE` with `LOWER()` for SQL expressions
   * - MySQL/SQLite: Uses `LIKE` with `LOWER()` function
   *
   * **Security**: All patterns are properly parameterized through Drizzle's `like()` function
   * to prevent SQL injection attacks.
   *
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   *
   * @param column - Column reference or SQL expression to search in
   * @param pattern - The search pattern (may contain % wildcards)
   * @returns SQL condition for case-insensitive pattern matching
   *
   * @example
   * ```typescript
   * // Direct column
   * getCaseInsensitiveLike(users.email, '%@example.com'); // Uses ilike() or like(LOWER())
   *
   * // SQL expression (JSONB extraction)
   * getCaseInsensitiveLike(sql`${users.metadata}->>'title'`, '%search%');
   * ```
   *
   * @security
   * This method properly parameterizes all pattern values to prevent SQL injection.
   * Never use sql.raw() with user-provided pattern values.
   */
  private getCaseInsensitiveLike(column: ColumnOrExpression, pattern: string): SQL | SQLWrapper {
    if (this.databaseType === 'sqlite') {
      // SQLite doesn't support ILIKE, so we use LIKE with LOWER() function
      // This works for both columns and SQL expressions
      // Pattern is automatically parameterized by Drizzle's like() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else if (this.databaseType === 'mysql') {
      // MySQL doesn't support ILIKE, so we use LIKE with LOWER() function
      // This works for both columns and SQL expressions
      // Pattern is automatically parameterized by Drizzle's like() function
      return like(sql`LOWER(${column})`, pattern.toLowerCase());
    } else {
      // PostgreSQL supports ILIKE natively
      // For SQL expressions, use LIKE with LOWER() for consistency and safety
      // This ensures pattern is always parameterized, preventing SQL injection
      // For columns, use Drizzle's ilike function which also parameterizes
      if (this.isSqlExpression(column)) {
        // Use like() with LOWER() to ensure pattern is parameterized
        // This is safer than using ILIKE with direct interpolation
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
   *
   * @description
   * Builds a date comparison condition with proper type casting for the database.
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   *
   * @param column - Column reference or SQL expression
   * @param operator - Comparison operator
   * @param value - Date value to compare against
   * @returns SQL condition for date comparison
   */
  private createDateComparisonCondition(
    column: ColumnOrExpression,
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
   * Create date range condition (inclusive).
   *
   * @description
   * Builds a date range condition that includes both start and end dates.
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   *
   * @param column - Column reference or SQL expression
   * @param startDate - Start of the date range (inclusive)
   * @param endDate - End of the date range (inclusive)
   * @returns SQL condition for date range
   */
  private createDateRangeCondition(
    column: ColumnOrExpression,
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
   * Map filter operator to SQL condition.
   *
   * @description
   * Central dispatcher that routes filter operators to their specific handlers.
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   *
   * @param column - Column reference or SQL expression
   * @param operator - The filter operator to apply
   * @param values - Filter values (operator-specific)
   * @param includeNull - Whether to include NULL values in the condition
   * @param columnType - Optional column type hint for operator validation
   * @returns SQL condition for the filter, or undefined if no valid condition can be generated (e.g., empty values)
   *
   * @throws {QueryError} If the operator is unsupported or invalid
   */
  private mapOperatorToCondition(
    column: ColumnOrExpression,
    operator: FilterOperator,
    values: unknown[],
    includeNull?: boolean,
    columnType?: string
  ): SQL | SQLWrapper | undefined {
    const conditions: (SQL | SQLWrapper)[] = [];

    // Handle null inclusion
    if (includeNull && operator !== 'isNull' && operator !== 'isNotNull') {
      conditions.push(this.createIsNullCondition(column));
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

    // If no conditions were generated (e.g., empty values), return undefined
    // This allows callers to handle empty filters gracefully
    if (conditions.length === 0) {
      return undefined;
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
        if (typeof value !== 'string') {
          return undefined;
        }
        return this.getCaseInsensitiveLike(column, `%${value}%`);
      }
      case 'equals':
        return eq(column, values[0]);
      case 'startsWith': {
        const value = values[0];
        if (typeof value !== 'string') {
          return undefined;
        }
        return this.getCaseInsensitiveLike(column, `${value}%`);
      }
      case 'endsWith': {
        const value = values[0];
        if (typeof value !== 'string') {
          return undefined;
        }
        return this.getCaseInsensitiveLike(column, `%${value}`);
      }
      case 'isEmpty':
        return or(this.createIsNullCondition(column), eq(column, ''));
      case 'isNotEmpty':
        return and(this.createIsNotNullCondition(column), not(eq(column, '')));
      case 'notEquals':
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  private handleNumberOperator(
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
    if (requiresSingleValue && typeof values[0] !== 'number') {
      return undefined;
    }
    if (requiresTwoValues && (typeof values[0] !== 'number' || typeof values[1] !== 'number')) {
      return undefined;
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

  private handleDateOperator(
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

  private handleOptionOperator(
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
      // For equals/notEquals, we need at least one value
      if (['equals', 'notEquals'].includes(operator)) {
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
      case 'equals':
        if (values[0] === undefined) {
          return undefined;
        }
        return eq(column, values[0]);
      case 'notEquals':
        if (values[0] === undefined) {
          return undefined;
        }
        return not(eq(column, values[0]));
      default:
        return undefined;
    }
  }

  private handleMultiOptionOperator(
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

  private handleUniversalOperator(
    column: ColumnOrExpression,
    operator: string
  ): SQL | SQLWrapper | undefined {
    switch (operator) {
      case 'isNull':
        return this.createIsNullCondition(column);
      case 'isNotNull':
        return this.createIsNotNullCondition(column);
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
   * Build date condition for relative dates.
   *
   * @description
   * Creates date conditions for relative time periods (today, this week, etc.).
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   *
   * @param column - Column reference or SQL expression
   * @param period - Relative time period identifier
   * @returns SQL condition for the relative date period
   */
  private buildDateCondition(column: ColumnOrExpression, period: string): SQL | SQLWrapper {
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
   * Build array contains condition - database-specific implementation.
   *
   * @description
   * Creates a condition to check if an array/JSON column contains a specific value.
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   * For PostgreSQL, detects native array columns and uses proper array operators.
   *
   * @param column - Column reference or SQL expression
   * @param value - Value to check for in the array
   * @returns SQL condition for array containment
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
        // Note: This requires the json_each table-valued function (standard in modern SQLite)
        return sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ${value})`;
      default:
        throw new QueryError(`Unsupported database type: ${this.databaseType}`, {
          databaseType: this.databaseType,
        });
    }
  }

  /**
   * Build array includes any condition - database-specific implementation.
   *
   * @description
   * Creates a condition to check if an array/JSON column contains any of the specified values.
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   * For PostgreSQL, detects native array columns and uses proper array operators.
   *
   * @param column - Column reference or SQL expression
   * @param values - Array of values to check for
   * @returns SQL condition for array overlap
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
   * Build array includes all condition - database-specific implementation.
   *
   * @description
   * Creates a condition to check if an array/JSON column contains all of the specified values.
   * Supports both direct column references and SQL expressions (e.g., JSONB extractions).
   * For PostgreSQL, detects native array columns and uses proper array operators.
   *
   * @param column - Column reference or SQL expression
   * @param values - Array of values that must all be present
   * @returns SQL condition for array containment
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
   * Check if a column is a PostgreSQL array column.
   *
   * @description
   * Determines if a column is a native PostgreSQL array type (e.g., uuid[], text[]).
   * This is only applicable for PostgreSQL databases. For other database types,
   * this will always return false.
   *
   * @param column - The column to check
   * @returns `true` if the column is a PostgreSQL array column, `false` otherwise
   *
   * @example
   * ```typescript
   * const isArray = this.isPostgresArrayColumn(eventsTable.organizerIds);
   * // Returns true for uuid[] column in PostgreSQL
   * ```
   *
   * @since 1.0.0
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
   *
   * @description
   * Extracts the base element type from a PostgreSQL array column.
   * For example, a `uuid[]` array column would return `'uuid'`,
   * and a `text[]` array column would return `'text'`.
   *
   * @param column - The column to examine
   * @returns The element type as a string (e.g., 'uuid', 'text'), or `null` if not an array or type cannot be determined
   *
   * @example
   * ```typescript
   * const elementType = this.getPostgresArrayElementType(eventsTable.organizerIds);
   * // Returns 'uuid' for uuid[] column
   * ```
   *
   * @since 1.0.0
   */
  private getPostgresArrayElementType(column: AnyColumnType): string | null {
    if (!this.isPostgresArrayColumn(column)) {
      return null;
    }

    return getArrayElementType(column);
  }

  /**
   * Build a PostgreSQL array literal with proper type casting.
   *
   * @description
   * Generates a PostgreSQL array literal with proper type casting for each element.
   * For example, for uuid values ['uuid1', 'uuid2'], this generates:
   * `ARRAY['uuid1'::uuid, 'uuid2'::uuid]::uuid[]`
   *
   * **Security**: All values are properly parameterized through Drizzle's SQL template tag.
   * The element type is validated to prevent SQL injection.
   *
   * @param values - Array of values to include in the array literal
   * @param elementType - The PostgreSQL type for array elements (e.g., 'uuid', 'text', 'integer')
   * @returns SQL expression representing the PostgreSQL array literal
   *
   * @throws {QueryError} If the element type is invalid or values cannot be cast
   *
   * @example
   * ```typescript
   * const arrayLiteral = this.buildPostgresArrayLiteral(['uuid1', 'uuid2'], 'uuid');
   * // Generates: ARRAY['uuid1'::uuid, 'uuid2'::uuid]::uuid[]
   * ```
   *
   * @since 1.0.0
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
      // The value is parameterized, and only the type name is raw (which we validated)
      return sql`${value}::${sql.raw(elementType)}`;
    });

    // Join typed values and cast the entire array
    return sql`ARRAY[${sql.join(typedValues, sql`, `)}]::${sql.raw(elementType)}[]`;
  }

  /**
   * Get PostgreSQL type name for a column (for casting purposes).
   *
   * @param column - The column to get the type for
   * @returns PostgreSQL type name (e.g., 'uuid', 'text', 'integer') or null if unknown
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
   * Build a parameterized PostgreSQL array condition for large arrays using = ANY().
   *
   * @description
   * For very large arrays (>1000 values), inArray can cause parameter binding issues.
   * This method uses a parameterized ARRAY literal with = ANY() to maintain security
   * while avoiding the parameter limit issues.
   *
   * **Security**: All values are properly parameterized through Drizzle's SQL template tag.
   * This maintains the same security guarantees as inArray while supporting larger arrays.
   *
   * @param column - The column to compare against
   * @param values - Array of values to check
   * @returns SQL expression: column = ANY(ARRAY[$1, $2, ...]::type[])
   *
   * @example
   * ```typescript
   * const condition = this.buildLargeArrayAnyCondition(usersTable.id, [id1, id2, ...]);
   * // Generates: usersTable.id = ANY(ARRAY[$1, $2, ...]::uuid[])
   * ```
   *
   * @since 1.0.0
   */
  private buildLargeArrayAnyCondition(
    column: ColumnOrExpression,
    values: unknown[]
  ): SQL | SQLWrapper {
    // Build parameterized PostgreSQL array: ARRAY[$1, $2, ...]
    // Each value is properly parameterized through Drizzle's sql template tag
    const parameterizedValues = values.map((v) => sql`${v}`);
    const arrayLiteral = sql`ARRAY[${sql.join(parameterizedValues, sql`, `)}]`;

    // Cast array to match column type if we can determine it
    // This prevents "operator does not exist: uuid = text" errors
    const columnType = this.getPostgresColumnType(column);
    if (columnType) {
      // Cast the array to the column's type: ARRAY[...]::uuid[]
      return sql`${column} = ANY(${arrayLiteral}::${sql.raw(columnType)}[])`;
    }

    // If we can't determine the type, let PostgreSQL infer it (may cause errors)
    return sql`${column} = ANY(${arrayLiteral})`;
  }

  /**
   * Build a parameterized PostgreSQL array condition for large arrays using != ALL().
   *
   * @description
   * For very large arrays (>1000 values), notInArray can cause parameter binding issues.
   * This method uses a parameterized ARRAY literal with != ALL() to maintain security
   * while avoiding the parameter limit issues.
   *
   * **Security**: All values are properly parameterized through Drizzle's SQL template tag.
   * This maintains the same security guarantees as notInArray while supporting larger arrays.
   *
   * @param column - The column to compare against
   * @param values - Array of values to exclude
   * @returns SQL expression: column != ALL(ARRAY[$1, $2, ...]::type[])
   *
   * @example
   * ```typescript
   * const condition = this.buildLargeArrayAllCondition(usersTable.id, [id1, id2, ...]);
   * // Generates: usersTable.id != ALL(ARRAY[$1, $2, ...]::uuid[])
   * ```
   *
   * @since 1.0.0
   */
  private buildLargeArrayAllCondition(
    column: ColumnOrExpression,
    values: unknown[]
  ): SQL | SQLWrapper {
    // Build parameterized PostgreSQL array: ARRAY[$1, $2, ...]
    // Each value is properly parameterized through Drizzle's sql template tag
    const parameterizedValues = values.map((v) => sql`${v}`);
    const arrayLiteral = sql`ARRAY[${sql.join(parameterizedValues, sql`, `)}]`;

    // Cast array to match column type if we can determine it
    // This prevents "operator does not exist: uuid = text" errors
    const columnType = this.getPostgresColumnType(column);
    if (columnType) {
      // Cast the array to the column's type: ARRAY[...]::uuid[]
      return sql`${column} != ALL(${arrayLiteral}::${sql.raw(columnType)}[])`;
    }

    // If we can't determine the type, let PostgreSQL infer it (may cause errors)
    return sql`${column} != ALL(${arrayLiteral})`;
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
