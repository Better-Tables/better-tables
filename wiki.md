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

Reference: `apps/marketing/src/lib/demo/support/columns.tsx`, `packages/core/src/builders/path-builders.ts`.

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

**Save resolution** (first match wins):

| Condition | Result |
|---|---|
| `editing={false}` on `<BetterTable>` | read-only |
| column has no `editable` / `when(row)` false | read-only |
| `onCellEdit` provided | callback save (required for `httpAdapter`) |
| adapter `features.update` + `updateRecord` + resolvable field + row id | adapter save |
| otherwise | read-only (+ one dev `console.warn` per column) |

Field mapping for adapter saves: `editable.field` if set; else the column id when it has no dot; dotted relationship ids are callback-only in v1.

Optimistic updates: the new value shows immediately; on save failure the cell rolls back and `onCellEditError` fires. Validation rules on the column run before any save.

**V1 editors**: text (+ email/url/phone), number (+ currency/percentage), option, boolean, date. `multiOption`/`json` stay read-only; `custom` needs `editable.editRenderer`. Edits are last-write-wins (no version checks).

```tsx
<BetterTable
  table={ticketsTable}
  data={rows}
  adapter={adapter}           // drizzle: uses updateRecord when features.update
  // onCellEdit={...}         // httpAdapter / custom persistence
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
