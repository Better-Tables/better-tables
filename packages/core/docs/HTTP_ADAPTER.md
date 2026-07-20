# HTTP adapter

> **Canonical docs:** [better-tables.com/docs/adapters/http](https://better-tables.com/docs/adapters/http)
> (source: `apps/marketing/content/docs/adapters/http.mdx`). This file is a
> package-local mirror for readers browsing the repo.

Pair a browser-safe `httpAdapter` client with a server
`createAdapterRouteHandler` so client components can call a server-only
adapter (e.g. Drizzle wrapping `better-sqlite3`) without hand-rolling fetch
plumbing.

## Safe Next.js app-router mount

```ts
// app/api/tables/tickets/route.ts
import { createAdapterRouteHandler } from '@better-tables/core';
import { getTicketsAdapter } from '@/lib/tickets';

export const POST = createAdapterRouteHandler(() => getTicketsAdapter(), {
  authorize: async (request) => {
    // return false → 403; or return a custom Response (e.g. 401)
    return true;
  },
  constrainRequest: (body) =>
    body.method === 'fetchData'
      ? { ...body, params: { ...body.params, primaryTable: 'tickets' } }
      : body,
  onError: (error) => console.error('[api/tables/tickets]', error),
});
```

```ts
// client
import { httpAdapter } from '@better-tables/core';

const adapter = httpAdapter({ url: '/api/tables/tickets' });
```

> **Warning:** a bare `createAdapterRouteHandler(adapter)` exposes the entire
> read surface of the adapter's schema, unauthenticated. Always pin
> `primaryTable` (and usually add `authorize`) for multi-table adapters.

## Wire contract

| Concern | Behavior |
|---|---|
| Maps | `getFacetedValues` and `fetchData.faceted` travel as `[value, count][]` entries; the client rebuilds `Map`s |
| Dates | JSON serializes `Date` filter/row values as ISO strings; server emitters parse ISO |
| AbortSignal | Never serialized; client uses it to cancel the underlying `fetch` (including facet reads) |
| Mutations | Not proxied by default — `cellEdit` (single-cell update) is available behind DOUBLE opt-in (see Writes) |

## Writes (opt-in, plan 055)

> Only for genuinely separated frontend/backend deployments. In a monolith
> (Next.js, TanStack Start) use `tables.cellEditAction(def)` through your
> framework's server boundary instead — no endpoint, no proxy.

Writes are **disabled by default** and require opting in on BOTH sides:

```ts
// server — narrow to the columns your app actually makes editable
export const POST = createAdapterRouteHandler(() => getTicketsAdapter(), {
  authorize: async (request) => isAllowedToEdit(request), // REQUIRED in practice
  writes: { columns: ['subject', 'status', 'customer.company'] },
});

// client
const adapter = httpAdapter({ url: '/api/tables/tickets', writes: true });
// -> implements updateRecord (single field per call) and advertises
//    meta.features.update; the editable UI's adapter save path lights up.
```

Rules the handler enforces:

- **Double opt-in.** Without `writes` on the handler, `cellEdit` → 403
  (`kind: 'forbidden'`) and the adapter is never called. Without
  `writes: true` on `httpAdapter`, the client shape stays read-only
  (no `updateRecord`, `features.update: false`).
- **Fail closed.** The server validates every write via the adapter's own
  schema introspection (`resolveCellWriteTarget` + `describeColumns`):
  column → (table, field) is re-resolved server-side and the value is
  coerced by the column's schema type. An adapter without those
  capabilities rejects all writes — the client is never trusted.
- **`{ columns }` narrowing is RECOMMENDED.** `writes: true` alone allows
  any schema-writable column; the handler has no `TableDefinition`, so
  schema-writable is broader than what your app actually marks
  `.editable()`. Pass the explicit column list.
- **`{ columns }` entries are pinned to your default table.** A bare column
  id (e.g. `'subject'`) only means one thing: the field on whichever table
  `resolveCellWriteTarget` resolves to when `table` is OMITTED. A request
  that supplies a different `table` for that same column id is rejected —
  even if that other table independently has a writable column sharing the
  same name — so a client can never redirect an allow-listed column id to a
  table you didn't intend to expose. If your endpoint genuinely serves
  several primary tables, pin `table` yourself via `constrainRequest` (the
  same pattern the `primaryTable` warning above recommends for reads) —
  don't rely on client-supplied `table` for `cellEdit` either.
- **`authorize` runs before the write.** Enabling writes without
  `authorize` logs a dev warning at handler creation — row-level
  authorization is the app's concern.
- The wire shape is cell-oriented and singular
  (`{ id, field: columnId, value }`) — never a free-form data record.
  Relationship-path columns (`'customer.company'`) write the RELATED table
  after server-side re-resolution; `id` is the related row's id.

## Status semantics

| Situation | HTTP | Envelope |
|---|---|---|
| Success | 200 | `{ ok: true, result }` |
| Malformed body / authorize `false` | 400 / 403 | `{ ok: false, error, kind: 'bad_request' }` |
| `cellEdit` with writes disabled | 403 | `{ ok: false, error, kind: 'forbidden' }` |
| Unknown/unwritable column, failed coercion, narrowing miss | 400 | `{ ok: false, error, kind: 'bad_request' }` |
| Adapter / DB throw | 500 | `{ ok: false, error: 'Adapter request failed.', kind: 'server_error' }` |

Server error messages are generic on purpose — use `onError` for the real
exception server-side. Do not echo SQL fragments or schema names to clients.
