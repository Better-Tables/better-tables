import { defineTable } from '@better-tables/core';
// See columns.tsx for why this is a type-only import (RSC-safe boundary --
// DX-FINDING-4).
import type { SupportTables } from './db';

/**
 * The `big-board` example's flagship table definition -- same
 * `betterTables()` instance as `ticketsTable` (columns.tsx), a different
 * table (`bulkTickets`). See plans/findings/029-dx-findings.md #6 for why
 * this table's columns are NOT rendered through `<BetterTable>`: the
 * virtualization example hand-builds around `<VirtualizedTable>` instead,
 * which only wants `id`/`displayName` per column, not the full filter/sort
 * builder chain -- these columns are `filterable()`/`sortable()` anyway so
 * the SAME definitions could back a `<BetterTable>` rendering later without
 * rework.
 */
export const bulkTicketsTable = defineTable<SupportTables>()('bulkTickets', (t) => ({
  columns: [
    t.text('subject').searchable().filterable().sortable(),
    t
      .option('status')
      .options([
        { value: 'open', label: 'Open' },
        { value: 'pending', label: 'Pending' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'escalated', label: 'Escalated' },
      ])
      .filterable()
      .sortable(),
    t
      .option('priority')
      .options([
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ])
      .filterable()
      .sortable(),
    t.text('customerName').displayName('Customer').filterable().sortable(),
    t.text('assigneeName').displayName('Assignee').filterable().sortable(),
    t.text('description').filterable(),
    t.date('createdAt').displayName('Opened').dateTime({ timeZone: 'America/New_York' }).sortable(),
  ],
}));

export const bulkTicketColumnIds = bulkTicketsTable.columns.map((column) => column.id);
