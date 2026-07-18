# HTTP adapter

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
| Mutations | Not proxied — writes stay on explicit app-owned endpoints |

## Status semantics

| Situation | HTTP | Envelope |
|---|---|---|
| Success | 200 | `{ ok: true, result }` |
| Malformed body / authorize `false` | 400 / 403 | `{ ok: false, error, kind: 'bad_request' }` |
| Adapter / DB throw | 500 | `{ ok: false, error: 'Adapter request failed.', kind: 'server_error' }` |

Server error messages are generic on purpose — use `onError` for the real
exception server-side. Do not echo SQL fragments or schema names to clients.
