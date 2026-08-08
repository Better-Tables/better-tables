# Plan 065: Metadata-driven admin experience — table navigator, FK navigation, generic record forms, and a documented cross-language wire protocol

> **Executor instructions**: Phased BUILD plan — each phase is a mergeable
> unit with its own verification; do not start a phase until the previous
> one's criteria pass. Phases are largely independent of each other (see
> Order notes) — read the whole plan before picking a starting phase. Run
> every verification command and confirm the expected result before moving
> on. If anything in the "STOP conditions" section occurs, stop and report
> — do not improvise. When done (or when a phase lands), update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3faa4e1..HEAD -- packages/core/src/types/adapter.ts packages/core/src/factory.ts packages/core/src/adapters/http-protocol.ts packages/core/src/adapters/http-handler.ts packages/ui/src/components/table packages/ui/src/hooks packages/core/src/stores/table-registry.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (Phase 1 — wire protocol doc — is low-risk/high-value
  and can move first regardless of the rest; Phases 2-6 are the larger
  product bet)
- **Effort**: XL (spans Core, UI, and docs; phased; expect many PRs)
- **Risk**: LOW-MED per phase — Phase 1 is documentation-only (zero code
  risk); Phase 2 is one additive optional field on an existing type;
  Phases 3-6 are net-new UI components/props, nothing removed or changed
  in existing behavior
- **Depends on**: none hard on plan 064 (MSSQL adapter) — every phase here
  is adapter-agnostic and benefits Drizzle/Prisma/Kysely users equally.
  Phase 5's optional `listTables?()` method is easiest to exercise
  end-to-end once an adapter implements it, but the UI component doesn't
  require MSSQL specifically.
