/**
 * @fileoverview Drizzle adapter type seam.
 */
import type {
  AnyColumn,
  BuildQueryResult,
  ExtractTablesWithRelations,
  FindTableByDBName,
  InferSelectModel,
  SQL,
  SQLWrapper,
  TableRelationalConfig,
  TablesRelationalConfig,
} from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DatabaseDriver, DatabaseTypeMap } from './drivers';

/**
 * Generic table type that works across all database drivers.
 *
 * @typedef {object} AnyTableType
 * @description Union type for all supported Drizzle table types
 * @see {@link SQLiteTable} from drizzle-orm/sqlite-core
 * @see {@link PgTable} from drizzle-orm/pg-core
 * @see {@link MySqlTable} from drizzle-orm/mysql-core
 *
 * @since 1.0.0
 */
export type AnyTableType = SQLiteTable | PgTable | MySqlTable;

/**
 * Generic column type that works across all database drivers.
 *
 * @typedef {object} AnyColumnType
 * @description Union type for all supported Drizzle column types
 * @alias AnyColumn from drizzle-orm
 *
 * @since 1.0.0
 */
export type AnyColumnType = AnyColumn;

/**
 * Union type for column references or SQL expressions.
 * Used when a filter condition can operate on either a direct column
 * or a computed SQL expression (e.g., JSONB field extraction).
 *
 * @description
 * This type enables filter handlers to work with both:
 * - Direct column references: `users.email`
 * - SQL expressions: `users.metadata->>'title'` (JSONB extraction)
 *
 * @example
 * ```typescript
 * const column: ColumnOrExpression = users.email; // Direct column
 * const expression: ColumnOrExpression = sql`${users.metadata}->>'title'`; // SQL expression
 * ```
 *
 * @since 1.0.0
 */
export type ColumnOrExpression = AnyColumnType | SQL | SQLWrapper;

/**
 * Primary key information extracted from a Drizzle table schema.
 *
 * @interface PrimaryKeyInfo
 * @description Stores the primary key column information for a table
 *
 * @property {string} columnName - The name of the primary key column (e.g., 'id')
 * @property {AnyColumnType} column - The Drizzle column object for the primary key
 * @property {boolean} isComposite - Whether this is a composite primary key (multiple columns)
 *
 * @example
 * ```typescript
 * const pkInfo: PrimaryKeyInfo = {
 *   columnName: 'id',
 *   column: users.id,
 *   isComposite: false
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface PrimaryKeyInfo {
  /** The primary key column name */
  columnName: string;

  /** The primary key column object */
  column: AnyColumnType;

  /** Whether this is a composite primary key */
  isComposite: boolean;
}

/**
 * Table type that has an id field
 */
export type TableWithId = AnyTableType & {
  id: AnyColumnType;
};

/**
 * Database instance type for Drizzle ORM
 *
 * @description Represents the actual Drizzle database instance returned by drizzle().
 * It provides full type safety and access to all Drizzle methods like .select(), .insert(), etc.
 *
 * @template TDriver - The specific database driver type
 *
 * @example
 * ```typescript
 * // Specific driver - fully typed
 * const db: DrizzleDatabase<'postgres'> = drizzle(connection);
 *
 * // Generic - requires runtime handling
 * const db: DrizzleDatabase<DatabaseDriver> = drizzle(connection);
 * ```
 */
export type DrizzleDatabase<TDriver extends DatabaseDriver> = DatabaseTypeMap[TDriver];

/**
 * Filter out relations from a schema, keeping only actual table types.
 *
 * @description
 * This utility type filters a schema object to include only properties that are
 * actual table types (extending AnyTableType), excluding relation objects.
 * This is necessary because Drizzle schemas often include both tables and relations
 * (e.g., `{ users, profiles, usersRelations }`), but the adapter only needs tables.
 *
 * @template TSchema - The schema type that may include both tables and relations
 * @returns A schema type containing only table types
 *
 * @example
 * ```typescript
 * type SchemaWithRelations = {
 *   users: PgTable;
 *   profiles: PgTable;
 *   usersRelations: Relations<...>; // This will be filtered out
 * };
 *
 * type TablesOnly = FilterTablesFromSchema<SchemaWithRelations>;
 * // Result: { users: PgTable; profiles: PgTable; }
 * ```
 *
 * @since 1.1.0
 */
export type FilterTablesFromSchema<TSchema> =
  TSchema extends Record<string, unknown>
    ? {
        [K in keyof TSchema as TSchema[K] extends AnyTableType ? K : never]: TSchema[K];
      }
    : Record<string, AnyTableType>;

/**
 * Extract the union of all inferred select models from a filtered schema.
 * This is used internally by DrizzleAdapter to represent the union of all possible record types.
 */
export type InferSelectModelFromFilteredSchema<TSchema extends Record<string, unknown>> = {
  [K in keyof FilterTablesFromSchema<TSchema>]: InferSelectModel<
    FilterTablesFromSchema<TSchema>[K] & AnyTableType
  >;
}[keyof FilterTablesFromSchema<TSchema>];

