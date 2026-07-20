/**
 * Request-surface allowlist for `/api/tables/users`.
 *
 * Mirrors the tickets demo guard: pin `primaryTable` / describeColumns and
 * allowlist column ids so clients cannot reach unrelated schema tables.
 */

import type { AdapterRequestBody, FilterGroupNode, FilterState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { allUserColumnIds } from './columns';

export const USERS_DEMO_COLUMN_IDS: ReadonlySet<string> = new Set(allUserColumnIds);

function collectFilterColumnIds(filters?: FilterState[] | FilterGroupNode): string[] {
  if (!filters) return [];
  if (isFilterGroupNode(filters)) {
    return flattenFilterNode(filters).map((filter) => filter.columnId);
  }
  return filters.map((filter) => filter.columnId);
}

/** Every column id referenced by an adapter request body. */
export function collectUsersAdapterColumnIds(body: AdapterRequestBody): string[] {
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

  if (body.method === 'describeColumns') {
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

  ids.push(body.columnId);
  ids.push(...collectFilterColumnIds(body.params?.filters));
  return ids;
}

export function isAllowedUsersAdapterRequest(body: AdapterRequestBody): boolean {
  return collectUsersAdapterColumnIds(body).every((id) => USERS_DEMO_COLUMN_IDS.has(id));
}

export function constrainUsersAdapterRequest(body: AdapterRequestBody): AdapterRequestBody {
  if (body.method === 'fetchData') {
    return {
      ...body,
      params: { ...body.params, primaryTable: 'users' },
    };
  }
  if (body.method === 'describeColumns') {
    return { ...body, table: 'users' };
  }
  if (body.method === 'resolveCellWriteTarget') {
    return { ...body, table: 'users' };
  }
  return body;
}
