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
 *
 * Since plan 054 this is also the `[...t.auto(), overrides]` showcase: the
 * spread pulls in every REMAINING own-table column from the adapter schema
 * at mount (`channel` -- whose dropdown options come straight from the DB
 * enum, no `.options()` anywhere -- plus `id`/`customerId`/`assigneeId`/
 * `reopenCount`), while the explicit entries below keep their richer config
 * (`.editable()`, cell renderers, relation paths -- relations stay explicit
 * by design) and always win by id. Inferred columns are read-only until
 * explicitly overridden.
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
export const inferredTicketColumnIds = ['id', 'channel', 'customerId', 'assigneeId', 'reopenCount'];

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
