import { defineTable } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
// Type-only import keeps the SQLite driver out of any client bundle that
// pulls in this table definition.
import type { SupportTables } from './db';

const statusColors: Record<string, string> = {
  open: 'border-[#60A5FA]/40 text-[#60A5FA]',
  pending: 'border-[#FBBF24]/40 text-[#FBBF24]',
  resolved: 'border-[#5EEAD4]/40 text-[#5EEAD4]',
  escalated: 'border-destructive/40 text-destructive',
};

const priorityColors: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-foreground',
  high: 'text-[#FBBF24]',
  urgent: 'text-destructive',
};

/**
 * Table definition for the support-tickets examples.
 *
 * `defineTable<SupportTables>()` types the table name and every column path
 * (including relation paths like `customer.plan`) from your schema — typos
 * are compile errors.
 */
export const ticketsTable = defineTable<SupportTables>()('tickets', (t) => ({
  columns: [
    t.text('subject').searchable().filterable().sortable().editable(),

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
      .editable()
      .cellRenderer(({ value }) => (
        <Badge variant="outline" className={statusColors[value] ?? ''}>
          {value}
        </Badge>
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
      .sortable()
      .cellRenderer(({ value }) => (
        <span className={`font-mono text-xs uppercase ${priorityColors[value] ?? ''}`}>
          {value}
        </span>
      )),

    t
      .option('channel')
      .options([
        { value: 'email', label: 'Email' },
        { value: 'chat', label: 'Chat' },
        { value: 'phone', label: 'Phone' },
      ])
      .filterable()
      .sortable(),

    t
      .boolean('slaBreached')
      .displayName('SLA breached')
      .activeInactive({ activeText: 'Breached', inactiveText: 'On track', showBadges: true })
      .filterable()
      .editable(),

    // Numeric column used by the facets example's min/max range.
    t
      .number('reopenCount')
      .displayName('Reopens')
      .filterable()
      .sortable(),

    t
      .text('customer.company')
      .displayName('Customer')
      .searchable({ includeNull: true })
      .filterable()
      .sortable(),

    t
      .option('customer.plan')
      .displayName('Customer plan')
      .options([
        { value: 'starter', label: 'Starter' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'Enterprise' },
      ])
      .filterable()
      .sortable(),

    t
      .option('customer.region')
      .displayName('Customer region')
      .options([
        { value: 'na', label: 'North America' },
        { value: 'emea', label: 'EMEA' },
        { value: 'apac', label: 'APAC' },
      ])
      .filterable()
      .sortable(),

    t
      .text('assignee.name')
      .displayName('Assignee')
      .searchable({ includeNull: true })
      .filterable()
      .sortable(),

    t
      .option('assignee.team')
      .displayName('Assignee team')
      .options([
        { value: 'tier1', label: 'Tier 1' },
        { value: 'tier2', label: 'Tier 2' },
        { value: 'escalation', label: 'Escalation' },
      ])
      .filterable()
      .sortable(),

    t
      .option('assignee.shift')
      .displayName('Assignee shift')
      .options([
        { value: 'day', label: 'Day' },
        { value: 'night', label: 'Night' },
      ])
      .filterable(),

    // `.dateTime()` defaults to UTC; set `timeZone` when you want a local zone.
    t
      .date('createdAt')
      .displayName('Opened')
      .dateTime({ timeZone: 'America/New_York' })
      .filterable()
      .sortable()
      .editable(),
  ],
}));

/** Row type inferred from the table definition — includes related `customer` / `assignee`. */
export type TicketRow = typeof ticketsTable.$infer.Row;

export const ticketColumns = ticketsTable.columns;

export const defaultVisibleTicketColumns = [
  'subject',
  'status',
  'priority',
  'customer.company',
  'customer.plan',
  'assignee.name',
  'assignee.team',
  'slaBreached',
  'createdAt',
];

/**
 * All column ids (not only the default-visible subset). Column visibility is
 * client-side, so hidden-but-toggleable columns still need data in the fetch.
 */
export const allTicketColumnIds = ticketColumns.map((column) => column.id);

export const relationshipColumnIds = new Set([
  'customer.company',
  'customer.plan',
  'customer.region',
  'assignee.name',
  'assignee.team',
  'assignee.shift',
]);
