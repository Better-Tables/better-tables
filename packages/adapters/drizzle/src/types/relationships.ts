/**
 * @fileoverview Drizzle adapter type seam.
 */
import type { SQL, SQLWrapper } from 'drizzle-orm';
import type { AnyColumnType, AnyTableType } from './core';

/**
 * Relationship mapping configuration
 */
export interface RelationshipMap {
  /** Maps column IDs to relationship paths */
  [columnId: string]: RelationshipPath;
}

/**
 * Relationship path definition
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
 * Query context for tracking required joins and tables
 */
export interface QueryContext {
  /** Tables that need to be joined */
  requiredTables: Set<string>;

  /** Join paths to required tables */
  joinPaths: Map<string, RelationshipPath[]>;

  /** Columns being accessed */
  columns: Set<string>;

  /** Filters being applied */
  filters: Set<string>;

  /** Sort columns */
  sorts: Set<string>;
}

/**
 * Join configuration for query building
 */
export interface JoinConfig {
  /** Join type */
  type: 'left' | 'inner';

  /** Join condition */
  condition: SQL | SQLWrapper;

  /** Target table */
  table: AnyTableType;

  /** Alias for the joined table */
  alias?: string;
}

/**
 * Parsed column path
 */
export interface ColumnPath {
  /** Full column ID (e.g., "profile.bio") */
  columnId: string;

  /** Table name (e.g., "profile") */
  table: string;

  /** Field name (e.g., "bio") */
  field: string;

  /** Whether this is a nested path */
  isNested: boolean;

  /** Relationship path to the table */
  relationshipPath?: RelationshipPath[];
}

/**
 * Column reference for query building
 */
export interface ColumnReference {
  /** The actual Drizzle column object */
  column: AnyColumnType;
  /** Table alias for joins */
  tableAlias?: string;
  /** Whether this is a related table column */
  isRelated: boolean;
  /** Join path to reach this column */
  joinPath?: RelationshipPath[];
}

/**
 * Aggregate column configuration
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
 * Query result metadata
 */
export interface QueryMetadata {
  /** Query execution time in milliseconds */
  executionTime?: number;

  /** Number of joins used */
  joinCount?: number;

  /** Whether query was cached */
  cached?: boolean;

  /** Query SQL (if logging enabled) */
  sql?: string;
}
