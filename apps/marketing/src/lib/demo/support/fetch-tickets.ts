import type { FetchDataResult, FilterGroupNode, FilterState, SortingState } from '@better-tables/core';
import { flattenFilterNode, isFilterGroupNode } from '@better-tables/core';
import { allTicketColumnIds } from './columns';
import { getSupportTables } from './db';
import type { TicketWithRelations } from './schema';

export interface FetchTicketsParams {
  page?: number;
  limit?: number;
  filters?: FilterState[] | FilterGroupNode;
  sorting?: SortingState;
}

export interface FetchTicketsResult {
  result: FetchDataResult<TicketWithRelations>;
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
    const result = (await supportTables.database.fetchData({
      pagination: { page, limit },
      filters,
      sorting,
      // DX-FINDING-9: omitting `primaryTable` on this multi-table schema
      // silently returns `customers` rows (the first table in schema key
      // order) instead of tickets, with only a console.warn -- see
      // plans/findings/029-dx-findings.md #9.
      primaryTable: 'tickets',
      // DX-FINDING-10: a relation (customer/assignee) is silently ABSENT
      // from result rows unless its dot-path is named here, even though
      // filtering/sorting by it works without it -- see
      // plans/findings/029-dx-findings.md #10. Every column id is passed
      // (not just the default-visible ones) because column visibility
      // toggling is client-side only, with no refetch.
      columns: allTicketColumnIds,
    })) as FetchDataResult<TicketWithRelations>;

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