/**
 * Extract schema type from Drizzle database instance.
 *
 * @description
 * Attempts to extract the schema type parameter from a Drizzle database instance.
 * This enables automatic type inference when using the factory function.
 * The extracted schema is filtered to include only tables, excluding relations.
 *
 * @template TDB - The Drizzle database instance type
 * @returns The schema type filtered to only include tables (not relations)
 *
 * @example
 * ```typescript
 * type MySchema = ExtractSchemaFromDB<typeof db>;
 * // Returns the schema type passed to drizzle(connection, { schema })
 * // but filtered to only include tables, not relations
 * ```
 */
export type ExtractSchemaFromDB<TDB> =
  // PostgreSQL drivers
  TDB extends PostgresJsDatabase<infer S>
    ? FilterTablesFromSchema<S>
    : TDB extends NodePgDatabase<infer S>
      ? FilterTablesFromSchema<S>
      : TDB extends NeonHttpDatabase<infer S>
        ? FilterTablesFromSchema<S>
        : // MySQL drivers
          TDB extends MySql2Database<infer S>
          ? FilterTablesFromSchema<S>
          : // SQLite drivers
            TDB extends BetterSQLite3Database<infer S>
            ? FilterTablesFromSchema<S>
            : Record<string, AnyTableType>;

/**
 * Extract driver type from Drizzle database instance.
 *
 * @template {any} TDB - The Drizzle database instance type
 *
 * @description
 * This conditional type automatically determines the database driver string from a Drizzle instance type
 * at compile-time, enabling full type safety when working with different database drivers.
 * It performs pattern matching on the database instance type and returns the corresponding driver identifier.
 *
 * Supported database types and their corresponding driver strings:
 *
 * PostgreSQL drivers (all return 'postgres'):
 * - `PostgresJsDatabase` (drizzle-orm/postgres-js)
 * - `NodePgDatabase` (drizzle-orm/node-postgres)
 * - `NeonHttpDatabase` (drizzle-orm/neon-http)
 *
 * MySQL drivers (all return 'mysql'):
 * - `MySql2Database` (drizzle-orm/mysql2)
 *
 * SQLite drivers (all return 'sqlite'):
 * - `BetterSQLite3Database` (drizzle-orm/better-sqlite3)
 *
 * Other types → Falls back to `DatabaseDriver` union type
 *
 * @returns {DatabaseDriver} The driver type as a string literal or union type
 *
 * @example
 * ```typescript
 * import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
 * import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
 * import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
 *
 * // All PostgreSQL drivers return 'postgres'
 * type PostgresDriver = ExtractDriverFromDB<PostgresJsDatabase<any>>;
 * // Result: 'postgres'
 *
 * type NodePgDriver = ExtractDriverFromDB<NodePgDatabase<any>>;
 * // Result: 'postgres'
 *
 * // SQLite driver returns 'sqlite'
 * type SQLiteDriver = ExtractDriverFromDB<BetterSQLite3Database<any>>;
 * // Result: 'sqlite'
 * ```
 *
 * @see {@link DatabaseDriver} The returned driver type
 * @see {@link DatabaseTypeMap} The mapping of drivers to database types
 * @see {@link PostgresDatabaseType} Union of all PostgreSQL drivers
 * @see {@link SQLiteDatabaseType} SQLite driver type
 *
 * @since 1.0.0 (expanded in 1.1.0)
 */
export type ExtractDriverFromDB<TDB> =
  // PostgreSQL drivers
  TDB extends PostgresJsDatabase<infer _>
    ? 'postgres'
    : TDB extends NodePgDatabase<infer _>
      ? 'postgres'
      : TDB extends NeonHttpDatabase<infer _>
        ? 'postgres'
        : // MySQL drivers
          TDB extends MySql2Database<infer _>
          ? 'mysql'
          : // SQLite drivers
            TDB extends BetterSQLite3Database<infer _>
            ? 'sqlite'
            : DatabaseDriver;

/**
 * Extract the FULL (unfiltered, relations-included) schema type parameter
 * embedded in a Drizzle database instance -- the counterpart to
 * {@link ExtractSchemaFromDB}, which filters relations OUT. The `$types`
 * recipe below needs the unfiltered schema because
 * `ExtractTablesWithRelations` (from `drizzle-orm`) reads relation
 * definitions (e.g. `usersRelations = relations(users, ...)`) that live
 * alongside the plain tables in the SAME schema object passed to
 * `drizzle(connection, { schema })`.
 */
export type ExtractRawSchemaFromDB<TDB> =
  TDB extends PostgresJsDatabase<infer S>
    ? S
    : TDB extends NodePgDatabase<infer S>
      ? S
      : TDB extends NeonHttpDatabase<infer S>
        ? S
        : TDB extends MySql2Database<infer S>
          ? S
          : TDB extends BetterSQLite3Database<infer S>
            ? S
            : Record<string, unknown>;

/**
 * Depth-decrement lookup, matching `@better-tables/core`'s `Prev` (used by
 * `Paths<T>`) -- see `plans/design/table-definition-dx.md`, Step 1 decision
 * 2: "this deliberately mirrors plan 011's `Paths<T>` depth cap of 3 ...
 * one '3' to reason about across the whole contract."
 */
