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
 *
 * Since plan 054 this is also the `[...t.auto(), overrides]` showcase: the
 * spread pulls in every REMAINING own-table column from the adapter schema
 * at mount (`channel` -- whose dropdown options come straight from the DB
 * enum, no `.options()` anywhere -- plus `id`/`customerId`/`assigneeId`),
 * while the explicit entries below keep their richer config (`.editable()`,
 * cell renderers, relation paths -- relations stay explicit by design) and
 * always win by id. Inferred columns are read-only until explicitly
 * overridden.
 */
export const ticketsTable = defineTable<SupportTables>()('tickets', (t) => ({
  columns: [
    ...t.auto(),

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

    // `channel` is deliberately NOT declared: `t.auto()` infers it as an
    // option column with Email/Chat/Phone choices read from the DB enum --
    // the plan-054 "enum becomes a dropdown by itself" showcase. Same for
    // `reopenCount` (inferred number; the facets example's `getMinMaxValues`
    // showcase keeps working against the inferred column id).

    t
      .boolean('slaBreached')
      .displayName('SLA breached')
      .activeInactive({ activeText: 'Breached', inactiveText: 'On track', showBadges: true })
      .filterable()
      .editable(),

    // Numeric column used by the facets example's min/max range. Kept
    // EXPLICIT (not t.auto()-inferred) for the custom "Reopens" label —
    // explicit entries win by id, so the spread skips it.
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
      .sortable()
      // JOINED editing (plan 055): this edits the RELATED customer row —
      // the write target resolves through `resolveCellWriteTarget` and the
      // save lands in `customers.company` (every ticket of that customer
      // reflects it). Unassigned relations render read-only per row.
      .editable(),

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

/** Typed against `TicketRow` by construction -- no cast (finding 12).
 * NOTE: with `t.auto()` in play this is the EXPLICIT list only -- the
 * inferred columns materialize at mount via `resolveTableColumns` (BetterTable
 * does this itself when given an adapter). */
export const ticketColumns = ticketsTable.columns;

/**
 * The own-table columns `t.auto()` adds at mount, in schema order. Static
 * (not introspected) because two SERVER-side consumers need the full column
 * surface where resolving through an adapter would be circular or async:
 * the fetch column list and the API route's column-id allowlist
 * (tickets-adapter-guard). The RENDERED auto set still comes from
 * `describeColumns` at mount -- if this list drifts from the schema, the
 * symptom is an empty (fetch) or facet-blocked (guard) column, not a wrong
 * render.
 */
export const inferredTicketColumnIds = ['id', 'channel', 'customerId', 'assigneeId'];

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
 * -- but toggling reaches columns no filter mentions.) Includes the
 * `t.auto()`-inferred own-table columns for the same reason.
 */
export const allTicketColumnIds = [
  ...ticketColumns.map((column) => column.id),
  ...inferredTicketColumnIds,
];

export const relationshipColumnIds = new Set([
  'customer.company',
  'customer.plan',
  'customer.region',
  'assignee.name',
  'assignee.team',
  'assignee.shift',
]);
