import { defineTable } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
// `import type` only -- the RSC-safe pattern MIGRATION.md documents.
// `defineTable` has no DB-driver dependency, so importing just the instance's
// TYPE (`SupportTables`, exported by `./db` alongside its lazy runtime getter)
// keeps `better-sqlite3` out of any client bundle that imports THIS file.
// Verified via `bun run build --filter=@better-tables/site`.
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
 * The flagship 018 entry point: `defineTable<SupportTables>()(...)`
 * derives `'tickets'` and every column path (including dot-notation
 * relation paths like `'customer.plan'`) from the REAL schema `supportTables`
 * carries via `$types` -- a typo'd path or table name is a compile error
 * here, not a runtime throw (see plans/findings/029-dx-findings.md #4 for
 * why the WIP didn't start here).
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

    // Direct numeric column -- the `facets` example's `getMinMaxValues`
    // showcase needs one.
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
      .sortable()
      .editable(),
  ],
}));

/**
 * The ticket row type, derived straight from the SCHEMA -- there is no
 * hand-shaped duplicate to keep in sync. `$infer.Row` now carries the forward
 * relations (`customer`, `assignee`) as a clean intersection and omits inverse
 * back-references, so it IS the shape a fetch actually returns (plan 030,
 * finding 12).
 */
export type TicketRow = typeof ticketsTable.$infer.Row;

/** Typed against `TicketRow` by construction -- no cast (finding 12). */
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
 * Every column id the table can render, not just the default-visible subset:
 * column visibility toggling is client-side (no refetch), so a
 * hidden-but-toggleable column still needs its data in the initial fetch.
 * (Relations touched by filters/sorting auto-embed on their own -- finding 10
 * -- but toggling reaches columns no filter mentions.)
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
