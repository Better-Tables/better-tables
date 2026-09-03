# Adapter wire protocol (for non-JS backends)

> **Audience:** a team implementing a Better Tables-compatible endpoint in a
> language other than TypeScript/JavaScript (ASP.NET, Java, Python, Go, …),
> who has never read this repo's source. Nothing here assumes familiarity
> with `http-protocol.ts`'s types — every shape below is a JSON example.
>
> **Frozen since the 0.6 publish.** `@better-tables/core` is published to
> npm; this protocol's request/response shapes do not change without a
> version marker. What's documented here is safe to build against long-term.
>
> If you're looking for the JS-side client/server helpers instead
> (`httpAdapter` / `createAdapterRouteHandler`), see
> [HTTP_ADAPTER.md](./HTTP_ADAPTER.md). This document specifies the wire
> format those helpers speak — useful whether or not you use them.

## Why this exists

Better Tables' React frontend can talk to *any* backend that answers a
single JSON-over-HTTP contract: one POST endpoint, one request/response
envelope, no cookies-vs-headers assumptions, no framework requirement on
the server. Two deployment shapes both already work with zero Better
Tables code changes:

- **Option A (recommended default):** your own backend (ASP.NET, Java,
  Python, Go, …) implements a controller that speaks this JSON contract
  directly against its own database connection (Dapper, EF Core, raw
  ADO.NET, JDBC, SQLAlchemy — irrelevant to Better Tables). The React
  frontend uses the existing, unmodified `httpAdapter({ url: '/api/tables/x' })`
  pointed at your route. No `@better-tables/adapters-*` package, no Node
  process, is ever involved. Pick this when your org already has a backend
  team that owns the database access layer and doesn't want to hand the
  browser a connection string.
- **Option B (fallback):** stand up a small Node/Bun sidecar service that
  imports a `@better-tables/adapters-*` package (e.g.
  `@better-tables/adapters-drizzle`) plus `createAdapterRouteHandler`,
  running alongside — not instead of — your primary backend, with its own
  scoped DB credentials. The frontend points `httpAdapter` at the sidecar.
  Pick this when there's no bandwidth to implement Option A, or when the
  JS-side adapter's relationship/facet/auto-column machinery is worth more
  than avoiding a second service.

**This is a genuine infrastructure decision for your team, not something
this doc resolves for you.** A quick checklist:

