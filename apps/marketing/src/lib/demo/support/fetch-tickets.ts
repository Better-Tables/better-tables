import type {
  FetchDataResult,
  FilterGroupNode,
  FilterState,
  SortingState,
} from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { allTicketColumnIds, type TicketRow, ticketsTable } from './columns';
import { getSupportTables } from './db';

export interface FetchTicketsParams {
  page?: number;
  limit?: number;
  filters?: FilterState[] | FilterGroupNode;
  sorting?: SortingState;
}

export interface FetchTicketsResult {
  result: FetchDataResult<TicketRow>;
  filters: FilterState[];
  sorting: SortingState;
  error: string | null;
}

function flattenFilters(filters?: FilterState[] | FilterGroupNode): FilterState[] {
  if (!filters) return [];
  if (isFilterGroupNode(filters)) return flattenFilterNode(filters);
  return filters;
}

export async function fetchTickets({
  page = 1,
  limit = 10,
  filters,
  sorting = [],
}: FetchTicketsParams): Promise<FetchTicketsResult> {
  const flatFilters = flattenFilters(filters);

  try {
    const supportTables = await getSupportTables();
    // Pass the table definition so the result is typed as `TicketRow`.
    // `columns` lists every renderable id so visibility toggles need no refetch.
    const result = await supportTables.fetchData(ticketsTable, {
      pagination: { page, limit },
      filters,
      sorting,
      columns: allTicketColumnIds,
    });

    return {
      result,
      filters: flatFilters,
      sorting,
      error: null,
    };
  } catch (error) {
    return {
      result: {
        data: [],
        total: 0,
        pagination: {
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
      filters: flatFilters,
      sorting,
      error: error instanceof Error ? error.message : 'Failed to load tickets',
    };
  }
}
