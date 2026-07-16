---
"@better-tables/core": minor
---

feat(core): `httpAdapter` + `createAdapterRouteHandler` — a client-callable adapter over HTTP

Real adapters (e.g. the Drizzle adapter) wrap a server-only DB binding and
can't be called from the browser, so client components (`useFacets`, faceted
sidebars, client-side tables) forced every app to hand-write a `fetch` shim and
a route handler. This ships that pair, once:

- `httpAdapter({ url })` — a browser-safe `TableAdapter` that proxies the four
  read methods (`fetchData`, `getFilterOptions`, `getFacetedValues`,
  `getMinMaxValues`) to an endpoint. Handles `Map` (de)serialization for
  `getFacetedValues` and strips the non-serializable `AbortSignal` (using it to
  cancel the underlying fetch). Accepts a custom `fetch`, per-request `headers`,
  and an optional `meta` override.
- `handleAdapterRequest(adapterOrFactory, body)` — framework-agnostic dispatch
  to a real adapter, returning a JSON-safe envelope. Accepts a lazy factory so
  the adapter is constructed per-request (works with a native-DB-binding
  adapter that can't be instantiated at module load).
- `createAdapterRouteHandler(adapterOrFactory)` — wraps the above as a
  web-standard `Request` → `Response` handler (drop-in `export const POST` for a
  Next.js route, edge function, etc.).

Mutation methods are intentionally not proxied — writes deserve an explicit,
app-owned endpoint.
