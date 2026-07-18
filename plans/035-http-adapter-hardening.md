# Plan 035: HTTP adapter hardening — authorization seam, honest error semantics, complete wire contract

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/adapters packages/core/src/types/adapter.ts packages/core/tests/adapters packages/ui/src/hooks/use-facets.ts apps/marketing/src/app/api`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (public-API shaping; wire-format change — see "Why now")
- **Depends on**: none (033 recommended first for test-cache truth; files disjoint)
- **Category**: security / bug
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

The HTTP adapter pair (`httpAdapter` client / `handleAdapterRequest` +
`createAdapterRouteHandler` server) shipped in commit `787a816` as public
`@better-tables/core` API. It has five gaps, found by a security + correctness
audit on 2026-07-17:

1. **No authorization seam** (the security headline). `isValidBody` checks
   only `method` (and `columnId` for facet methods); `body.params` is never
   inspected, the adapter factory receives no request context, and the
   handler dispatches straight into the adapter. Because the Drizzle adapter
   honors client-supplied `primaryTable`/`columns`, a bare mounted route
   exposes **every table in the server adapter's schema** to any caller —
   and the in-repo example mounts the raw multi-table adapter, bypassing the
   table-scoped `primaryTable` injection that plan 030 built for exactly
   this safety.
2. **Error-detail leakage**: adapter/DB error messages (SQL fragments,
   schema names) are returned verbatim to clients — combined with (1) this
   is a schema-enumeration oracle.
3. **Wrong status class**: every failure maps to HTTP 400, so a down
   database reports as "your request was malformed" — retry middleware and
   error dashboards are both lied to.
4. **`faceted` corruption**: the handler converts the `getFacetedValues`
   `Map` to entries, but a `fetchData` result's documented
   `faceted?: Record<string, Map<string, number>>` field is
   `JSON.stringify`ed to `{}` — silent data loss for any adapter that
   populates it.
5. **No cancellation for facet reads**: `FacetQueryParams` has no `signal`,
   so superseded facet requests always run to completion.

**Why now**: nothing on this surface has been published to npm yet (the 0.6
changeset train hasn't shipped), so the wire format and option signatures can
still be shaped without a breaking release. After 0.6 ships, every one of
these becomes a compat negotiation.

Mutations are intentionally NOT proxied (`http-adapter.ts:140-142` documents
this; `defaultHttpAdapterMeta` advertises `create/update/delete: false`) —
this plan keeps that boundary; everything here is read-path.

## Current state

All excerpts verified at `787a816`.

- `packages/core/src/adapters/http-handler.ts` (123 lines, read it fully
  before starting):
  - `:19-27` — `AdapterSource<TData> = TableAdapter<TData> | (() =>
    TableAdapter<TData> | Promise<TableAdapter<TData>>)`; `resolveAdapter`
    calls the factory with **no arguments**.
  - `:29-41` — `isValidBody`: `method === 'fetchData'` → `true` with no
    params check; facet methods require `typeof columnId === 'string'`.
  - `:61-87` — the dispatch `switch`; `catch` returns
    `{ ok: false, error: error instanceof Error ? error.message : 'Adapter request failed.' }`.
  - `:105-122` — `createAdapterRouteHandler` parses JSON (malformed →
    `undefined` → validation error) and maps every `!envelope.ok` to
    `status: 400`.
- `packages/core/src/adapters/http-protocol.ts` (41 lines) —
  `AdapterRequestBody` union (fetchData carries `params: Omit<FetchDataParams,'signal'>`;
  facet methods carry `columnId` + optional `params`);
  `AdapterResponseBody = { ok: true; result: unknown } | { ok: false; error: string }`.
- `packages/core/src/adapters/http-adapter.ts`:
  - `:66-106` — `HttpAdapterConfig` (`url`, `fetch?`, `headers?` object or
    sync/async function, `meta?`); `:113-121` `HttpAdapterError` with
    optional `status`.
  - `:157-181` — `send()` POSTs, parses envelope, throws `HttpAdapterError`
    on non-JSON / `!ok` / non-2xx.
  - `:186-191` — `fetchData` strips `signal` from the wire and passes it to
    fetch. `:193-222` — the three facet methods pass `params` straight
    through and **never** pass a signal to fetch; `getFacetedValues`
    rebuilds its Map from entries.
- `packages/core/src/types/adapter.ts:191-200` — `FacetQueryParams` has a
  single member `filters?: FilterState[] | FilterGroupNode`. `:144` —
  `FetchDataResult.faceted?: Record<string, Map<string, number>>`.
- `packages/ui/src/hooks/use-facets.ts:132-166` — `fetchFacets` guards with
  a monotonic `requestIdRef` only; builds
  `facetParams = stableFilters !== undefined ? { filters: stableFilters } : {}`
  (note the `exactOptionalPropertyTypes` conditional-inclusion idiom — you
  must follow it when adding `signal`).
- `apps/marketing/src/app/api/tables/tickets/route.ts` — the demo mount:

  ```ts
  export const POST = createAdapterRouteHandler(() =>
    getSupportTables().then((tables) => tables.database)
  );
  ```

  `tables.database` is the RAW multi-table `drizzleAdapter(db)` over a
  schema whose JS keys are `tickets`, `customers`, `assignees`,
  `bulkTickets` (see `apps/marketing/src/lib/demo/support/db.ts` —
  `fullSchema`). The client for this route is
  `apps/marketing/src/components/sections/facets-sidebar.tsx:41`
  (`httpAdapter({ url: '/api/tables/tickets' })` + `useFacets`).
- `apps/marketing/src/app/api/tickets/route.ts:16-18` and
  `api/users/route.ts:16-18` — on error:
  `return NextResponse.json({ error, details: error }, { status: 500 })`
  where `error` is the underlying message string.
- Existing tests: `packages/core/tests/adapters/http-adapter.test.ts`
  (7 tests: loopback round-trip, server-throw, lazy factory, malformed body,
  route handler). Model new tests on its loopback-fetch pattern.
- A changeset for the adapter already exists (`.changeset/http-adapter.md`,
  minor). Changesets accumulate for one 0.6 train — do not version/publish.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Core tests | `cd packages/core && bun test` | all pass |
| Scoped | `cd packages/core && bun test tests/adapters/http-adapter.test.ts` | all pass |
| UI tests | `cd packages/ui && bun test` | all pass |
| Typecheck | `bun run typecheck` (root) | exit 0 — this also typechecks drizzle + marketing against the contract change |
| Demo route check | `cd apps/marketing && bun run dev` then the curl in Step 6 | see step |

## Scope

**In scope** (the only files you should modify):
- `packages/core/src/adapters/http-handler.ts`
- `packages/core/src/adapters/http-protocol.ts`
- `packages/core/src/adapters/http-adapter.ts`
- `packages/core/src/adapters/index.ts` (export new option types)
- `packages/core/src/types/adapter.ts` (add `FacetQueryParams.signal` only)
- `packages/core/tests/adapters/http-adapter.test.ts`
- `packages/ui/src/hooks/use-facets.ts`
- `apps/marketing/src/app/api/tables/tickets/route.ts`
- `apps/marketing/src/app/api/tickets/route.ts`, `apps/marketing/src/app/api/users/route.ts`
- `packages/core/docs/HTTP_ADAPTER.md` (create), `packages/core/README.md`
  (one link line)
- `.changeset/<new-file>.md`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- Proxying mutations over HTTP — explicitly rejected design; keep the
  read-only boundary.
- A batch/multi-method wire protocol or client-side response caching
  (recorded in the ledger backlog as a perf item).
- `packages/adapters/drizzle/**` — the drizzle adapter needs no change;
  `FacetQueryParams.signal` is optional and additive.
- `packages/core/src/utils/compression.ts` (URL-state hardening is a
  separate backlog item).
- `defaultHttpAdapterMeta` capability shape.

## Git workflow

- Branch: `http-adapter-hardening`
- Commits: `Plan 035 Step N: <imperative summary>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Error classes in the protocol and handler

In `http-protocol.ts`, extend the failure envelope:

```ts
export type AdapterResponseBody =
  | { ok: true; result: unknown }
  | { ok: false; error: string; kind: 'bad_request' | 'server_error' };
```

In `http-handler.ts`:
- Malformed body → `{ ok: false, error: 'Malformed adapter request body.', kind: 'bad_request' }`.
- The dispatch `catch` → `{ ok: false, error: 'Adapter request failed.', kind: 'server_error' }`
  — the caught error's own message is NO LONGER sent to the client. Add an
  options bag as a third parameter:
  `handleAdapterRequest(source, body, options?: HandleAdapterRequestOptions)`
  with `onError?: (error: unknown) => void` invoked (inside its own
  try/catch — a throwing logger must not mask the response) before
  returning the server_error envelope.
- `createAdapterRouteHandler` maps `kind: 'bad_request'` → 400 and
  `kind: 'server_error'` → 500 (success stays 200).

In `http-adapter.ts`, `send()` already surfaces `envelope.error` via
`HttpAdapterError` — no client change needed for this step (the message just
becomes generic).

**Verify**: `cd packages/core && bun test tests/adapters/http-adapter.test.ts`
— update the existing server-throw test: it must now assert the client sees
the GENERIC message (not the thrown one) and, via the route-handler test,
status 500. All pass.

### Step 2: Request-aware adapter source + route options

In `http-handler.ts`:

```ts
export interface AdapterSourceContext {
  /** The incoming web-standard Request, when serving over HTTP. */
  request?: Request;
}

