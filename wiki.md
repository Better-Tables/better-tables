# Better Tables 0.6 Handbook

Lean reference for the flagship API (`betterTables()` + `defineTable()` + `t.*` path builders). For upgrading from 0.5, see [MIGRATION.md](MIGRATION.md). Authoritative shipped examples live under `apps/marketing/src/lib/demo/support/`.

---

## Architecture Overview

Better Tables is a monorepo with clear layers:

| Package | Role |
|---------|------|
| `@better-tables/core` | Column builders, filter/sort/pagination managers, adapter contract types |
| `@better-tables/adapters-drizzle` | Turns column definitions + filter state into Drizzle queries (JOINs, filters, pagination) |
| `@better-tables/adapters-toolkit` | ORM-agnostic adapter machinery (for adapter authors) |
| `@better-tables/ui` | React table/filter components (copied into your app via CLI — not on npm) |
| `@better-tables/cli` | `better-tables init` copies UI source into your project |

**Data flow:** `defineTable()` column definitions → adapter executes queries → UI renders and manages client state, optionally synced to the URL.

```typescript
import { betterTables, defineTable } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

export const tables = betterTables({
  database: drizzleAdapter(db),
  defaults: { pageSize: 20 },
});

export const ticketsTable = defineTable<typeof tables>()('tickets', (t) => ({
  columns: [
    t.text('subject').searchable().filterable().sortable(),
    t.option('status').options([{ value: 'open', label: 'Open' }]).filterable(),
  ],
}));

const result = await tables.fetchData(ticketsTable, {
  pagination: { page: 1, limit: 20 },
});
```

See `packages/core/src/factory.ts` and `apps/marketing/src/lib/demo/support/db.ts`.

---

## Column Definition (Builder API)

0.6 columns are defined per table with `defineTable<typeof tables>()('tableName', (t) => ({ columns: [...] }))`. Path methods (`t.text('customer.company')`) derive accessors and display names from the schema catalog the adapter carries via `$types`.

```typescript
export const ticketsTable = defineTable<typeof tables>()('tickets', (t) => ({
  columns: [
    t.text('subject').searchable().filterable().sortable(),
    t.number('reopenCount').displayName('Reopens').filterable().sortable(),
    t.option('status').options([
      { value: 'open', label: 'Open' },
      { value: 'resolved', label: 'Resolved' },
    ]).filterable().sortable(),
    t.text('customer.company').displayName('Customer').searchable({ includeNull: true }),
    t.date('createdAt').displayName('Opened').dateTime({ timeZone: 'America/New_York' }),
    t.computed('summary', (row) => `${row.subject} (${row.status})`).displayName('Summary'),
  ],
}));

export type TicketRow = typeof ticketsTable.$infer.Row;
export const ticketColumns = ticketsTable.columns;
```

**Method form:** `tables.define('users', (t) => ({ columns: [...] }))`.

**Escape hatches:** `t.computed(id, accessor)`; `t.custom()` for the full fluent builder. Legacy column factories are deprecated — see MIGRATION.md.

### Auto columns (schema-driven)

The adapter already knows every column's name/type/nullability/enum values (`adapter.describeColumns`, implemented by the Drizzle adapter and proxied by `httpAdapter`). Two forms consume it:

```typescript
// Fully inferred: zero column boilerplate.
export const usersTable = tables.define('users'); // or defineTable<typeof tables>()('users')

// Inferred base + explicit overrides — explicit wins by id:
export const ticketsTable = defineTable<typeof tables>()('tickets', (t) => ({
  columns: [...t.auto(), t.text('subject').editable()],
}));
```

Resolution is **lazy, at mount**: `<BetterTable table={def} adapter={adapter} />` calls core's `resolveTableColumns(def, adapter)` before creating the table store (the curried `defineTable` form stays runtime-adapter-free/RSC-safe). Precedence rules:

- **Explicit wins by id**; order is explicit first, then inferred in stable schema order.
- **Enrichment is independent of `t.auto()`**: an explicit `t.option('status')` with no `.options()` gets its choices from the schema enum through the same resolver. Declared config always wins; enrichment only fills gaps. A declared type contradicting the schema type logs a dev warn.
- **`t.auto()`'s only job is column-SET inclusion** ("and the rest of the table's columns"). Auto-inclusion is never the default — declaring a subset is deliberate (schemas contain columns that must not silently render).
- **Inferred columns are read-only** (`sortable`/`filterable`/`hideable`, never `editable`) until explicitly overridden: `[...t.auto(), t.text('subject').editable()]`.
- Fully-declared tables skip resolution entirely (no async hop); an adapter without `describeColumns` degrades to the declared list with a dev warn. Own-table columns only — relations stay explicit.

Reference: `apps/marketing/src/lib/demo/support/columns.tsx`, `packages/core/src/builders/path-builders.ts`, `packages/core/src/factory.ts` (`resolveTableColumns`).

---

## Advanced Filtering System

Filters are typed `FilterState` objects (or nested `FilterGroupNode` trees for AND/OR). The UI reads column metadata from `defineTable()`; the adapter translates filters to SQL.

```typescript
import type { FilterState } from '@better-tables/core';

const filters: FilterState[] = [
  { columnId: 'status', type: 'option', operator: 'is', values: ['open'] },
  { columnId: 'customer.company', type: 'text', operator: 'contains', values: ['Acme'] },
];

await tables.fetchData(ticketsTable, { filters });
```

Supported types: `text`, `number`, `date`, `option`, `multiOption`, `boolean`. Relationship paths in `columnId` trigger JOIN generation in the Drizzle adapter. Client managers: `FilterManager`, `TableStateManager` in `packages/core/src/managers/`.

---

## Sorting

