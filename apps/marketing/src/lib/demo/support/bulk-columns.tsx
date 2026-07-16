import { defineTable } from '@better-tables/core';
// See columns.tsx for why this is a type-only import (RSC-safe boundary).
import type { SupportTables } from './db';

const bulkStatusColors: Record<string, string> = {
  open: 'text-[#60A5FA]',
  pending: 'text-[#FBBF24]',
  resolved: 'text-[#5EEAD4]',
  escalated: 'text-destructive',
};

/**
 * The `big-board` example's table definition -- same `betterTables()` instance
 * as `ticketsTable` (columns.tsx), a different table (`bulkTickets`).
 *
 * These are ordinary column definitions: the big board renders them through
 * `<BetterTable ... virtualized />`, so the same `filterable()`/`sortable()`/
 * `.dateTime()` config drives the filter bar, the header sort UI, and cell
 * formatting over 12k windowed rows -- no separate component, no per-column
 * hand-rolled rendering.
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
      .sortable()
      .cellRenderer(({ value }) => (
        <span className={`font-mono text-xs uppercase ${bulkStatusColors[String(value)] ?? ''}`}>
          {String(value)}
        </span>
      )),
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
