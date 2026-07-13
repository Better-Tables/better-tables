import type { SortingState } from '@better-tables/core';
import { bulkTicketColumnIds } from './bulk-columns';
import { getSupportTables } from './db';
import type { BulkTicket } from './schema';

export interface FetchBulkTicketsResult {
  data: BulkTicket[];
  total: number;
  sorting: SortingState;
  error: string | null;
}

/**
 * Fetches the ENTIRE big-board dataset in one request -- `<VirtualizedTable>`
 * (packages/ui) takes a flat `data: T[]` prop with no adapter/pagination
 * integration of its own (DX-FINDING-6), so windowing happens client-side
 * over the full array rather than page-by-page like the other three
 * examples.
 */
export async function fetchBulkTickets(sorting: SortingState = []): Promise<FetchBulkTicketsResult> {
  try {
    const supportTables = await getSupportTables();
    const result = await supportTables.database.fetchData({
      pagination: { page: 1, limit: 12_500 },
      sorting,
      primaryTable: 'bulkTickets',
      columns: bulkTicketColumnIds,
    });

    return {
      // DX-FINDING-16: `fetchData()` returns `FetchDataResult<unknown>`
      // regardless of which table it queried -- see
      // plans/findings/029-dx-findings.md #16.
      data: result.data as BulkTicket[],
      total: result.total,
      sorting,
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      total: 0,
      sorting,
      error: error instanceof Error ? error.message : 'Failed to load big-board data',
    };
  }
}
