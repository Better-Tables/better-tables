/**
 * Shared request-surface allowlist for demo `/api/tables/*` adapters.
 *
 * Multi-table schemas need more than `createAdapterRouteHandler`'s
 * `primaryTable` pin — facet methods resolve the table from `columnId`, so
 * every referenced id must stay on the demo's column allowlist.
 */

import type { AdapterRequestBody, FilterGroupNode, FilterState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';

function collectFilterColumnIds(filters?: FilterState[] | FilterGroupNode): string[] {
  if (!filters) return [];
  if (isFilterGroupNode(filters)) {
    return flattenFilterNode(filters).map((filter) => filter.columnId);
  }
  return filters.map((filter) => filter.columnId);
}

/** Every column id referenced by an adapter request body. */
export function collectAdapterColumnIds(body: AdapterRequestBody): string[] {
  const ids: string[] = [];

  if (body.method === 'fetchData') {
    const { filters, sorting, columns } = body.params;
    ids.push(...collectFilterColumnIds(filters));
    if (sorting) {
      for (const sort of sorting) {
        ids.push(sort.columnId);
      }
    }
    if (columns) {
      ids.push(...columns);
    }
    return ids;
  }

  // describeColumns references no column ids — constrained via `table` instead.
  if (body.method === 'describeColumns') {
    return ids;
  }

  // listTables (plan 065) references no column ids and no table at all.
  if (body.method === 'listTables') {
    return ids;
  }

  if (body.method === 'resolveCellWriteTarget') {
    ids.push(body.columnId);
    return ids;
  }

  if (body.method === 'cellEdit') {
    ids.push(body.field);
    return ids;
  }

  // Batched facets: every requested column + any filter column ids.
  if (body.method === 'getFacets') {
    for (const request of body.requests) {
      ids.push(request.columnId);
    }
    ids.push(...collectFilterColumnIds(body.params?.filters));
    return ids;
  }

  // Facet / filter-option methods: target column + any filter column ids.
  ids.push(body.columnId);
  ids.push(...collectFilterColumnIds(body.params?.filters));
  return ids;
}

export interface DemoAdapterGuard {
  columnIds: ReadonlySet<string>;
  collectColumnIds: (body: AdapterRequestBody) => string[];
  isAllowed: (body: AdapterRequestBody) => boolean;
  constrain: (body: AdapterRequestBody) => AdapterRequestBody;
}

/**
 * Build an allowlist + table-pin guard for one demo adapter surface.
 *
 * @param tableName - Primary table pinned on fetchData / describeColumns /
 *   resolveCellWriteTarget (e.g. `'tickets'`, `'users'`).
 * @param columnIds - Allowlisted column ids (own + relation paths).
 */
export function createAdapterGuard(
  tableName: string,
  columnIds: ReadonlySet<string> | readonly string[]
): DemoAdapterGuard {
  const allowlist: ReadonlySet<string> = columnIds instanceof Set ? columnIds : new Set(columnIds);

  return {
    columnIds: allowlist,
    collectColumnIds: collectAdapterColumnIds,
    isAllowed(body) {
      return collectAdapterColumnIds(body).every((id) => allowlist.has(id));
    },
    constrain(body) {
      if (body.method === 'fetchData') {
        return {
          ...body,
          params: { ...body.params, primaryTable: tableName },
        };
      }
      if (body.method === 'describeColumns') {
        return { ...body, table: tableName };
      }
      if (body.method === 'resolveCellWriteTarget') {
        return { ...body, table: tableName };
      }
      return body;
    },
  };
}
