'use client';

import type { MutationOptions, TableAdapter } from '@better-tables/core';
import { httpAdapter } from '@better-tables/core';
import { TableNavigator, type TableOverrides } from '@better-tables/ui';
import { useMemo } from 'react';
import { createSupportRecord, updateSupportRecord } from '@/lib/demo/support/admin-actions';

/**
 * Per-table overrides (plan 065 Phase 6) exercising all three kinds at once:
 * - `bulkTickets` hidden — a 12k-row denormalized table with no real
 *   relationships has no business in a relationship-aware admin browser.
 * - `assignees` read-only — a stand-in for "this table is managed by
 *   another system" (an HR roster, say), browsable but not editable here.
 * - `tickets` gets a renamed column label (`reopenCount` → "Reopens") and
 *   hides `slaBreached` from the grid entirely.
 */
const OVERRIDES: TableOverrides<Record<string, unknown>> = {
  bulkTickets: { hidden: true },
  assignees: { readOnly: true },
  tickets: {
    columnOverrides: [
      { id: 'reopenCount', displayName: 'Reopens' },
      { id: 'slaBreached', hidden: true },
    ],
  },
};

export function AdminNavigatorClient() {
  // httpAdapter proxies every READ (fetchData, describeColumns, listTables,
  // facets) over HTTP; createRecord/updateRecord are NOT proxied by
  // httpAdapter (plan 055's cellEdit write path is single-field only, and
  // <RecordFormDialog> sends a full record) — those two go straight to
  // server actions that call the real Drizzle adapter directly instead
  // (admin-actions.ts).
  const adapter = useMemo(() => {
    const http = httpAdapter<Record<string, unknown>>({ url: '/api/tables/support-admin' });
    return {
      ...http,
      // Advertise what this COMPOSED adapter can actually do — http's own
      // default meta says update/create: false, since ITS write proxy
      // (cellEdit) is never opted into here; the two methods below are
      // real writes through server actions instead.
      meta: { ...http.meta, features: { ...http.meta.features, create: true, update: true } },
      async createRecord(data: Partial<Record<string, unknown>>, options?: MutationOptions) {
        return createSupportRecord(options?.table ?? 'tickets', data);
      },
      async updateRecord(
        id: string,
        data: Partial<Record<string, unknown>>,
        options?: MutationOptions
      ) {
        return updateSupportRecord(options?.table ?? 'tickets', id, data);
      },
      // httpAdapter always defines listTables (it's an unconditional method
      // on the returned object) — the spread above just can't narrow that
      // from `TableAdapter`'s optional `listTables?` alone.
      listTables: http.listTables as NonNullable<
        TableAdapter<Record<string, unknown>>['listTables']
      >,
    } satisfies TableAdapter<Record<string, unknown>> & {
      listTables: NonNullable<TableAdapter<Record<string, unknown>>['listTables']>;
    };
  }, []);

  return (
    <div className="h-160 rounded-lg border bg-card p-4 md:p-6">
      <TableNavigator adapter={adapter} overrides={OVERRIDES} className="h-full" />
    </div>
  );
}
