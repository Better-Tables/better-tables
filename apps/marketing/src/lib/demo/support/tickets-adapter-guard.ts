/**
 * Request-surface allowlist for `/api/tables/tickets`.
 *
 * The server adapter backs a multi-table schema (`customers`, `assignees`,
 * `tickets`, `bulkTickets`). `createAdapterRouteHandler` alone only pins
 * `primaryTable` for `fetchData` — facet methods (`getFacetedValues`,
 * `getMinMaxValues`, `getFilterOptions`) resolve the table from `columnId`,
 * so a bare id like `company` can still read distributions from
 * `customers`. This guard keeps every referenced column id on the tickets
 * demo surface defined by {@link allTicketColumnIds}.
 */

import type { AdapterRequestBody, FilterGroupNode, FilterState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { allTicketColumnIds } from './columns';

export const TICKETS_DEMO_COLUMN_IDS: ReadonlySet<string> = new Set(allTicketColumnIds);

function collectFilterColumnIds(filters?: FilterState[] | FilterGroupNode): string[] {
  if (!filters) return [];
  if (isFilterGroupNode(filters)) {
    return flattenFilterNode(filters).map((filter) => filter.columnId);
  }
  return filters.map((filter) => filter.columnId);
}

/** Every column id referenced by an adapter request body (facet target + filters/sort/columns). */
export function collectTicketsAdapterColumnIds(body: AdapterRequestBody): string[] {
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

  ids.push(body.columnId);
  ids.push(...collectFilterColumnIds(body.params?.filters));
  return ids;
}

/** True when every referenced column id is on the tickets demo surface. */
export function isAllowedTicketsAdapterRequest(body: AdapterRequestBody): boolean {
  return collectTicketsAdapterColumnIds(body).every((id) => TICKETS_DEMO_COLUMN_IDS.has(id));
}

/**
 * Pin `fetchData` to the tickets table. Facet methods are gated by
 * {@link isAllowedTicketsAdapterRequest} instead (column-id allowlist).
 */
export function constrainTicketsAdapterRequest(body: AdapterRequestBody): AdapterRequestBody {
  if (body.method === 'fetchData') {
    return {
      ...body,
      params: { ...body.params, primaryTable: 'tickets' },
    };
  }
  return body;
}
