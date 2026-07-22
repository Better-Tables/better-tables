/**
 * Collect derived column specs for fetch transport and enforce adapter
 * aggregate capabilities (plan 060).
 */

import type { AdapterMeta, FetchDataParams } from '../types/adapter';
import type { ColumnDefinition } from '../types/column';
import type { DerivedFetchSpec } from '../types/derived';
import type { FilterGroupNode, FilterNode, FilterState } from '../types/filter';
import type { SortingParams } from '../types/sorting';
import { isFilterGroupNode } from '../utils/type-guards';

/** Collect derived specs from column defs, optionally scoped to requested ids. */
export function collectDerivedFetchSpecs(
  columns: readonly ColumnDefinition[] | null | undefined,
  requestedColumnIds?: readonly string[]
): DerivedFetchSpec[] {
  if (columns == null || !Array.isArray(columns)) {
    return [];
  }
  // Runtime-guard: callers may pass a non-array at the JS boundary (types
  // only constrain `string[]`); treat non-arrays as "no column scope".
  const allow =
    requestedColumnIds == null || !Array.isArray(requestedColumnIds)
      ? null
      : new Set(requestedColumnIds.map(String));
  const specs: DerivedFetchSpec[] = [];
  for (const column of columns) {
    if (!column.derived) continue;
    if (allow != null && !allow.has(column.id)) continue;
    specs.push({ columnId: column.id, ...column.derived });
  }
  return specs;
}

function collectFilterColumnIds(filters: FilterState[] | FilterGroupNode | undefined): Set<string> {
  const ids = new Set<string>();
  if (filters == null) return ids;

  const walkNode = (node: FilterNode) => {
    if (isFilterGroupNode(node)) {
      for (const child of node.children) {
        walkNode(child);
      }
      return;
    }
    ids.add(node.columnId);
  };

  if (isFilterGroupNode(filters)) {
    walkNode(filters);
  } else {
    for (const leaf of filters) {
      walkNode(leaf);
    }
  }
  return ids;
}

/**
 * Throw if the adapter cannot satisfy the requested derived specs for the
 * operations implied by the fetch params.
 */
export function assertAggregateCapabilities(
  adapterMeta: AdapterMeta,
  derived: readonly DerivedFetchSpec[],
  params: Pick<FetchDataParams, 'filters' | 'sorting'>
): void {
  if (derived.length === 0) return;

  const aggregates = adapterMeta.capabilities?.aggregates;
  const adapterName = adapterMeta.name ?? 'adapter';

  if (!aggregates) {
    throw new Error(
      `[better-tables] Adapter '${adapterName}' does not declare capabilities.aggregates, ` +
        `but the table definition requests derived columns (${derived.map((d) => d.columnId).join(', ')}). ` +
        `Use an adapter that supports aggregates (e.g. drizzleAdapter, memoryAdapter), or remove t.count/t.aggregate columns.`
    );
  }

  if (!aggregates.render) {
    throw new Error(
      `[better-tables] Adapter '${adapterName}' declares aggregates.render=false; ` +
        `cannot fetch derived columns (${derived.map((d) => d.columnId).join(', ')}).`
    );
  }

  for (const spec of derived) {
    if (!aggregates.fns.includes(spec.fn)) {
      throw new Error(
        `[better-tables] Adapter '${adapterName}' does not support aggregate fn '${spec.fn}' ` +
          `(column '${spec.columnId}'). Supported: ${aggregates.fns.join(', ') || '(none)'}.`
      );
    }
  }

  const derivedIds = new Set(derived.map((d) => d.columnId));
  const filterIds = collectFilterColumnIds(params.filters);
  const needsFilter = [...filterIds].some((id) => derivedIds.has(id));
  if (needsFilter && !aggregates.filter) {
    throw new Error(
      `[better-tables] Adapter '${adapterName}' declares aggregates.filter=false; ` +
        `cannot filter on derived columns.`
    );
  }

  const sorts: SortingParams[] = params.sorting ?? [];
  const needsSort = sorts.some((s) => derivedIds.has(s.columnId));
  if (needsSort && !aggregates.sort) {
    throw new Error(
      `[better-tables] Adapter '${adapterName}' declares aggregates.sort=false; ` +
        `cannot sort on derived columns.`
    );
  }
}

/** Attach derived specs + enforce capabilities on fetch params. */
export function withDerivedFetchParams(
  columns: readonly ColumnDefinition[] | null | undefined,
  params: FetchDataParams,
  adapterMeta: AdapterMeta
): FetchDataParams {
  const derived = collectDerivedFetchSpecs(columns, params.columns);
  assertAggregateCapabilities(adapterMeta, derived, params);
  if (derived.length === 0) {
    return params;
  }
  return { ...params, derived };
}
