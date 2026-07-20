/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { ColumnType, FilterState } from '@better-tables/core';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import type { AnyTableType, DrizzleDatabase, FilterTablesFromSchema } from './core';
import type { DatabaseDriver } from './drivers';

/**
 * Context provided to computed field functions
 */
export interface ComputedFieldContext<
  TSchema extends Record<string, unknown> = Record<string, AnyTableType>,
  TDriver extends DatabaseDriver = DatabaseDriver,
> {
  /** Primary table name */
  primaryTable: string;

  /** All rows being processed (for batch computation) */
  allRows: unknown[];

  /** Database instance (for querying related tables) */
  db: DrizzleDatabase<TDriver>;

  /** Schema (filtered to only include tables, relations are excluded) */
  schema: FilterTablesFromSchema<TSchema>;
}

/**
 * Configuration for a computed/virtual field that doesn't exist in the database schema
 *
 * @description
 * Computed fields allow you to add virtual columns that are calculated at runtime.
 * These fields can be computed from the row data, related tables, or any other source.
 *
 * @example
 * ```typescript
 * {
 *   field: 'attendeeCount',
 *   type: 'number',
 *   compute: async (row, context) => {
 *     const count = await context.db
 *       .select({ count: count() })
 *       .from(eventAttendeesTable)
 *       .where(eq(eventAttendeesTable.eventId, row.id));
 *     return count[0]?.count || 0;
 *   },
 *   filter: async (filter, context) => {
 *     // Transform filter to query related table
 *     const matchingIds = await getMatchingEventIds(filter, context);
 *     return [{
 *       columnId: 'id',
 *       operator: 'isAnyOf',
 *       values: matchingIds,
 *       type: 'text',
 *     }];
 *   },
 * }
 * ```
 */
export interface ComputedFieldConfig<TData = Record<string, unknown>> {
  /** Field name (e.g., 'attendeeCount') */
  field: string;

  /** Function to compute the field value from the row data */
  compute: (row: TData, context: ComputedFieldContext) => Promise<unknown> | unknown;

  /** Function to handle filtering on this computed field */
  filter?: (
    filter: FilterState,
    context: ComputedFieldContext
  ) => Promise<FilterState[]> | FilterState[];

  /**
   * Function to handle filtering on this computed field by returning a SQL condition directly.
   * This is more efficient than `filter` for large result sets because the SQL condition
   * is applied in the WHERE clause before pagination, rather than querying all matching IDs first.
   *
   * If both `filter` and `filterSql` are provided, `filterSql` takes precedence.
   *
   * ## The returned SQL must be self-contained
   *
   * The condition is applied as an opaque predicate: the query planner cannot
   * introspect it, so it does NOT contribute to JOIN planning. Referencing a
   * related table's column directly produces SQL whose `FROM` clause lacks that
   * table, and the query fails:
   *
   * ```typescript
   * // BROKEN -- `profiles` is never joined, so this emits
   * // `select … from "users" where "profiles"."github" is not null`
   * filterSql: () => sql`${profiles.github} is not null`
   * ```
   *
   * Reference only the primary table, or pull the related table into the
   * condition's own scope with a correlated subquery:
   *
   * ```typescript
   * // WORKS -- `profiles` lives in the subquery's own FROM clause
   * filterSql: () => sql`exists (
   *   select 1 from ${profiles}
   *   where ${profiles.userId} = ${users.id} and ${profiles.github} is not null
   * )`
   * ```
   *
   * (Filtering by a plain relation path -- `profile.github` -- needs none of
   * this; the adapter plans that JOIN itself. `filterSql` is for expressions
   * the column layer cannot express.)
   *
   * @example
   * ```typescript
   * filterSql: async (filter, context) => {
   *   const languageCode = filter.values?.[0];
   *   const languageArrayJson = JSON.stringify([{ code: languageCode }]);
   *   return sql`(${usersTable.demographics}->'language') @> ${languageArrayJson}`;
   * }
   * ```
   */
  filterSql?: (
    filter: FilterState,
    context: ComputedFieldContext
  ) => Promise<SQL | SQLWrapper> | SQL | SQLWrapper;

  /**
   * Function to handle sorting on this computed field by returning a SQL expression directly.
   * This is more efficient than in-memory sorting because the SQL expression is used in the
   * ORDER BY clause, allowing the database to handle sorting efficiently.
   *
   * The SQL expression will be added to the SELECT clause with an alias matching the field name,
   * and then used in the ORDER BY clause. This allows sorting by computed values without fetching
   * all data into memory.
   *
   * @example
   * ```typescript
   * sortSql: async (context) => {
   *   return sql`(
   *     SELECT COUNT(*)
   *     FROM user_segment_mappings
   *     WHERE segment_id = ${userSegmentsTable.id}
   *   )`;
   * }
   * ```
   *
   * This will generate SQL like:
   * ```sql
   * SELECT
   *   "userSegmentsTable".*,
   *   (SELECT COUNT(*) FROM user_segment_mappings WHERE segment_id = "userSegmentsTable".id) AS "userCount"
   * FROM user_segments "userSegmentsTable"
   * ORDER BY "userCount" DESC
   * ```
   */
  sortSql?: (context: ComputedFieldContext) => Promise<SQL | SQLWrapper> | SQL | SQLWrapper;

  /** Type of the computed field (for validation) */
  type?: ColumnType;

  /** Whether this field should be included by default when no columns specified */
  includeByDefault?: boolean;

  /** Whether this computed field requires the underlying database column to be fetched.
   * When true, the column will be included in the SELECT statement even though it's a computed field.
   * This is useful when a real column needs custom filter logic but the compute function
   * needs to access the actual column value.
   * @default false
   */
  requiresColumn?: boolean;
}

/**
 * Computed field configuration with resolved SQL expression for sorting.
 * This is an internal type used by the query builder after resolving sortSql expressions.
 *
 * @template TData - The type of data items
 */
export interface ComputedFieldWithResolvedSortSql<TData = Record<string, unknown>>
  extends ComputedFieldConfig<TData> {
  /** Resolved SQL expression from sortSql function (pre-resolved in adapter) */
  __resolvedSortSql: SQL | SQLWrapper;
}
