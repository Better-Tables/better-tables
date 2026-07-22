/**
 * Lower plan-060 `FetchDataParams.derived` specs into the existing
 * `ComputedFieldConfig` pipeline (correlated subqueries for SELECT/WHERE/ORDER BY).
 */

import type { DerivedFetchSpec, FilterState } from '@better-tables/core';
import { getTableName, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import type { RelationshipManager } from './relationship-manager';
import type {
  AnyColumnType,
  AnyTableType,
  ComputedFieldConfig,
  ComputedFieldContext,
} from './types';
import { SchemaError } from './types';
import { getColumnInfo } from './utils/drizzle-schema-utils';

function resolveColumn(table: AnyTableType, fieldName: string, tableKey: string): AnyColumnType {
  const info = getColumnInfo(table, fieldName);
  if (!info) {
    throw new SchemaError(
      `Column '${fieldName}' not found on table '${tableKey}' for derived aggregate.`,
      { table: tableKey, field: fieldName }
    );
  }
  return info.column;
}

function qualifiedColumn(table: AnyTableType, column: AnyColumnType): SQL {
  // Unqualified column names inside a correlated subquery bind to the INNER
  // FROM (e.g. posts.id), breaking correlation to the outer primary key.
  // Always emit "table"."column" from schema metadata — never client strings.
  return sql`${sql.identifier(getTableName(table))}.${sql.identifier(column.name)}`;
}

function aggregateExpression(
  fn: DerivedFetchSpec['fn'],
  relatedTable: AnyTableType,
  fieldColumn: AnyColumnType | undefined
): SQL {
  if (fn === 'count' || fieldColumn == null) {
    return sql`count(*)`;
  }
  const field = qualifiedColumn(relatedTable, fieldColumn);
  switch (fn) {
    case 'sum':
      return sql`coalesce(sum(${field}), 0)`;
    case 'avg':
      return sql`coalesce(avg(${field}), 0)`;
    case 'min':
      return sql`min(${field})`;
    case 'max':
      return sql`max(${field})`;
    default:
      return sql`count(*)`;
  }
}

function compareSubquery(subquery: SQL, filter: FilterState): SQL | SQLWrapper {
  const values = filter.values ?? [];
  const n0 = Number(values[0]);
  const n1 = Number(values[1]);

  switch (filter.operator) {
    case 'equals':
    case 'is':
      return sql`(${subquery}) = ${n0}`;
    case 'notEquals':
    case 'isNot':
      return sql`(${subquery}) <> ${n0}`;
    case 'greaterThan':
      return sql`(${subquery}) > ${n0}`;
    case 'greaterThanOrEqual':
      return sql`(${subquery}) >= ${n0}`;
    case 'lessThan':
      return sql`(${subquery}) < ${n0}`;
    case 'lessThanOrEqual':
      return sql`(${subquery}) <= ${n0}`;
    case 'between':
      return sql`(${subquery}) BETWEEN ${n0} AND ${n1}`;
    case 'notBetween':
      return sql`(${subquery}) NOT BETWEEN ${n0} AND ${n1}`;
    case 'isNull':
      return sql`(${subquery}) IS NULL`;
    case 'isNotNull':
      return sql`(${subquery}) IS NOT NULL`;
    default:
      throw new SchemaError(
        `Unsupported operator '${filter.operator}' for derived aggregate column '${filter.columnId}'.`,
        { columnId: filter.columnId, operator: filter.operator }
      );
  }
}

/**
 * Validate a derived aggregate spec against the relationship map and build a
 * `ComputedFieldConfig` that reuses filterSql/sortSql correlated subqueries.
 */
export function lowerDerivedAggregateSpec(
  spec: DerivedFetchSpec,
  primaryTable: string,
  schema: Record<string, AnyTableType>,
  relationshipManager: RelationshipManager
): ComputedFieldConfig {
  const relationship = relationshipManager.getRelationshipByAlias(primaryTable, spec.relation);
  if (!relationship) {
    const available = Object.keys(relationshipManager.getRelationships())
      .filter((key) => key.startsWith(`${primaryTable}.`))
      .map((key) => key.slice(primaryTable.length + 1));
    throw new SchemaError(
      `Unknown relation '${spec.relation}' on table '${primaryTable}' for derived column '${spec.columnId}'.` +
        (available.length > 0 ? ` Available relations: ${available.join(', ')}.` : ''),
      { primaryTable, relation: spec.relation, columnId: spec.columnId, available }
    );
  }

  if (relationship.cardinality !== 'many') {
    throw new SchemaError(
      `Derived aggregates require a many-relation; '${spec.relation}' on '${primaryTable}' is '${relationship.cardinality}'.`,
      { primaryTable, relation: spec.relation, cardinality: relationship.cardinality }
    );
  }

  if (!relationship.localKey || !relationship.foreignKey) {
    throw new SchemaError(
      `Relation '${spec.relation}' on '${primaryTable}' is missing join keys (localKey/foreignKey) needed for a correlated aggregate subquery.`,
      { primaryTable, relation: spec.relation, relationship }
    );
  }

  const primaryTableSchema = schema[primaryTable];
  const relatedTableSchema = schema[relationship.to];
  if (!primaryTableSchema || !relatedTableSchema) {
    throw new SchemaError(
      `Schema tables missing for derived aggregate '${spec.columnId}' (primary='${primaryTable}', related='${relationship.to}').`,
      { primaryTable, related: relationship.to }
    );
  }

  const localColumn = resolveColumn(primaryTableSchema, relationship.localKey, primaryTable);
  const foreignColumn = resolveColumn(relatedTableSchema, relationship.foreignKey, relationship.to);

  let fieldColumn: AnyColumnType | undefined;
  if (spec.fn !== 'count') {
    if (!spec.field) {
      throw new SchemaError(
        `Derived aggregate '${spec.columnId}' with fn '${spec.fn}' requires a 'field'.`,
        { columnId: spec.columnId, fn: spec.fn }
      );
    }
    fieldColumn = resolveColumn(relatedTableSchema, spec.field, relationship.to);
    const dataType = getColumnInfo(relatedTableSchema, spec.field)?.dataType ?? '';
    if (dataType && !/number|int|numeric|decimal|real|double|float/i.test(dataType)) {
      throw new SchemaError(
        `Derived aggregate field '${spec.field}' on '${relationship.to}' must be numeric (got '${dataType}').`,
        { field: spec.field, dataType, table: relationship.to }
      );
    }
  }

  const buildSubquery = (): SQL => {
    const agg = aggregateExpression(spec.fn, relatedTableSchema, fieldColumn);
    // Interpolate the related table as a Table chunk so join planning treats
    // this as a correlated subquery (no outer one-to-many LEFT JOIN). Qualify
    // both sides of the join predicate so the outer PK is not shadowed by an
    // inner column of the same name (SQLite binds bare "id" to posts.id).
    return sql`(select ${agg} from ${relatedTableSchema} where ${qualifiedColumn(relatedTableSchema, foreignColumn)} = ${qualifiedColumn(primaryTableSchema, localColumn)})`;
  };

  return {
    field: spec.columnId,
    type: 'number',
    includeByDefault: false,
    compute: (row) => {
      const value = (row as Record<string, unknown>)[spec.columnId];
      return typeof value === 'number' ? value : Number(value ?? 0);
    },
    sortSql: () => buildSubquery(),
    filterSql: (filter, _context: ComputedFieldContext) => compareSubquery(buildSubquery(), filter),
  };
}

/** Lower every derived fetch spec for a primary table into computed-field configs. */
export function lowerDerivedAggregateSpecs(
  specs: readonly DerivedFetchSpec[] | undefined,
  primaryTable: string,
  schema: Record<string, AnyTableType>,
  relationshipManager: RelationshipManager
): ComputedFieldConfig[] {
  if (!specs || specs.length === 0) return [];
  return specs.map((spec) =>
    lowerDerivedAggregateSpec(spec, primaryTable, schema, relationshipManager)
  );
}
