import type { ColumnDefinition } from '@better-tables/core';
import { defineTable } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
// DX-FINDING-4: `import type` only -- this is the RSC-safe pattern
// MIGRATION.md documents (`factory.ts`'s doc comment): `defineTable` itself
// has no DB-driver dependency, so a type-only import of the flagship
// instance's TYPE (`SupportTables`, exported by `./db` alongside its lazy
// runtime getter -- see DX-FINDING-13) keeps that driver out of any client
// bundle that imports THIS file. Verified end to end via
// `bun run build --filter=@better-tables/site` -- see
// plans/findings/029-dx-findings.md #4.
import type { SupportTables } from './db';
import type { TicketWithRelations } from './schema';

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
 * The flagship 018 entry point: `defineTable<SupportTables>()(...)`
 * derives `'tickets'` and every column path (including dot-notation
 * relation paths like `'customer.plan'`) from the REAL schema `supportTables`
 * carries via `$types` -- a typo'd path or table name is a compile error
 * here, not a runtime throw (see plans/findings/029-dx-findings.md #4 for
 * why the WIP didn't start here).
 */
export const ticketsTable = defineTable<SupportTables>()('tickets', (t) => ({
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
        <span className={`font-mono text-xs uppercase ${priorityColors[value] ?? ''}`}>{value}</span>
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
      .filterable(),

    t.text('customer.company').displayName('Customer').searchable({ includeNull: true }).filterable().sortable(),

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

    t.text('assignee.name').displayName('Assignee').searchable({ includeNull: true }).filterable().sortable(),

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

    // 028 showcase: an explicit, non-UTC `timeZone` on `.dateTime()` -- per
    // MIGRATION.md §11, `.dateTime()`/`.format()`/`.timeOnly()` default to
    // `'UTC'` when `timeZone` is omitted (a behavior change from 0.5's
    // silently-ignored `timeZone`), so this column deliberately sets one to
    // demonstrate the real conversion rather than relying on the default.
    t
      .date('createdAt')
      .displayName('Opened')
      .dateTime({ timeZone: 'America/New_York' })
      .filterable()
      .sortable(),
  ],
}));

/**
 * DX-FINDING-12: `ticketsTable.columns` is typed against the SCHEMA-DERIVED
 * `RowOf<typeof supportTables, 'tickets'>` (via `$infer`/`RelationAwareRow`,
 * default depth 3) -- which, for a two-way relation
 * (`tickets -> customer -> tickets -> ...`), recurses into a back-reference
 * (`customer.tickets: Ticket[]`) that the app never actually requests via
 * `columns` (`fetch-tickets.ts` only asks for `customer.plan`/`.company`/
 * `.region`, not the customer's own ticket list) and produces a nested
 * union type incompatible with the app's own hand-shaped `TicketWithRelations`
 * (`customer?: SupportCustomer | null`). The schema-derived type describes
 * "everything reachable," not "what THIS query actually returns" -- there is
 * no way to narrow `$infer.Row` to the shape a specific `columns` selection
 * produces. See plans/findings/029-dx-findings.md #12.
 */
export const ticketColumns = ticketsTable.columns as unknown as ColumnDefinition<
  TicketWithRelations,
  unknown
>[];

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
 * DX-FINDING-10: every column id the table can render, not just the
 * default-visible subset -- column visibility toggling is client-side only
 * (no refetch), and relation data (customer/assignee) is silently absent
 * from `fetchData()` results unless its dot-path is named in `columns`. See
 * plans/findings/029-dx-findings.md #10.
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
