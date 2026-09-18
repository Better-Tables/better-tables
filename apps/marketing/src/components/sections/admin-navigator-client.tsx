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

/** `listTables` made non-optional — `httpAdapter` always defines it. */
type ListTablesAdapter = TableAdapter<Record<string, unknown>> & {
  listTables: NonNullable<TableAdapter<Record<string, unknown>>['listTables']>;
};

/** The two write actions, injectable so tests can pass fakes instead of `mock.module`-ing `admin-actions.ts` (which would leak into every other test file importing it). */
export interface AdminWriteActions {
  createSupportRecord: typeof createSupportRecord;
  updateSupportRecord: typeof updateSupportRecord;
}

const DEFAULT_WRITE_ACTIONS: AdminWriteActions = { createSupportRecord, updateSupportRecord };

/**
 * Compose the admin demo's adapter on top of a read adapter (normally
 * `httpAdapter(...)`, injected here so the composition itself — write
 * routing and facet neutralization — is unit-testable without a real HTTP
 * round-trip):
 *
 * - `createRecord`/`updateRecord` go straight to `admin-actions.ts`'s
 *   server actions (the real Drizzle adapter) instead of `httpAdapter`'s
 *   own write proxy — `cellEdit` (plan 055) is single-field-only, and
 *   `<RecordFormDialog>` sends a full record.
 * - Facet reads (`getFilterOptions`/`getFacetedValues`/`getMinMaxValues`/
 *   `getFacets`) carry a `columnId` but no table over the wire
 *   (`FacetQueryParams` has no table field) — the server can only guess
 *   which of this endpoint's several tables a column belongs to. Two
 *   support tables share a column name (`customers.name` /
 *   `assignees.name`), so that guess can resolve against the WRONG table
 *   and return facet options/counts for a different table than the one
 *   selected. Rather than risk silently wrong facets, neutralize them here:
 *   filters still work as plain manual entry (option columns already get
 *   their choices from the resolved column's schema-derived `options`, not
 *   from a facet read).
 */
export function composeAdminNavigatorAdapter(
  readAdapter: ListTablesAdapter,
  writeActions: AdminWriteActions = DEFAULT_WRITE_ACTIONS
): ListTablesAdapter {
  return {
    ...readAdapter,
    // Advertise what this COMPOSED adapter can actually do — the read
    // adapter's own default meta says update/create: false, since ITS
    // write proxy (cellEdit) is never opted into here; the two methods
    // below are real writes through server actions instead.
    meta: {
      ...readAdapter.meta,
      features: { ...readAdapter.meta.features, create: true, update: true },
    },
    async createRecord(data: Partial<Record<string, unknown>>, options?: MutationOptions) {
      return writeActions.createSupportRecord(options?.table ?? 'tickets', data);
    },
    async updateRecord(
      id: string,
      data: Partial<Record<string, unknown>>,
      options?: MutationOptions
    ) {
      return writeActions.updateSupportRecord(options?.table ?? 'tickets', id, data);
    },
    async getFilterOptions() {
      return [];
    },
    async getFacetedValues() {
      return new Map<string, number>();
    },
    async getMinMaxValues(): Promise<[number, number]> {
      return [0, 0];
    },
    async getFacets() {
      return { values: {}, ranges: {} };
    },
    listTables: readAdapter.listTables,
  };
}

export function AdminNavigatorClient() {
  const adapter = useMemo(
    () =>
      composeAdminNavigatorAdapter(
        httpAdapter<Record<string, unknown>>({
          url: '/api/tables/support-admin',
        }) as ListTablesAdapter
      ),
    []
  );

  return (
    <div className="h-160 rounded-lg border bg-card p-4 md:p-6">
      <TableNavigator adapter={adapter} overrides={OVERRIDES} className="h-full" />
    </div>
  );
}
