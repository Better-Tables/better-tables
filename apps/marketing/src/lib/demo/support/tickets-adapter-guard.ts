/**
 * Request-surface allowlist for `/api/tables/tickets`.
 *
 * The server adapter backs a multi-table schema (`customers`, `assignees`,
 * `tickets`, `bulkTickets`). Facet methods resolve the table from `columnId`,
 * so a bare id like `company` can still read distributions from `customers`.
 * This guard keeps every referenced column id on the tickets demo surface
 * defined by {@link allTicketColumnIds}.
 */

import type { AdapterRequestBody } from '@better-tables/core';
import { createAdapterGuard } from '@/lib/demo/adapter-guard';
import { allTicketColumnIds } from './columns';

const guard = createAdapterGuard('tickets', allTicketColumnIds);

export const TICKETS_DEMO_COLUMN_IDS = guard.columnIds;

export function collectTicketsAdapterColumnIds(body: AdapterRequestBody): string[] {
  return guard.collectColumnIds(body);
}

export function isAllowedTicketsAdapterRequest(body: AdapterRequestBody): boolean {
  return guard.isAllowed(body);
}

export function constrainTicketsAdapterRequest(body: AdapterRequestBody): AdapterRequestBody {
  return guard.constrain(body);
}