- **Category**: direction (new capability — "instant admin UI from live
  DB metadata" as a first-class Better Tables story, not a one-off)
- **Planned at**: commit `3faa4e1`, 2026-08-08 — originated from the same
  architecture-evaluation request as plan 064.

## Why this matters

The "auto columns" pipeline already shipped in plan 054
(`adapter.describeColumns()` → `InferredColumnSpec[]` →
`resolveTableColumns()` → plain `ColumnDefinition[]`, resolved lazily at
runtime — `packages/core/src/factory.ts:514-624`) proves Better Tables can
already render a grid from nothing but adapter metadata. What's missing
for a genuine "browse any table in this database" admin experience isn't
in Core at all — it's four UI-level gaps that exist independent of which
adapter is behind them:

1. No component lists "every table" and lets a user pick one — every
   example today is a hand-routed page with one `<BetterTable>`.
2. `InferredColumnSpec.foreignKey` is a bare boolean — no UI consumes it
   for navigation (click a value → jump to the related row/table).
3. Only single-cell inline editing exists — no full-record edit dialog or
   create-record form, even though `createRecord`/`updateRecord` already
   exist on the adapter contract.
4. Per-table overrides already work at the `<BetterTable>` prop level
   (explicit columns/config always win over inferred ones — plan 054's
   "declared values always win" rule), but there's no app-level config
   MAP pattern documented for "auto-render every table except these
   three, which get overrides."

Separately, a real deployment question came up during the MSSQL
evaluation that generalizes well beyond MSSQL: **teams whose backend is
in a different language than the React frontend** (the concrete example:
an ASP.NET service in front of the actual database) don't want to hand
DB credentials to the browser, and today have no documented way to make
their OWN backend speak Better Tables' wire format. The mechanism to do
this **already exists and already ships** —
`httpAdapter`/`createAdapterRouteHandler`/`handleAdapterRequest`
(`packages/core/src/adapters/http-adapter.ts`,
`http-handler.ts`, `http-protocol.ts`) are built purely on JSON-over-HTTP
and the Fetch API, with zero Next.js/Node-specific serialization tricks
leaking into the wire format. What's missing is a **language-agnostic
specification** of that protocol, written for someone who has never seen
the TypeScript types, so a non-JS team can implement a compliant endpoint
directly against their own database — no `@better-tables/adapters-*`
package, no Node process, involved at all if they don't want one.

## Current state

Verified at `3faa4e1`.

- **Auto columns pipeline** — `packages/core/src/factory.ts:514-624`
  (`buildInferredColumn`, `resolveTableColumns`); consumed at
  `packages/ui/src/components/table/table.tsx:656-688`
  (`useResolvedTableColumns`, with an `AutoColumnsLoading` skeleton while
  pending). "Declared values always win" — explicit column config
  overrides inferred metadata field-by-field
  (`factory.ts:486-512`).
- **`InferredColumnSpec`** — `packages/core/src/types/adapter.ts:258-272`:
  `field`, `columnType`, `label`, `options?`, `nullable`, `primaryKey`,
  `foreignKey: boolean`, `writable`. No target-table/target-field
  information — a UI cannot navigate anywhere from this today, only
  gate cell-editability via the separate `resolveCellWriteTarget`
  (`:281-292,537`).
- **`CellWriteTarget`** — `adapter.ts:281-292`: `table`, `field`,
  `relatedIdPath: string | null`, `single`, `writable`. This DOES carry a
  target table + a row-data path to the related row's id, but only for
  the column currently being cell-edited, and it's consumed exclusively
  by `packages/ui/src/hooks/use-editable-cells.ts` for write-routing —
  never surfaced as a navigation affordance.
- **Table registry** — `packages/core/src/stores/table-registry.ts:1-102`
  — a module-scoped `Map<string, StoreApi<TableStoreState>>` keyed by
  table `id` (`getOrCreateTableStore`/`getTableStore`/`getAllTableIds`).
  Purely an internal per-instance state registry for whatever
  `<BetterTable>`s happen to be mounted — not a schema-driven catalog.
- **`BetterTableProps`** — `packages/ui/src/components/table/table.tsx:145-345`
  — fully per-instance (`features`, `slots`, `editing`,
  `defaultVisibleColumns`, `urlSync`, etc.); explicit `columns`/`id`/`name`
  always win over a `table` def (`:749-774`). The `slots` seam
  (`:125-138,1414-1428`) is how `ActionsToolbar`/`ExportButton` plug in
  today — the natural extension point for a "row details"/"edit record"
  trigger.
- **Editable cell editors** — `packages/ui/src/components/table/editable-cell.tsx`
  — per-`ColumnType` editor components (text/number/date/boolean/option),
  orchestrated by `packages/ui/src/hooks/use-editable-cells.ts`. These are
  the field-level renderers a generic record form should REUSE, not
  reimplement.
- **`onRowClick`** — `table.tsx:284,1148-1161` — the only existing
  row-level interaction hook; purely a callback to the consumer, no
  built-in expansion/detail/dialog behavior.
- **The HTTP wire protocol** (the cross-language piece):
  - `packages/core/src/adapters/http-protocol.ts` — `AdapterMethod` union
    (`:16-24`: `fetchData | getFilterOptions | getFacetedValues |
    getMinMaxValues | getFacets | describeColumns | resolveCellWriteTarget
    | cellEdit`), `AdapterRequestBody` discriminated union (`:39-88`, one
    variant per method), `AdapterResponseBody` (`:104-106`: `{ ok: true,
    result } | { ok: false, error, kind: 'bad_request'|'forbidden'|
    'server_error' }`). Wire-format notes already documented in the file's
    own comments: `Map` results serialize as `[value, count][]` entries;
    dates serialize as ISO strings; `AbortSignal` never crosses the wire.
  - `packages/core/src/adapters/http-handler.ts` — `handleAdapterRequest`
    (`:164-383`, framework-agnostic dispatch) and
    `createAdapterRouteHandler` (`:408-512`, Fetch-API `Request`→
    `Response` wrapper). Status mapping: success→200, `bad_request`→400,
    `forbidden`→403, `server_error`→500 (`:500-506`). The `cellEdit`
    method (plan 055) is double opt-in (`writes` on the handler AND
    surfaced on the client) and FAILS CLOSED without schema introspection
    (`:281-289`) — the server re-resolves the target column server-side so
    a client can never redirect a write (`:290-349`); this security model
    is exactly what a non-JS implementer needs spelled out precisely.
  - `packages/core/src/adapters/http-adapter.ts` — the client-side
    `TableAdapter` implementation that already speaks this exact protocol;
    nothing here needs to change for a non-JS backend to work — it's the
    reference client, and proof that the protocol needs no JS-specific
    behavior on the server.
  - Existing test coverage: `packages/core/tests/adapters/http-adapter.test.ts`
    (loopback round-trip pattern) — the natural base for the Phase 1
    conformance harness below.
  - **Frozen-protocol note** (plan 035's maintenance section): "the wire
    format (`kind` field, faceted entries) must not change after the 0.6
    publish without a protocol version marker — reviewers should treat
    `http-protocol.ts` as frozen post-release." `@better-tables/core` is
    published (per `CLAUDE.md`'s package map), so treat the protocol as
    STABLE for this plan — Phase 1 documents what exists, it does not
    change the wire format.
  - **Standing product decision** (`plans/README.md`): "`httpAdapter` is
    for separated front/back only" — this plan's Phase 1 is exactly that
    scenario, just with a non-JS backend on the other end of the wire
    instead of a JS one.
- **Release mechanics**: this repo runs semantic-release, not changesets
  (see plan 064's Current state for the full note — do not create
  `.changeset/*.md` files; Conventional Commit messages drive versioning
  per `CLAUDE.md`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Core tests | `cd packages/core && bun test` | all pass |
| UI tests | `cd packages/ui && bun test` | all pass |
| Typecheck | `bun run typecheck` (root) | exit 0 |
| Marketing dev server (manual UI verification) | `cd apps/marketing && bun run dev` | new demo pages render |
| Wire-protocol conformance (Phase 1) | `cd packages/core && bun test tests/adapters/wire-protocol-conformance.test.ts` (create) | passes against the in-repo reference server AND (manually) against any externally supplied `WIRE_PROTOCOL_TEST_URL` |

## Scope

**In scope**:
- `packages/core/docs/ADAPTER_WIRE_PROTOCOL.md` (create — Phase 1)
- `packages/core/tests/adapters/wire-protocol-conformance.test.ts` (create — Phase 1)
- `packages/core/src/types/adapter.ts` — ONLY an additive optional field
  on `InferredColumnSpec` (Phase 2)
- `packages/adapters/drizzle/src/**` — ONLY wiring the new optional field
  into its existing `describeColumns` implementation (Phase 2)
- `packages/ui/src/components/table/**`, `packages/ui/src/hooks/**` (new
  components/hooks — Phases 3-5)
- `packages/core/src/factory.ts`, `packages/core/src/types/factory.ts` —
  Phase 6's per-table override config plumbing
- `apps/marketing/**` — new demo page(s) dogfooding the table navigator +
  record form (mirroring plan 029's dogfood pattern)
- Docs: relevant pages under `apps/marketing/content/docs/`; `wiki.md`
- `CLAUDE.md`, `plans/README.md`

**Out of scope** (do NOT touch):
- Any change to the wire format itself (`http-protocol.ts`'s shapes are
  frozen post-0.6-publish — Phase 1 documents, never modifies).
- Building `@better-tables/adapters-mssql` — that's plan 064.
- Realtime/CDC UI, saved/named views, data import — separate deferred
  items already tracked in `plans/README.md`.
- A generic query/report builder (pivot tables, custom SQL) — explicitly
  NOT what this plan is; stays a data grid + CRUD tool.

## Git workflow

- Branch per phase (`admin-experience-phase-N`) or one branch with phase
  commits — operator's choice; commits `Plan 065 Phase N: …`. Phase 1 is
  cheap and safe to land standalone even if the rest is deferred.

## Steps

### Phase 1: Formalize the cross-language wire protocol

**This directly answers the "ASP.NET backend, don't want to give the
frontend a DATABASE_URL" question.** Two deployment shapes both already
work with zero new Better Tables code; this phase's job is to make Option
A actually usable by a team that has never read this codebase:

- **Option A (recommended default)**: the ASP.NET (or Java/Python/Go/...)
  backend implements its own controller that speaks the documented JSON
  contract directly against its own MSSQL/whatever connection (Dapper,
  EF Core, raw ADO.NET — irrelevant to Better Tables). The React frontend
  uses the EXISTING, unmodified `httpAdapter({ url: '/api/tables/x' })`
  pointed at that controller's route. No `@better-tables/adapters-*`
  package, no Node process, is ever involved. This is the right default
  when the org already has a backend team who owns the DB access layer.
- **Option B (fallback)**: stand up a small Node/Bun sidecar service that
  imports `@better-tables/adapters-mssql` (plan 064) +
  `createAdapterRouteHandler`, running alongside (not instead of) the
  ASP.NET app, talking to MSSQL directly with its own scoped credentials.
  The frontend points `httpAdapter` at the sidecar instead of at ASP.NET.
  Use this when there's no bandwidth on the backend team to implement
  Option A, or when the JS-side adapter's relationship/facet/auto-column
  machinery is worth more than avoiding a second service. **This is a
  genuine team/infra decision, not something to resolve unilaterally in
  this plan** — write both options into the doc and let the adopting team
  choose; do not default the DOCS to only describing one.

Deliverables:

1. `packages/core/docs/ADAPTER_WIRE_PROTOCOL.md` — a protocol spec
   written for a reader who has never seen `http-protocol.ts`'s
   TypeScript. Contents: the JSON request shape per method (verbatim
   examples, not type signatures), the response envelope + status-code
   mapping, the THREE serialization rules (`Map`→entries, `Date`→ISO
   string, `AbortSignal` never sent), the `cellEdit` security model
   (server re-resolves the target column; a client can never redirect a
   write — spell out WHY, quoting the reasoning at `http-handler.ts:290-320`
   in plain language), the self-exclusion facet contract (from
   `adapter.ts:158-225`, restated for a non-TS reader), and BOTH
   deployment options above with an explicit "which one should we pick"
   decision checklist. Link it from `packages/core/README.md` (mirroring
   plan 035's `HTTP_ADAPTER.md` link pattern — check whether that file
   already exists at execution time and cross-link rather than
   duplicating; if `HTTP_ADAPTER.md` covers the JS-side usage and this new
   doc covers the wire format for non-JS implementers, keep them
   separate and cross-reference).
2. `packages/core/tests/adapters/wire-protocol-conformance.test.ts` — a
   BASE_URL-parameterized bun:test suite: when `WIRE_PROTOCOL_TEST_URL`
   is unset, it runs against an in-process reference server built from
   `createAdapterRouteHandler` + `memoryAdapter` (so the suite is always
   runnable in CI with zero external setup); when set, it runs the exact
   same assertions against an arbitrary external endpoint. This becomes a
   self-service compliance check: a team implementing Option A can run
   `WIRE_PROTOCOL_TEST_URL=https://their-endpoint bun test
   wire-protocol-conformance.test.ts` against THEIR ASP.NET controller and
   get a pass/fail on whether it's wire-compatible, without reading a line
   of this repo's adapter code. Cover: envelope shape for each method,
   `Map`-as-entries round trip, ISO-date round trip, `bad_request`/
   `forbidden`/`server_error` status mapping, and the `cellEdit`
   fail-closed-without-introspection case.

**Verify**: doc exists and is linked; conformance suite passes against
the in-process reference server; manually verify it also correctly FAILS
against a deliberately-wrong stub server (e.g. one that returns a raw
`Map` instead of entries) — proving the suite actually checks something.

### Phase 2: Foreign-key metadata — from boolean to a navigable target

Add an additive optional field to `InferredColumnSpec`
(`packages/core/src/types/adapter.ts:258-272`):

```ts
export interface InferredColumnSpec {
  // ...existing fields unchanged, including `foreignKey: boolean` for
  // back-compat...
  /**
   * When `foreignKey` is true and the target is resolvable, the specific
   * table + field it references — lets the UI render a navigable link
   * instead of just knowing "this is a foreign key."
   */
  foreignKeyTarget?: { table: string; field: string };
}
```

Wire it up in the Drizzle adapter's `describeColumns` implementation
(`packages/adapters/drizzle/src/drizzle-adapter.ts`, wherever
`InferredColumnSpec.foreignKey` is currently set from
`relationship-detector.ts`'s FK info) — it already computes the target
table/column internally to build the boolean; this just surfaces what it
already knows. No other adapter needs to change (the field is optional;
absence means "no navigation available," a safe default matching today's
behavior everywhere else).

**Verify**: a Drizzle-backed `describeColumns()` call on a column with a
real FK returns `foreignKeyTarget: { table: '...', field: '...' }`;
existing tests asserting `foreignKey: boolean` still pass unchanged.

### Phase 3: FK-click navigation in the UI

New optional prop on `BetterTableProps`:
`onNavigateToRelated?: (target: { table: string; id: string }) => void`.
When a resolved column carries `foreignKeyTarget` (Phase 2) AND this prop
is provided, render the cell value as a clickable link/button instead of
plain text; on click, resolve the specific related row's id from the
current row's data (using the same `relatedIdPath` concept
`CellWriteTarget` already models — reuse that resolution logic rather
than re-deriving it) and call `onNavigateToRelated`. The consumer decides
what navigation MEANS (route to another page, swap the mounted table in
a navigator — see Phase 5, open a side panel) — this stays a callback,
consistent with `onRowClick`'s existing pattern and the UI package's
deliberate framework-agnosticism (no router dependency).

**Verify**: a demo table with a FK column renders the value as a link
when `onNavigateToRelated` is passed, plain text when it's omitted
(back-compat); clicking calls back with the correct `{ table, id }`.

### Phase 4: Generic record form (create + full-row edit)

New component, e.g. `<RecordFormDialog>`, built from the same
`InferredColumnSpec[]`/`ColumnDefinition[]` the grid already uses — one
field per writable column, rendered via a shared field-editor extracted
from `packages/ui/src/components/table/editable-cell.tsx`'s existing
per-`ColumnType` editors (factor a `<FieldEditor columnType={...}>` used
by BOTH the inline cell editor and this new form, rather than duplicating
per-type rendering logic — this is a reuse opportunity, not new design
surface). Two modes: **create** (empty form, calls
`adapter.createRecord`) and **edit** (pre-filled from the current row,
calls `adapter.updateRecord`). Wire into `BetterTable` via the existing
`slots` seam (`table.tsx:125-138`) so apps can swap in their own form
without forking the table component, plus a sensible built-in default
(triggered from a new toolbar action or `onRowClick`, consumer's choice
— do not hardcode where the "Edit"/"New" trigger lives).

**Verify**: create a record through the dialog → it appears in the grid
after refetch; edit a record → all writable fields save correctly
(read-only/PK fields render disabled, not editable); validation errors
from `coerceCellValue`-style type checking surface inline, not as a
silent no-op.

### Phase 5: Table catalog / navigator

Add an optional adapter method (additive, mirrors `describeColumns`'s
shape):

```ts
listTables?(): Promise<Array<{ table: string; label: string; rowCountEstimate?: number }>>;
```

New UI component `<TableNavigator>`: calls `listTables()`, renders a
list/sidebar of tables, and on selection mounts a `<BetterTable>` for
that table using `t.auto()`/no-explicit-columns (the existing plan 054
path) — zero per-table code required by default. Each selected table gets
its own store entry in `table-registry.ts` (already supports many
concurrent named instances — no registry change needed, just correct
usage: key the store `id` by table name so switching tables doesn't leak
stale state, matching the existing "generation" remount guard at
`table.tsx:539-601` built for exactly this stale-schema class of bug).

**Verify**: a demo app with 3+ tables in its schema, one `<TableNavigator
adapter={...} />` — selecting each table renders a correctly-typed grid
with zero table-specific code in the demo page; switching tables twice
doesn't leak the previous table's columns/filters into the new one.

### Phase 6: Per-table configuration overrides

Document and wire the pattern (mostly composition over existing seams,
not new precedence rules — plan 054 already guarantees "declared values
always win" over inferred ones):

```ts
type TableOverrides = Record<string, {
  hidden?: boolean;
  readOnly?: boolean;
  label?: string;
  columnOverrides?: Partial<ColumnDefinition>[];
}>;
```

`<TableNavigator overrides={...} />` filters `hidden` tables out of the
list, passes `readOnly` through to disable the Phase 4 create/edit
triggers for that table, and merges `columnOverrides` on top of the
auto-resolved columns before passing them to `<BetterTable>` (same merge
semantics `resolveTableColumns` already implements internally for
explicit-vs-inferred — reuse that merge function rather than
reimplementing it for this new entry point).

**Verify**: a table marked `hidden` doesn't appear in the navigator; a
table marked `readOnly` shows the grid but no create/edit affordances; a
`columnOverrides` entry (e.g. renaming a label, hiding a column) is
visibly applied without touching the adapter's `describeColumns` output.

### Phase 7: Docs + dogfood demo

New marketing example (mirroring plan 029's "marketing showcase dogfood"
pattern): a small multi-table demo schema (reuse or extend the existing
`apps/marketing/src/lib/demo/` fixtures if they already cover 3+
related tables) wired through `<TableNavigator>` with at least one
`hidden`/`readOnly`/`columnOverrides` entry exercised, one FK column that
navigates, and the record-form dialog wired for create + edit. Docs pages
for each new piece (`docs/adapters` gets the wire-protocol doc link from
Phase 1; a new `docs/admin-ui` or similar section covers the navigator/
record-form/FK-navigation trio).

**Verify**: `cd apps/marketing && bun run dev` — manually exercise the
demo end-to-end (browse tables, click a FK link, create a record, edit a
record, confirm a hidden table is absent) before marking this plan done;
this is exactly the kind of change the top-level engineering guidance
requires verifying in a real browser, not just via typecheck/tests.

## Test plan

- Phase 1: the conformance suite itself (self-parameterized, doubles as
  both an internal test and an external tool).
- Phase 2: existing Drizzle `describeColumns` tests extended with the new
  field; no removal of existing assertions.
- Phases 3-6: new `packages/ui` component tests following the existing
  patterns in that package (see plan 042's ~91-test baseline for style);
  Playwright/manual verification for the Phase 7 end-to-end dogfood (UI
  integration E2E is otherwise deferred per plan 043 — this plan doesn't
  reopen that decision, it just requires manual browser verification for
  ITS OWN new surface before calling Phase 7 done).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/core/docs/ADAPTER_WIRE_PROTOCOL.md` exists, documents both
  deployment options, and is linked from `packages/core/README.md`
- [ ] Wire-protocol conformance suite passes against the in-process
  reference server and demonstrably fails against a deliberately
  non-compliant stub
- [ ] `InferredColumnSpec.foreignKeyTarget` is additive — existing
  `foreignKey: boolean` consumers unaffected; Drizzle adapter populates it
- [ ] FK-column values render as navigable links only when
  `onNavigateToRelated` is provided (back-compat preserved otherwise)
- [ ] `<RecordFormDialog>` supports create + edit, reuses
  `editable-cell.tsx`'s per-type editors (grep confirms no duplicated
  per-`ColumnType` render logic)
- [ ] `<TableNavigator>` renders a working multi-table demo with zero
  per-table hand-written columns
- [ ] Per-table `hidden`/`readOnly`/`columnOverrides` all visibly work in
  the dogfood demo
- [ ] `bun run build` + `bun run typecheck` + all package test suites
  green
- [ ] Dogfood demo manually verified in a real browser (Phase 7) — not
  just typecheck/tests
- [ ] No changeset files created; Conventional Commit types used
  throughout; `plans/README.md` updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any change here would require modifying `http-protocol.ts`'s actual
  wire shapes — that file is frozen post-publish (plan 035); Phase 1
  documents current behavior, it never changes it.
- Reusing `editable-cell.tsx`'s per-type editors for the Phase 4 form
  turns out to require a larger refactor than a thin `<FieldEditor>`
  extraction — report the actual coupling found rather than duplicating
  the editors "just for now."
- The Phase 5 `listTables?()` addition to `TableAdapter` turns out to
  need something beyond `{ table, label, rowCountEstimate? }` to be
  useful (e.g. schema/grouping info) — propose the specific extension
  before landing it; don't over-design speculatively.
- The dogfood demo (Phase 7) can't be manually verified in a real browser
  in this environment — say so explicitly rather than claiming the
  feature works based on tests alone (per this repo's own UI-verification
  standard).

## Maintenance notes

- Phase 1's conformance suite is the durable artifact here — as the wire
  protocol gains new methods (unlikely, given the frozen-post-publish
  policy, but plan for it), extend the suite first, the doc second.
- The `foreignKeyTarget` field (Phase 2) should eventually be populated by
  plan 064's MSSQL adapter and any future Prisma/Kysely adapter's
  `describeColumns` — treat it as a standard part of the schema-
  introspection contract going forward, not a Drizzle-only add-on.
- If a real ASP.NET (or other non-JS) implementation of Option A gets
  built by an actual consumer, capture its experience running the Phase 1
  conformance suite against their endpoint as a case study in the docs —
  that's the strongest possible validation this protocol is genuinely
  language-agnostic, stronger than anything this plan can prove alone.