type SchemaDepthPrev = [never, 0, 1, 2, 3];

/**
 * Build the `with` config object `BuildQueryResult` needs to compute a
 * depth-capped, relation-aware row type. `BuildQueryResult` is driven by an
 * explicit `with` config and stops recursing at `true` -- there is no
 * built-in "every relation to depth N" helper, so this recurses the SAME
 * depth-capped shape `Paths<T, D>` implements natively for plain object
 * types, for the different purpose of producing a `with` CONFIG object
 * instead of a path-string union.
 *
 * Verified against the installed `drizzle-orm@0.45.2` package (design doc
 * Step 1 decision 2, "The Drizzle recipe (verified)").
 */
type DeepWith<
  TConfig extends TableRelationalConfig,
  TSchema extends TablesRelationalConfig,
  D extends number,
  Visited extends string,
> = [D] extends [never]
  ? Record<string, never>
  : {
      // Finding 12: OMIT any relation whose referenced table is already on the
      // current path (`Visited`). Those are inverse "back-reference" edges
      // (e.g. `customer.tickets` reached from a `tickets` row) that a row
      // consumer almost never wants -- they explode the row type into
      // recursive unions that no `columns` selection actually returns. Keeping
      // only FORWARD relations makes `$infer.Row`/`RowOf` directly usable as a
      // consumer's row type instead of forcing a hand-shaped duplicate + cast.
      // Non-optional (`K`, not `K?`): a FORWARD relation kept here is always
      // present in the computed row, so `BuildQueryResult` yields a clean
      // intersection (`Post & { comments: Comment[] }`) instead of an
      // "either selected or not" union (`Post | Post & { comments }`) that
      // makes the inferred row awkward to consume.
      [K in keyof TConfig['relations'] as TConfig['relations'][K] extends {
        referencedTableName: infer RT extends string;
      }
        ? RT extends Visited
          ? never
          : K
        : K]: TConfig['relations'][K] extends {
        referencedTableName: infer RT extends string;
      }
        ? FindTableByDBName<TSchema, RT> extends infer RC extends TableRelationalConfig
          ? { with: DeepWith<RC, TSchema, SchemaDepthPrev[D], Visited | RT> }
          : true
        : true;
    };

/**
 * The relation-aware row type for table `TTableName`, depth-capped to match
 * `Paths<T>`'s default depth (3).
 *
 * **Verified caveat (design doc Step 1 decision 2):** relation nullability
 * here is NOT "could this row be missing", it is "is the local join column
 * `.notNull()`". A `profile: one(profiles, { fields: [users.id], references:
 * [profiles.userId] })` relation declared using the PRIMARY KEY as the local
 * field types as non-nullable in Drizzle's own inference (`users.id` is
 * always `.notNull()`), even though a matching profile row may not exist at
 * runtime. This is a pre-existing Drizzle behavior (`createOne` /
 * `BuildRelationResult`'s `Equal<TRel['isNullable'], false>` check), not
 * something this recipe introduces or works around -- flagged here per the
 * design doc's instruction to document it prominently wherever this recipe
 * ships.
 */
export type RelationAwareRow<
  TSchema extends Record<string, unknown>,
  TTableName extends string,
  D extends number = 3,
> = ExtractTablesWithRelations<TSchema> extends infer TRel extends TablesRelationalConfig
  ? TTableName extends keyof TRel
    ? BuildQueryResult<
        TRel,
        TRel[TTableName],
        { with: DeepWith<TRel[TTableName], TRel, D, TRel[TTableName]['dbName']> }
      >
    : never
  : never;

/**
 * The type-only `$types` schema catalog a Drizzle-backed `betterTables()`
 * instance carries (`SchemaAwareAdapter<T>` from `@better-tables/core`,
 * `types/paths.ts`). Populated for every table name in the FILTERED
 * (tables-only) schema `ExtractSchemaFromDB<TDB>` already computes; each
 * table's `row` is the relation-aware row computed from the FULL (raw,
 * relations-included) schema embedded in `TDB`.
 *
 * Zero runtime values -- see `drizzleAdapter()`'s return type in
 * `factory.ts`, which intersects this in as an OPTIONAL phantom property
 * (never assigned).
 */
export type DrizzleSchemaTypes<TDB> = {
  tables: {
    [TName in keyof ExtractSchemaFromDB<TDB> & string]: {
      row: RelationAwareRow<ExtractRawSchemaFromDB<TDB>, TName>;
    };
  };
};

/**
 * Error types for the adapter
 */
export class DrizzleAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DrizzleAdapterError';
  }
}

export class RelationshipError extends DrizzleAdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'RELATIONSHIP_ERROR', details);
    this.name = 'RelationshipError';
  }
}

export class QueryError extends DrizzleAdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUERY_ERROR', details);
    this.name = 'QueryError';
  }
}

export class SchemaError extends DrizzleAdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SCHEMA_ERROR', details);
    this.name = 'SchemaError';
  }
}