export type AdapterSource<TData = unknown> =
  | TableAdapter<TData>
  | ((context?: AdapterSourceContext) => TableAdapter<TData> | Promise<TableAdapter<TData>>);
```

(`() => adapter` remains assignable — fewer-params functions are assignable
in TS; the existing 7 tests prove no regression.) `resolveAdapter` gains an
optional context argument it forwards; `handleAdapterRequest` gains
`context?: AdapterSourceContext` (pass-through), and
`createAdapterRouteHandler` gains an options parameter:

```ts
export interface AdapterRouteHandlerOptions {
  /**
   * Gate every request. Return `false` to reject (403 envelope), or a
   * `Response` to short-circuit with your own reply (e.g. 401 + WWW-Authenticate).
   */
  authorize?: (request: Request, body: AdapterRequestBody) => boolean | Response | Promise<boolean | Response>;
  /**
   * Constrain the decoded request before dispatch — the place to pin
   * `primaryTable`, strip `columns`, or clamp pagination for this endpoint.
   * Return the (possibly replaced) body.
   */
  constrainRequest?: (body: AdapterRequestBody, request: Request) => AdapterRequestBody;
  /** Server-side error sink for `server_error` responses. */
  onError?: (error: unknown) => void;
}
```

Order of operations in the returned handler: parse JSON → validate shape
(`isValidBody`) → `authorize` (invalid-shape requests are rejected before
authorize runs; a `false` return → 403 with
`{ ok: false, error: 'Unauthorized.', kind: 'bad_request' }` — document the
kind choice) → `constrainRequest` → `handleAdapterRequest(source, body,
{ onError }, { request })`. Export the two new interfaces from
`adapters/index.ts`.

**Verify**: root `bun run typecheck` → exit 0; existing tests still pass.

### Step 3: Fix `faceted` Map serialization in the `fetchData` path

In `http-handler.ts`'s `fetchData` case: if `result.faceted` is present,
send `{ ...result, faceted: Object.fromEntries(Object.entries(result.faceted).map(([k, m]) => [k, Array.from(m.entries())])) }`.
In `http-adapter.ts`'s `fetchData`: if the decoded result has `faceted`,
rebuild each entry array into a `Map` before returning. Document the wire
shape in a comment in `http-protocol.ts` next to `AdapterResponseBody`
(mirroring the existing `getFacetedValues` note).

**Verify**: new round-trip test (Step 7, test e) — deferred to that step;
here run `bun run typecheck` → exit 0.

### Step 4: Thread `signal` through facet reads

1. `packages/core/src/types/adapter.ts` — add to `FacetQueryParams`:

   ```ts
   /**
    * Transport-level cancellation for this read. Never serialized by wire
    * adapters; in-process adapters may ignore it.
    */
   signal?: AbortSignal;
   ```

2. `http-adapter.ts` — in each of the three facet methods, split
   `const { signal, ...serializable } = params ?? {}` and call
   `send(bodyWithSerializableParams, signal)` (mirror `fetchData:186-190`;
   only include `params` in the body when `serializable` has keys, keeping
   today's `...(params ? { params } : {})` behavior for the no-params call).
3. `packages/ui/src/hooks/use-facets.ts` — in `fetchFacets`, create one
   `AbortController` per run stored in a ref; abort the previous run's
   controller at the top (alongside the `requestIdRef` bump); include
   `signal` in `facetParams` using the same conditional-inclusion idiom as
   `filters` (exactOptionalPropertyTypes forbids `{ signal: undefined }`);
   abort in the fetch effect's cleanup. Catch/ignore abort-shaped errors the
   same way `use-table-data.ts:137-141` does (requestId guard already
   discards them — verify no unhandled rejection surfaces in tests).

**Verify**: root `bun run typecheck` → exit 0 (proves drizzle + marketing
compile against the additive contract); `cd packages/ui && bun test` → all
pass.

### Step 5: Scope the demo route and stop leaking demo errors

1. `apps/marketing/src/app/api/tables/tickets/route.ts` — use the new seam:

   ```ts
   export const POST = createAdapterRouteHandler(
     () => getSupportTables().then((tables) => tables.database),
     {
       constrainRequest: (body) =>
         body.method === 'fetchData'
           ? { ...body, params: { ...body.params, primaryTable: 'tickets' } }
           : body,
       onError: (error) => console.error('[api/tables/tickets]', error),
     }
   );
   ```

   `'tickets'` is the JS schema key in `fullSchema`
   (`apps/marketing/src/lib/demo/support/db.ts`). Update the route's
   comment block: it currently advertises "the entire server side … one
   line" — extend it to say the route pins `primaryTable` because a bare
   mount would expose every table in the schema (this comment is
   load-bearing: it's the pattern people copy).
2. `api/tickets/route.ts` + `api/users/route.ts` — replace
   `NextResponse.json({ error, details: error }, { status: 500 })` with
   `console.error(...)` server-side and
   `NextResponse.json({ error: 'Failed to load demo data.' }, { status: 500 })`.
   Check the two pages/components consuming these routes only read the
   success shape (search for their fetch call sites under
   `apps/marketing/src`) — the error string is display-only or unused.

**Verify (dev server)**: `cd apps/marketing && bun run dev`, then:
- `curl -s localhost:3000/api/tables/tickets -X POST -H 'content-type: application/json' -d '{"method":"fetchData","params":{"primaryTable":"customers","pagination":{"page":1,"limit":1}}}'`
  → the returned row is a **ticket** (has ticket-shaped fields, e.g.
  `subject`/`status`), NOT a customer — proving the pin overrides the
  client's `primaryTable`.
- `curl -s localhost:3000/api/tables/tickets -X POST -d 'not json'` → 400
  with `kind: 'bad_request'`.
Stop the dev server afterwards.

### Step 6: Handler/adapter test expansion

Extend `packages/core/tests/adapters/http-adapter.test.ts` (loopback
pattern) with, at minimum:

a. `headers` as a static object → asserted on the received request.
b. `headers` as an async function (fresh value per call) → asserted across
   two calls.
c. Transport failure: fetch stub returns non-JSON (`json()` rejects) →
   `HttpAdapterError` with the "non-JSON" message.
d. Transport failure: non-2xx with a valid error envelope →
   `HttpAdapterError` carrying `status`.
e. `faceted` round-trip: server adapter returns
   `faceted: { status: new Map([['open', 2]]) }` from `fetchData` → client
   result has a real `Map` with `get('open') === 2` (this test FAILS before
   Step 3).
f. Abort: fetch stub that rejects with an `AbortError` when its signal
   fires; call `fetchData` with an aborted/aborting signal → the rejection
   propagates (documents cancellation works end-to-end).
g. `authorize` returning `false` → 403 and no adapter invocation (spy on
   the factory); `authorize` returning a custom `Response` → that response
   is returned verbatim.
h. `constrainRequest` pinning `primaryTable` → the adapter receives the
   pinned value regardless of what the client sent.
i. Status mapping: adapter throws → route handler responds 500 with generic
   message + `kind: 'server_error'`; malformed body → 400 + `bad_request`.
j. Date-valued filter round-trip: a filter with a `Date` in `values`
   arrives at the server adapter as an ISO **string** — pin this as the
   documented wire contract (server-side emitters parse ISO strings).

**Verify**: `cd packages/core && bun test tests/adapters/http-adapter.test.ts`
→ all pass (7 existing ± updates, +10 new).

### Step 7: Docs + changeset + gates

1. Create `packages/core/docs/HTTP_ADAPTER.md`: what the pair is (client
   `httpAdapter` / server `createAdapterRouteHandler`), the Next.js
   app-router example WITH `authorize` + `constrainRequest` shown (the safe
   mount is the default teaching example — a bare mount gets an explicit
   warning box: "a bare `createAdapterRouteHandler(adapter)` exposes the
   entire read surface of the adapter's schema, unauthenticated"), the wire
   contract notes (Maps as entries, dates as ISO strings, `AbortSignal`
   never serialized, mutations not proxied), and the 400/403/500 semantics.
2. Link it from `packages/core/README.md`'s documentation/links section
   (find it via `grep -n "docs/" packages/core/README.md`; add one line —
   do not fix the pre-existing dead `../../docs/*` links there, that's a
   separate backlog item).
3. Add a changeset for `@better-tables/core` (minor, consistent with the
   existing `http-adapter.md` changeset): authorize/constrainRequest/onError
   options, 500-vs-400 mapping, generic server error messages, `faceted`
   wire fix, `FacetQueryParams.signal`.
4. Full gates: root `bun run typecheck`; core + ui `bun test`.

**Verify**: docs file exists; changeset frontmatter says
`"@better-tables/core": minor`; all gates green.

## Test plan

Covered by Step 6 (tests a–j) plus the Step 1 rewrite of the server-throw
test. Structural pattern: the existing loopback fetch stub in
`http-adapter.test.ts`. The UI side relies on existing `use-facets.test.tsx`
continuing to pass with the signal addition (its stub adapter ignores extra
params fields — verify, and add one assertion that cleanup aborts the
in-flight controller if cheap to express with the existing helpers).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "kind: 'server_error'" packages/core/src/adapters/http-handler.ts` → match; `grep -n "error.message" packages/core/src/adapters/http-handler.ts` → NO match in the catch path (generic message only)
- [ ] `grep -n "authorize\|constrainRequest" packages/core/src/adapters/http-handler.ts` → matches; both exported from `packages/core/src/adapters/index.ts`
- [ ] `grep -n "signal" packages/core/src/types/adapter.ts` shows `FacetQueryParams.signal`
- [ ] `cd packages/core && bun test` → pass with ≥16 tests in `http-adapter.test.ts`
- [ ] `cd packages/ui && bun test` → pass
- [ ] Root `bun run typecheck` → exit 0
- [ ] `grep -n "constrainRequest" apps/marketing/src/app/api/tables/tickets/route.ts` → match; `grep -rn "details: error" apps/marketing/src/app/api/` → no matches
- [ ] `packages/core/docs/HTTP_ADAPTER.md` exists; `grep -n "HTTP_ADAPTER" packages/core/README.md` → 1 match
- [ ] New `.changeset/*.md` with `"@better-tables/core": minor` exists
- [ ] Step 5's curl checks reproduced (record the ticket-shaped response in your report)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Pinning `primaryTable: 'tickets'` in Step 5 throws a `SchemaError` whose
  message lists available table keys and `'tickets'` is NOT among them —
  use the listed ticket-table key instead ONLY if it is unambiguous;
  otherwise stop with the error text.
- The `AdapterSource` signature change breaks any existing consumer found
  by typecheck other than the files in scope.
- Adding `FacetQueryParams.signal` causes drizzle or marketing typecheck
  errors that a purely additive optional field should not cause.
- The existing `use-facets.test.tsx` fails after Step 4 for reasons beyond
  an abort-propagation adjustment.
- You find yourself wanting to change `packages/adapters/drizzle/**` or add
  a batch protocol — both out of scope.

## Maintenance notes

- The `authorize`/`constrainRequest` seam is deliberately transport-level.
  Row-level scoping (tenant columns, per-user filters) should be built as a
  `constrainRequest` that injects filters — a worked example belongs in the
  docs when a real consumer needs it. The ledger's direction findings
  (saved views, plugin hooks) may later want the same context object; keep
  `AdapterSourceContext` minimal until then.
- The wire format (`kind` field, faceted entries) must not change after the
  0.6 publish without a protocol version marker — reviewers should treat
  `http-protocol.ts` as frozen post-release.
- Facet request batching + client caching (audit finding PERF-03) is the
  natural next change to `send()` — it composes with, and is unblocked by,
  this plan's structure.
- Reviewer scrutiny: Step 2's order of operations (validate → authorize →
  constrain → dispatch) and that `onError` can never throw through to the
  response path.