Sorting is `{ columnId, direction }[]` passed to `tables.fetchData()` or managed via `SortingManager`.

```typescript
await tables.fetchData(ticketsTable, {
  sorting: [
    { columnId: 'createdAt', direction: 'desc' },
    { columnId: 'subject', direction: 'asc' },
  ],
});
```

---

## Pagination

Pagination uses `{ page, limit }` (1-based page). Defaults from `betterTables({ defaults: { pageSize: 20 } })`.

```typescript
const result = await tables.fetchData(ticketsTable, {
  pagination: { page: 2, limit: 10 },
});
```

---

## Inline editing

Enable per-column with `.editable()` on the builder. Double-click (or Enter on a focused cell) opens a type-appropriate editor; Enter/blur commits; Escape cancels. Option/boolean/date editors commit on selection/toggle/day pick.

```typescript
t.text('subject').editable()
t.option('status').options([...]).editable()
t.boolean('slaBreached').editable({ when: (row) => row.status !== 'resolved' })
t.number('reopenCount').editable({ field: 'reopenCount' }) // field override when id ≠ storage key
```

**Persistence paths** (plan 055) — pick by deployment shape:

| # | Deployment | Wiring | Notes |
|---|---|---|---|
| 1 | **Monolith (RECOMMENDED, primary)** — Next.js, TanStack Start | `tables.cellEditAction(def)` exported through the framework's server boundary — a `'use server'` one-liner in Next (`export async function saveCell(input) { return tables.cellEditAction(def)(input); }`), `createServerFn` in TanStack Start — passed as `saveAction={saveCell}` | Zero boilerplate: the allow-list, per-type coercion, ValidationRules, and the write target all derive from the table definition. No API route, no fetch shim. |
| 2 | **Split frontend/backend** — ONLY for genuinely separated deployments | `httpAdapter({ url, writes: true })` + `writes` (ideally `{ columns }`) + `authorize` on `createAdapterRouteHandler` | Double opt-in on both sides; server validates fail-closed via schema introspection. See `packages/core/docs/HTTP_ADAPTER.md` → Writes. |
| 3 | **Full control** | `onCellEdit` callback | You own persistence entirely; wins over every other path. |

**Save resolution** (first match wins):

| Condition | Result |
|---|---|
| `editing={false}` on `<BetterTable>` | read-only |
| column has no `editable` / `when(row)` false | read-only |
| `onCellEdit` provided | callback save |
| `saveAction` provided | serializable action save (`{ id, field: columnId, value }` — Dates as ISO strings; the server-side policy re-resolves column → table/field, so the client can never redirect a write) |
| adapter `features.update` + `updateRecord` + resolvable target + row id | adapter save |
| otherwise | read-only (+ one dev `console.warn` per column) |

**Joined-table editing**: a relationship-path column (`t.text('customer.company').editable()`) edits the RELATED row — the write target resolves through the adapter's `resolveCellWriteTarget` (own table for flat ids, the real related table + `relatedIdPath` for dotted ids). One-to-many paths are never cell-editable (rejected at policy build); a null related object renders that row's cell read-only; `editable.field` on a dotted id still means "write THIS own-table field" (the plan-053 semantic). Row-level authorization stays the APP's concern (wrap the action / use `authorize`) — the policy gates columns and values, not rows.

Optimistic updates: the new value shows immediately; on save failure (including a `{ ok: false }` action result) the cell rolls back and `onCellEditError` fires. Validation rules on the column run before any save. Edits are last-write-wins — there is no conflict detection.

**V1 editors**: text (+ email/url/phone), number (+ currency/percentage), option, boolean, date. `multiOption`/`json` stay read-only; `custom` needs `editable.editRenderer`. Edits are last-write-wins (no version checks).

**Option choices auto-populate** (plan 054): the option editor (and the option filter input) resolve choices as declared `.options()` → schema enum values (enriched in by `resolveTableColumns`) → a lazy `adapter.getFilterOptions(columnId)` facet fetch on first open (cached per adapter+column). "No options" appears only when a fetch returns empty or fails.

```tsx
<BetterTable
  table={ticketsTable}
  data={rows}
  adapter={adapter}           // reads + write-target resolution (+ direct saves when features.update)
  saveAction={saveTicketCell} // monolith path: 'use server' wrapper over tables.cellEditAction
  // onCellEdit={...}         // full-control path
/>
```

---

## URL State Management

Sync table state to query parameters via a framework-agnostic adapter. Filters use compressed wire format (`c:` prefix); see `serializeFiltersToURL` / `deserializeFiltersFromURL` in core.

```typescript
import { useTableUrlSync } from '@better-tables/ui';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';

useTableUrlSync('tickets-table', { filters: true, pagination: true, sorting: true }, useNextjsUrlAdapter());
```

Details: `packages/ui/docs/URL_SYNC.md`, `apps/marketing/src/lib/nextjs-url-adapter.ts`.

---

## Next.js Integration

1. Define tables (lazy getter if native DB must not run during `next build` — see `apps/marketing/src/lib/demo/support/db.ts`).
2. Server-fetch with `tables.fetchData(table, params)`.
3. Copy UI via `bunx better-tables init`; pass `columns={table.columns}` to `<BetterTable />`.
4. Client URL sync with `useNextjsUrlAdapter()`.

```typescript
export default async function TicketsPage({ searchParams }) {
  const tables = await getSupportTables();
  const result = await tables.fetchData(ticketsTable, {
    pagination: { page: Number(searchParams.page ?? 1), limit: 10 },
  });
  return <TicketsTableClient rows={result.data} total={result.total} />;
}
```

HTTP adapter: `packages/core/docs/HTTP_ADAPTER.md`. Examples: `apps/marketing/src/app/(marketing)/examples/`.
