/**
 * @fileoverview Shared, ORM-agnostic structural types for the adapter toolkit
 * @module @better-tables/adapters-toolkit/types
 *
 * @description
 * Pure data shapes and small "port" interfaces used by the toolkit's
 * ORM-agnostic primitives. Concrete adapters (Drizzle, Prisma, ...) supply
 * their own table/column types as generic parameters and adapt their
 * ORM-specific introspection/relationship logic to these port interfaces —
 * the toolkit itself never imports an ORM client.
 */

/**
 * A single hop in a relationship path between two tables.
 */
export interface RelationshipPath {
  /** Source table */
  from: string;

  /** Target table */
  to: string;

  /** Foreign key field in target table */
  foreignKey: string;

  /** Local key field in source table */
  localKey: string;

  /** Relationship cardinality */
  cardinality: 'one' | 'many';

  /** Whether the relationship is nullable */
  nullable?: boolean;

  /** Join type */
  joinType?: 'left' | 'inner';

  /** Whether this is an array foreign key relationship */
  isArray?: boolean;
}

/**
 * Relationship mapping configuration: maps column IDs to relationship paths.
 */
export interface RelationshipMap {
  [columnId: string]: RelationshipPath;
}

/**
 * A resolved column reference: either a direct column on the primary table,
 * or a column reached through a (possibly multi-hop) relationship path.
 */
export interface ColumnPath {
  /** Full column ID (e.g., "profile.bio") */
  columnId: string;

  /** Table name (e.g., "profile") */
  table: string;

  /** Field name (e.g., "bio") */
  field: string;

  /** Whether this is a nested (relationship) path */
  isNested: boolean;

  /** Relationship path to the table */
  relationshipPath?: RelationshipPath[];
}

/**
 * Primary key information for a table, generic over the adapter's own
 * column representation (e.g. a Drizzle `AnyColumn`).
 */
export interface PrimaryKeyInfo<TColumn = unknown> {
  /** The primary key column name */
  columnName: string;

  /** The primary key column object (ORM-specific, opaque to the toolkit) */
  column: TColumn;

  /** Whether this is a composite primary key */
  isComposite: boolean;
}

/**
 * Thrown when a schema cannot satisfy a request (e.g. an explicit primary
 * table that doesn't exist, or a schema with no tables at all).
 *
 * Toolkit-local error type: intentionally not part of any adapter's own
 * error hierarchy. Adapters that want a specific public error identity
 * should catch this and re-throw their own error type at the seam.
 */
export class SchemaError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SchemaError';
  }
}

/**
 * Minimal column-info shape the toolkit needs back from an adapter's own
 * schema introspection utilities — a name, and the adapter's opaque column
 * object (needed only by {@link PrimaryKeyInfo.column}; consumers that only
 * need existence/name checks can ignore `column`).
 */
export interface ColumnInfoLike<TColumn = unknown> {
  name: string;
  column: TColumn;
}

/**
 * Structural introspection port: given an adapter-specific table object,
 * report its foreign-key / primary-key / all column names. Implemented by
 * each adapter (e.g. Drizzle's `utils/drizzle-schema-utils.ts`) and passed
 * into toolkit primitives that need it (`getPrimaryKeyMap`, `DataTransformer`).
 */
export interface SchemaIntrospectionPort<TTable, TColumn = unknown> {
  getColumnNames(table: TTable): string[];
  getForeignKeyColumns(table: TTable): ColumnInfoLike<TColumn>[];
  getPrimaryKeyColumns(table: TTable): ColumnInfoLike<TColumn>[];
}

/**
 * A single column-level aggregation over a (possibly nested) relationship.
 */
export interface AggregateColumn {
  /** Column ID */
  columnId: string;

  /** Aggregate function */
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';

  /** Target field for aggregation */
  field: string;

  /** Relationship path to the field */
  relationshipPath: RelationshipPath[];
}

/**
 * Structural relationship-resolution port consumed by {@link DataTransformer}.
 * Implemented by each adapter's own relationship manager (e.g. Drizzle's
 * `RelationshipManager`, which satisfies this structurally with no changes).
 */
export interface RelationshipManagerPort {
  resolveColumnPath(columnId: string, primaryTable: string): ColumnPath;
  getRelationshipByAlias(primaryTable: string, alias: string): RelationshipPath | null;
  isArrayRelationship(relationshipPath: RelationshipPath[]): boolean;
}
