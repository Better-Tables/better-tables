import type { FilterGroupNode, FilterState, SortingState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { bulkTicketColumnIds, bulkTicketsTable } from './bulk-columns';
import { getSupportTables } from './db';

/** Big-board row type, inferred from the table definition. */
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
 * Fetch every matching big-board row in one request. The client windows them
 * with `<BetterTable virtualized />`; filtering/sorting still run in the DB.
 */
export async function fetchBulkTickets({
  filters,
  sorting = [],
}: FetchBulkTicketsParams = {}): Promise<FetchBulkTicketsResult> {
  const flatFilters = flattenFilters(filters);

  try {
    const supportTables = await getSupportTables();
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
