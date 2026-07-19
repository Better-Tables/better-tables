import { defineTable } from '@better-tables/core';
import type { SupportTables } from './db';

const bulkStatusColors: Record<string, string> = {
  open: 'text-[#60A5FA]',
  pending: 'text-[#FBBF24]',
  resolved: 'text-[#5EEAD4]',
  escalated: 'text-destructive',
};

/**
 * Big-board table definition — same `betterTables()` instance as tickets,
 * different table (`bulkTickets`). Ordinary column config; pair with
 * `<BetterTable virtualized />` for windowed rendering.
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
