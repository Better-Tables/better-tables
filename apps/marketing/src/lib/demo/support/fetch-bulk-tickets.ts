import type { FilterGroupNode, FilterState, SortingState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { bulkTicketColumnIds, bulkTicketsTable } from './bulk-columns';
import { getSupportTables } from './db';

/** The big-board row, derived from the table definition -- no hand-shaped duplicate. */
export type BulkTicketRow = typeof bulkTicketsTable.$infer.Row;

export interface FetchBulkTicketsParams {
  filters?: FilterState[] | FilterGroupNode;
  sorting?: SortingState;
}

export interface FetchBulkTicketsResult {
  data: BulkTicketRow[];
  total: number;
  filters: FilterState[];
  sorting: SortingState;
  error: string | null;
}

function flattenFilters(filters?: FilterState[] | FilterGroupNode): FilterState[] {
  if (!filters) return [];
  if (isFilterGroupNode(filters)) return flattenFilterNode(filters);
  return filters;
}

/**
 * Fetches every MATCHING big-board row in one request. `<BetterTable virtualized />`
 * windows the rows it renders, so there's no page-by-page UI here -- filtering and
 * sorting still run in the database, driven by the table's own filter bar and header
 * through the URL.
 */
export async function fetchBulkTickets({
  filters,
  sorting = [],
}: FetchBulkTicketsParams = {}): Promise<FetchBulkTicketsResult> {
  const flatFilters = flattenFilters(filters);

  try {
    const supportTables = await getSupportTables();
    // Table-scoped: `primaryTable` comes from `bulkTicketsTable`, and the rows
    // are typed as that table's own row -- no cast (findings 9 + 16).
    const result = await supportTables.fetchData(bulkTicketsTable, {
      pagination: { page: 1, limit: 12_500 },
      filters,
      sorting,
      columns: bulkTicketColumnIds,
    });

    return {
      data: result.data,
      total: result.total,
      filters: flatFilters,
      sorting,
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      total: 0,
      filters: flatFilters,
      sorting,
      error: error instanceof Error ? error.message : 'Failed to load big-board data',
    };
  }
}
