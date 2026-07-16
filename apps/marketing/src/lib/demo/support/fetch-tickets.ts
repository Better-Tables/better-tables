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
    // Table-scoped read (plan 030, findings 9 + 16): `primaryTable` is
    // injected from `ticketsTable` (no wrong-table hazard) and the result is
    // typed as the table's own inferred row -- no `as FetchDataResult<...>`
    // cast. `columns` still lists every renderable column so client-side
    // visibility toggling has the data without a refetch (relations touched
    // by filters/sorting auto-embed on their own -- finding 10).
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