| Question | Leans Option A | Leans Option B |
|---|---|---|
| Who owns the DB access layer today? | Backend team, already has one | Nobody yet / frontend team |
| Is a second running service acceptable? | No | Yes |
| Do you need relationship-path columns, auto columns from schema introspection, or facet self-exclusion computed for you? | You'll reimplement these yourself | Get them for free from the JS adapter |
| Data residency / driver constraints (e.g. only your backend's runtime can reach the DB)? | Yes | No |

## The request envelope

Every request is an HTTP `POST` with a JSON body. There is one endpoint,
one shape per `method`. All examples below are literal JSON — not
TypeScript.

### `fetchData` — read rows

```json
{
  "method": "fetchData",
  "params": {
    "pagination": { "page": 1, "limit": 20 },
    "sorting": [{ "columnId": "createdAt", "direction": "desc" }],
    "filters": [
      { "columnId": "status", "type": "option", "operator": "is", "values": ["open"] }
    ]
  }
}
```

`params.filters` may also be a `FilterGroupNode` tree (nested AND/OR) — see
the self-exclusion note below for how a leaf's `columnId` should be
interpreted either way. `params.primaryTable` (string) selects which table
a multi-table endpoint answers for; a conforming server SHOULD ignore any
client-supplied `primaryTable` on a single-table endpoint and pin its own.

### `getFilterOptions` / `getFacetedValues` / `getMinMaxValues` — one-column facets

```json
{
  "method": "getFacetedValues",
  "columnId": "status",
  "params": {
    "filters": [{ "columnId": "priority", "type": "option", "operator": "is", "values": ["high"] }],
    "limit": 100
  }
}
```

`params` is optional (omit it, or set `params.filters`/`params.limit`
individually). `limit` caps the distinct values returned, ordered by count
descending; default `100`; `null` disables the cap.

### `getFacets` — batched multi-column facets

One round trip for a whole facet sidebar refresh instead of one request
per column:

```json
{
  "method": "getFacets",
  "requests": [
    { "columnId": "status", "kind": "values" },
    { "columnId": "priority", "kind": "values" },
    { "columnId": "reopens", "kind": "minmax" }
  ],
  "params": { "filters": [] }
}
```

At most **50** entries in `requests` — a server MUST reject a larger batch
as `bad_request` (this cap exists so one POST can't be used to fan out into
thousands of queries).

### `describeColumns` — schema introspection (auto columns)

```json
{ "method": "describeColumns", "table": "tickets" }
```

`table` is optional (omit it to describe the endpoint's default table).
Response `result` is an array of column descriptions — see the response
section below for the shape.

### `resolveCellWriteTarget` — read-only, relationship-aware write target lookup

```json
{ "method": "resolveCellWriteTarget", "columnId": "customer.company", "table": "tickets" }
```

A pure read (no mutation) that answers "if I edit this column, which
table/field does the write actually land on, and is it a single-row target
I can safely write to?" — needed before `cellEdit` because a UI can expose
relationship-path columns (`customer.company`) that are not simple
own-table fields.

### `cellEdit` — the one proxied write

```json
{ "method": "cellEdit", "id": "42", "field": "status", "value": "closed", "table": "tickets" }
```

- `id` is the id of the row the write targets — for a relationship-path
  column this is the **related** row's id, not the row currently on
  screen.
- `field` is the **column id** (e.g. `customer.company`), never a raw data
  record — see the security model below for why this distinction matters.
- `value` is wire-safe (a `Date` must already be an ISO string; see
  Serialization rules).
- `table` is the caller's primary-table context; see the security model —
  a conforming server must not let this field redirect a write.

`cellEdit` is disabled by default. It exists behind **double opt-in**: the
server must explicitly enable writes, and the client must explicitly ask
for them. See "The `cellEdit` security model" below before implementing
this method.

## The response envelope

Every response is one JSON object, one of exactly two shapes:

```json
{ "ok": true, "result": /* method-specific payload, see below */ }
```

```json
{ "ok": false, "error": "Human-readable message.", "kind": "bad_request" }
```

`kind` is one of `"bad_request"`, `"forbidden"`, or `"server_error"` and
drives the HTTP status code:

| HTTP status | `ok` | `kind` | When |
|---|---|---|---|
| 200 | `true` | — | Success |
| 400 | `false` | `bad_request` | Malformed body, unknown/unwritable column, failed value coercion, an allow-list miss, a method the adapter doesn't support (e.g. `describeColumns` on a schema-less adapter) |
| 403 | `false` | `forbidden` | `authorize` rejected the request, or `cellEdit` arrived at an endpoint with writes disabled |
| 500 | `false` | `server_error` | The adapter or database threw |

**Server error messages must stay generic** (`"Adapter request failed."`,
not the raw exception). Never echo SQL fragments, stack traces, or schema
internals to the client — log the real exception server-side instead.

### Result payload per method

| Method | `result` shape |
|---|---|
| `fetchData` | `{ data: object[], total: number, pagination: { page, limit, totalPages, hasNext, hasPrev }, faceted?: { [columnId]: [value, count][] }, meta?: object }` |
| `getFilterOptions` | `{ value: string, label: string, count?: number }[]` |
| `getFacetedValues` | `[value, count][]` — see Serialization rules (Map → entries) |
| `getMinMaxValues` | `[min, max]` |
| `getFacets` | `{ values: { [columnId]: [value, count][] }, ranges: { [columnId]: [min, max] } }` — only requested columns appear |
| `describeColumns` | `{ field, columnType, label, options?: {value,label}[], nullable, primaryKey, foreignKey, writable }[]` — one entry per own-table column |
| `resolveCellWriteTarget` | `{ table: string, field: string, relatedIdPath: string \| null, single: boolean, writable: boolean } \| null` |
| `cellEdit` | the updated row object (whatever your `updateRecord` equivalent returns) |

## Serialization rules

Three rules, all driven by "JSON has no `Map`, no `Date`, and can't carry
an abort signal":

1. **`Map` → `[value, count][]` entries.** Every facet result that is
   conceptually a map (`getFacetedValues`'s return, each column's entry in
   `getFacets`'s `values`, and `fetchData`'s optional `faceted` field) is
   sent as an array of `[key, count]` pairs, not a JSON object — this
   preserves value ordering and lets numeric-looking keys survive without
   coercion.
2. **`Date` → ISO 8601 string.** Any `Date` in a row or a filter value is
   sent as `date.toISOString()`. A server receiving a date filter value
   should parse it as an ISO string; a server emitting rows with date
   columns should format them the same way. Round-trip fidelity (send an
   ISO string back that `new Date(iso).toISOString() === iso`) is what a
   client checks.
3. **`AbortSignal` never crosses the wire.** It's a transport-level
   cancellation primitive for the client's own `fetch` call — there is
   nothing for a server to do with it, and a compliant server never
   expects to see it in a request body.

## The facet self-exclusion contract

**Mandatory for every conforming facet implementation** (`getFilterOptions`,
`getFacetedValues`, `getMinMaxValues`, and each entry of `getFacets`).

When computing the facet for `columnId` (the method's own column
argument), drop every filter leaf whose `columnId` equals that SAME column
before applying the rest of `params.filters` — apply every other leaf,
never a leaf that targets the column being faceted.

Why: without this, a multi-select facet sidebar on the column a user is
actively filtering would collapse to showing only the option(s) already
selected (because the active filter itself excludes every other option's
rows). Self-exclusion is what lets the sidebar keep showing sibling options
and their true counts.

```json
// Client has filtered status = "active". Faceting "role" applies that
// filter normally — only active users' roles are counted:
{ "method": "getFacetedValues", "columnId": "role",
  "params": { "filters": [{ "columnId": "status", "type": "option", "operator": "is", "values": ["active"] }] } }

// But faceting "status" itself must IGNORE its own filter, so every
// status option still reports its true count, not just "active":
{ "method": "getFacetedValues", "columnId": "status",
  "params": { "filters": [{ "columnId": "status", "type": "option", "operator": "is", "values": ["active"] }] } }
```

When `params.filters` is a nested AND/OR tree rather than a flat array,
self-exclusion means pruning matching leaves out of the tree — drop a
group that becomes empty as a result, and unwrap a group left with a
single remaining child — not rejecting the whole tree.

## The `cellEdit` security model

`cellEdit`'s wire shape is deliberately narrow: `{ id, field, value, table? }`
— a single cell address, never a free-form data record. This is not an
accident of convenience; it's what makes the write safe to expose to an
un-trusted browser client. Spelled out:

- **The column id is re-resolved server-side, never trusted from the
  client's intent alone.** `field` is a *column id* (e.g.
  `customer.company`), not a `(table, column)` pair the client gets to
  pick directly. Before writing anything, the server must call its own
  `resolveCellWriteTarget(field, table)` equivalent and use *that* result's
  `(table, field)` — never let a client-supplied table/field pair bypass
  this resolution. This is what prevents a client from taking an
  allow-listed column id and pointing it at an arbitrary table.
- **Double opt-in.** A server MUST default to rejecting `cellEdit` with
  `{ ok: false, kind: 'forbidden' }` until writes are explicitly enabled
  for that endpoint. A client library SHOULD similarly default to a
  read-only shape (no write method exposed) until the caller opts in. Two
  separate switches, on two separate sides, both required — this is what
  makes "reads leaked, writes did not" the default failure mode instead of
  the reverse.
- **Fail closed without schema introspection.** If a server cannot answer
  "what type is this column, and is it writable" from its own schema
  metadata, it must refuse every `cellEdit` rather than trust the client's
  claim about the column's type or writability. Coerce the incoming
  `value` using the schema's own understanding of the column's type — 
  reject the write (`bad_request`) if coercion fails, rather than passing
  an unvalidated value through to the database.
- **An allow-list is a (table, field) pin, not a bare name.** If your
  server narrows writes to an explicit set of column ids (recommended —
  broader schema-writability is not the same as what your UI actually
  marks editable), remember that a bare column id like `"subject"` only
  means one specific `(table, field)` — whichever one your endpoint
  resolves to by default. A request that supplies a *different* `table`
  for that same column id must be rejected outright, even if that other
  table happens to have its own unrelated writable column sharing the same
  name. Otherwise a client could keep an allow-listed id and swap the
  table to redirect the write somewhere you never intended to expose.
  Endpoints that genuinely serve several primary tables should pin `table`
  themselves (ignore the client-supplied value) rather than rely on this
  guard alone.
- **Authorization runs before the write, every time.** Enabling writes
  without a real authorization check means every caller of the endpoint
  can write — row-level authorization (can *this* user edit *this* row?)
  is entirely the responsibility of whatever sits in front of the write,
  not something this protocol enforces for you.

## Running the conformance suite against your own endpoint

This repo ships a self-service compliance check:
[`packages/core/tests/adapters/wire-protocol-conformance.test.ts`](../tests/adapters/wire-protocol-conformance.test.ts).
By default it runs against an in-process reference server (zero external
setup, always green in this repo's CI). Point it at your own
implementation instead:

```bash
WIRE_PROTOCOL_TEST_URL=https://your-app.example.com/api/tables/tickets \
  bun test packages/core/tests/adapters/wire-protocol-conformance.test.ts
```

It exercises: the envelope shape for every method above, the `Map`-as-entries
round trip, ISO-date round trip, the facet self-exclusion contract, and
status-code mapping for a malformed request — all without requiring you to
read a line of this repo's adapter code. A handful of assertions that
depend on this repo's own reference server configuration (e.g. the
specific `cellEdit` fail-closed case) are skipped when
`WIRE_PROTOCOL_TEST_URL` is set, since they assert about a server
configuration choice rather than the wire format itself.
