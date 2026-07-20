/**
 * @fileoverview Table-reference extraction from opaque Drizzle SQL fragments
 * @module @better-tables/drizzle-adapter/utils/sql-table-refs
 *
 * @description
 * Computed-field `filterSql`/`sortSql` hand the adapter raw `SQL` fragments.
 * Their text is opaque, but the fragments are built from template literals
 * whose interpolations survive as typed query chunks — `Column` and `Table`
 * instances are still individually addressable inside `SQL.queryChunks`.
 * Walking the chunks recovers which tables a fragment touches, which is what
 * lets join planning treat these predicates like any other cross-table filter
 * instead of emitting SQL whose FROM clause is missing a table.
 */

import { Column, getTableName, is, SQL, Table } from 'drizzle-orm';

/**
 * Tables referenced by a set of SQL fragments, split by how they appear.
 */
export interface SqlTableRefs {
  /**
   * SQL table names referenced through interpolated `Column` chunks
   * (e.g. `sql`${profiles.bio} is not null`` contributes `profiles`).
   * These columns bind to the OUTER query scope, so their table must be
   * present in the outer FROM/JOIN list.
   */
  columnTableNames: Set<string>;

  /**
   * SQL table names interpolated as whole `Table` chunks (e.g.
   * `sql`exists (select 1 from ${profiles} where …)``). A table chunk means
   * the fragment supplies its own FROM scope for that table — a correlated
   * subquery — so the outer query must NOT be forced to join it (a LEFT JOIN
   * on a one-to-many relation would multiply rows the subquery never asked
   * for).
   */
  fromTableNames: Set<string>;
}

function walk(node: unknown, refs: SqlTableRefs, depth: number): void {
  // Cycle/degenerate-input guard; real predicates are a handful of levels deep.
  if (depth > 32 || node === null || node === undefined) {
    return;
  }

  if (is(node, Column)) {
    refs.columnTableNames.add(getTableName(node.table));
    return;
  }

  if (is(node, Table)) {
    refs.fromTableNames.add(getTableName(node));
    return;
  }

  if (is(node, SQL.Aliased)) {
    walk(node.sql, refs, depth + 1);
    return;
  }

  if (is(node, SQL)) {
    for (const chunk of node.queryChunks) {
      walk(chunk, refs, depth + 1);
    }
    return;
  }

  // Any other SQLWrapper (subquery wrappers, views, …): unwrap via getSQL().
  const wrapper = node as { getSQL?: () => unknown };
  if (typeof wrapper.getSQL === 'function') {
    walk(wrapper.getSQL(), refs, depth + 1);
  }
}

/**
 * Collect the tables referenced by a set of opaque SQL fragments.
 *
 * String content is never parsed — only interpolated Drizzle entities count,
 * so a fragment written entirely with raw identifier strings contributes
 * nothing (and correctly so: nothing in it can bind to Drizzle's join
 * planner either).
 *
 * Scope semantics are PER CALL: `fromTableNames` marks a table as
 * self-scoped for everything passed in this invocation. Callers deciding
 * join exemption per fragment (join planning does — one fragment's
 * correlated subquery must not exempt another fragment's bare column
 * reference) must call this once per fragment rather than batching.
 */
export function collectSqlTableRefs(nodes: readonly unknown[]): SqlTableRefs {
  const refs: SqlTableRefs = {
    columnTableNames: new Set(),
    fromTableNames: new Set(),
  };

  for (const node of nodes) {
    walk(node, refs, 0);
  }

  return refs;
}
