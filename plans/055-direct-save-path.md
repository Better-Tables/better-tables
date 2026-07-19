# Plan 055: Zero-boilerplate saves — `cellEditAction()` for monoliths (primary) + opt-in HTTP write proxy (split deployments)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md` unless
> a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat a8ea4f4..HEAD -- packages/core/src packages/ui/src/hooks/use-editable-cells.ts packages/ui/src/components/table apps/marketing/src`
> This plan assumes plan 053 (`editable-cells`, tip `a8ea4f4`) is merged to
> main FIRST, and plan 054 ideally before it (the HTTP proxy consumes
> `describeColumns`). If 053 isn't merged, STOP.

## Status

- **Priority**: P2 (Wave C — the "magic DX" pillar 2)
- **Effort**: L
- **Risk**: MED (write-path security; a deliberate boundary reversal on the wire)
- **Depends on**: 053 merged (hard). 054 (soft — the HTTP proxy's
  schema-derived allow-list; the action half has no 054 dependency).
- **Category**: direction / feature / security
- **Planned at**: `editable-cells` tip `a8ea4f4`, 2026-07-18
- **Maintainer decisions (2026-07-18)**, binding:
  1. **The PRIMARY story is the monolith** (Next.js, TanStack Start): the
     table works DIRECTLY with the mounted adapter/instance — no API routes,
     no fetch shims. The `httpAdapter` is ONLY for genuinely separated
     frontend/backend deployments, and docs/examples must present it that
     way. The marketing editable example uses the DIRECT path, not
     `httpAdapter`.
  2. **HTTP write proxy: opt-in on both sides** (`writes: true` on the route
     handler AND on `httpAdapter`), with the server deriving the writable
     field allow-list FROM THE SCHEMA (never the client), coercing wire
     values by column type, running the existing `authorize`/
     `constrainRequest` seams, and dev-warning when writes are enabled
     without `authorize`. This reverses the 053-era "writes are never
     proxied" boundary — deliberately, and only under double opt-in.

## Why this matters

Plan 053 made cells editable, but its dogfood exposed the boilerplate tax:
in a Next.js monolith the demo needed a ~45-line hand-written POST route
(JSON parsing, id/field validation, a hand-maintained `ALLOWED_FIELDS` set,
manual ISO→Date coercion, error mapping) plus a client fetch helper wired
into `onCellEdit` — for EVERY editable table. That's exactly the boilerplate
Better Tables exists to delete, and everything the route does by hand is
derivable from the table definition: which fields are editable (the columns
with `.editable()`), how to coerce each value (the column's type), and how to
persist (the instance's typed `updateRecord`). This plan collapses all of it
into one generated function — `tables.cellEditAction(ticketsTable)` — that
the app exports through its framework's server boundary (a `'use server'`
one-liner in Next; `createServerFn` in TanStack Start), and the table calls
via a new serializable `saveAction` prop. Result: `.editable()` on a column
plus one exported action = working inline editing. For the minority case
where frontend and backend are truly separate, the same validation/coercion
core backs an opt-in write proxy on the existing HTTP transport.

## Current state

Verified at `a8ea4f4` (053 implemented) unless noted.

**The boilerplate to delete** (053's dogfood, all on the branch):
- `apps/marketing/src/app/api/tables/tickets/update/route.ts` (45 lines):
  hand-rolled body validation, `ALLOWED_FIELDS = new Set(['subject',
  'status', 'slaBreached', 'createdAt'])`, manual
  `field === 'createdAt' && typeof value === 'string' ? new Date(value) : value`
  coercion, `tables.updateRecord(ticketsTable, id, { [field]: value })`,
  error mapping.
- `apps/marketing/src/lib/demo/support/ticket-cell-edit.ts` (23 lines): the
  client fetch shim, wired as `onCellEdit={useCallback(persistTicketCellEdit, [])}`
  in `tickets-table-client.tsx`, `facets-table-client.tsx`,
  `query-groups-table-client.tsx`.

**The save pipeline this extends** (`packages/ui/src/hooks/use-editable-cells.ts`, branch):
- `CellEditContext` carries NON-serializable members (`row: TData`,
  `column: ColumnDefinition`) — right for client callbacks, unusable across
  a server-action boundary (server actions need serializable args).
- Save resolution today: `onCellEdit` (callback) → adapter
  (`features.update` + `updateRecord` + field/rowId resolvable) → read-only.
  Field mapping: `resolveEditableField(column.id, config)` — `config.field`
  override, else dot-free id IS the field, else null (`:79-90`).
- `UseEditableCellsOptions` already threads `adapter`, `tableName`,
  `onCellEdit`, `onCellEditError`, `editing`.

**The write surface the action wraps** (main, 047):
- `instance.updateRecord(tableDef, id, data)` — validates adapter support,
  injects `{ table }`; adapter contract
  `updateRecord?(id, data, options?: MutationOptions)`.

**The wire pieces the proxy extends** (main, 035/041/054):
- `http-protocol.ts`: `AdapterMethod` = 4 read methods (+ `describeColumns`
  after 054); failure envelope carries `kind: 'bad_request' | 'server_error'`.
- `http-handler.ts`: `AdapterRouteHandlerOptions { authorize?, constrainRequest?, onError? }`;
  authorize-false → 403 (`:216-224`); status mapping 400/403/500.
- `http-adapter.ts`: `httpAdapter(config)` — reads only;
  `defaultHttpAdapterMeta()` advertises `update: false`; facet reads go
  through `sendCacheable` (041), `fetchData` through uncached `send`.
- 054 adds `describeColumns` (`InferredColumnSpec.writable`, `columnType`) —
  the proxy's server-side allow-list and coercion table.

**Framework note (for docs, verified conceptually, not in-repo)**: Next.js
server actions are plain async functions exported from a `'use server'`
module and are passable as props to client components; TanStack Start's
`createServerFn` wraps a plain async function similarly. `cellEditAction`'s
product is exactly such a plain async function — the library ships NO
framework-specific code.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Core tests | `cd packages/core && bun test` | pass |
| UI tests | `cd packages/ui && bun test` | pass |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bunx biome check .` | 0 errors |
| Demo | `cd apps/marketing && bun run dev` | editable example saves with NO custom route |

## Scope

**In scope**:
- `packages/core/src/factory.ts` + `types/factory.ts` —
  `instance.cellEditAction(tableDef)` + `CellEditActionInput`/`CellEditActionResult`
  types (exported from core's index)
- A shared validation/coercion core (small module in core, e.g.
  `src/lib/cell-edit-core.ts`) used by BOTH the action and the HTTP proxy
- `packages/ui/src/hooks/use-editable-cells.ts` + `table.tsx`/
  `virtualized-table.tsx` — new `saveAction` prop in the save resolution
- `packages/core/src/adapters/http-protocol.ts`, `http-handler.ts`,
  `http-adapter.ts` — opt-in `updateRecord` proxying
- `apps/marketing` — DELETE the custom route + fetch shim; add the
  `'use server'` action file; rewire the three client components
- Tests across core/ui (+ http tests); `.changeset/*.md`; docs
  (`HTTP_ADAPTER.md`, wiki editable section persistence matrix);
  `packages/cli/src/lib/file-operations.ts` manifest if ui files change;
  `plans/README.md`

**Out of scope**:
- `createRecord`/`deleteRecord` proxying or actions (update-only in v1;
  record as follow-up).
- A full server-actions DATA bridge (reads stay as they are — this
  un-defers ONLY the cell-edit action, not the whole RSC bridge decision).
- Bulk edit, conflict detection (last-write-wins stands, documented).
- One-to-many relationship columns (aggregated arrays) — never cell-editable.

## Joined-table editing (maintainer requirement, 2026-07-18 — SUPERSEDES 053's dot-id restriction)

Editable must work on joined tables: a dot-id column like
`t.text('customer.company').editable()` on the tickets table edits the
RELATED customer row. 053's "dot-ids are not adapter/action-saveable" rule is
replaced by the following design. Verified raw material:
`resolveColumnPath(columnId, primaryTable)` returns a `ColumnPath`
(`packages/adapters/toolkit/src/types.ts:53-68`) with `table` (path alias),
`field`, `isNested`, and `relationshipPath` whose LAST entry's `to` is the
REAL related table key; the transformer distinguishes single-valued
(many-to-one/one-to-one → `processColumn` nested object) from one-to-many
(array) paths.

Design:

1. **New optional adapter capability** (core contract, beside
   `describeColumns`):
   ```ts
   export interface CellWriteTarget {
     /** JS schema key of the table the write lands in. */
     table: string;
     /** Storage field on that table. */
     field: string;
     /** Row-data path to the target row's id (e.g. 'customer.id'), or null for own-table. */
     relatedIdPath: string | null;
     /** False for one-to-many paths — never cell-editable. */
     single: boolean;
     /** Schema-level writability (PK/unknown → false). */
     writable: boolean;
   }
   resolveCellWriteTarget?(columnId: string, table?: string): Promise<CellWriteTarget | null>;
   ```
   Drizzle implements it: flat id → own table/field; dot id → via the
   relationship manager's `ColumnPath` (real table from
   `relationshipPath[last].to`, alias for `relatedIdPath` =
   `<alias>.<relatedPkName>`, `single` from the relationship kind), memoized.
   Proxied over the wire as a READ (like `describeColumns`, cached).
2. **Projection guarantee**: an editable dot-column's save needs the related
   row's PK in the row data. VERIFY whether the adapter's
   projection/auto-embed already includes related PKs in nested output; if
   not, make the drizzle adapter always project the related table's PK
   whenever any column of that relation is requested. STOP if that proves
   invasive.
3. **Policy** (`buildCellEditPolicy`) becomes adapter-aware and async:
   `buildCellEditPolicy(def, adapter)` — for each editable column it
   resolves the `CellWriteTarget` (own-table columns resolve locally without
   the adapter; dot columns require the capability, else that column is
   callback-only as before). It rejects `single: false` and
   `writable: false` targets at build time (dev warn naming the reason).
4. **Save execution**: the target row id for a dot column comes from the row
   data at `relatedIdPath` (`row.customer?.id`); a null related object makes
   that row's cell read-only. Adapter path:
   `adapter.updateRecord(targetId, { [target.field]: value }, { table: target.table })`
   (047's explicit-table form). Action/wire path: the input's `field` is the
   COLUMN id (e.g. `'customer.company'`) and `id` is the TARGET row id; the
   POLICY re-resolves column→(table, field) server-side — the client can
   never redirect a write to a table/field that no editable column exposes.
   Row-level authorization remains the app's concern (authorize seam /
   action wrapper), same trust model as flat edits — document this.
5. **HTTP proxy**: the wire write carries `{ id, field: columnId, value }`
   (cell-oriented, singular) rather than a free-form data record, so the
   server-side policy mapping applies identically. `writes: true | { columns: string[] }`
   — the object form narrows the allow-list to the app's actual editable
   columns (the handler has no TableDefinition; schema-writable alone is
   broader than app-editable — document the recommendation to pass the
   explicit column list).
6. **UI**: `resolveEditableField`'s dot-id → null rule is replaced by
   CellWriteTarget resolution (lazy, memoized per column via the adapter
   capability; saveAction-present columns skip client-side resolution and
   defer to the server policy). Editable gating adds: dot column + no
   capability + no saveAction/onCellEdit → read-only with the existing
   one-per-column dev warn.

## Git workflow

- Branch: `direct-save-path`; commits `Plan 055 Step N: <summary>`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The shared validation/coercion core

New `packages/core/src/lib/cell-edit-core.ts`:

```ts
export interface CellEditActionInput {
  id: string;
  field: string;
  value: unknown; // wire-safe: string | number | boolean | null (dates as ISO strings)
}
export type CellEditActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

/** Allow-list + coercion table derived ONCE from a table definition. */
export function buildCellEditPolicy(def: TableDefinition<...>): CellEditPolicy;
```

`buildCellEditPolicy` walks `def.columns` and admits exactly the columns
that are editable-and-adapter-saveable under 053's rules (has `editable`,
`when`-independent, field resolvable via the same `resolveEditableField`
logic — move/share that function here from `use-editable-cells.ts` so there
is ONE implementation; ui imports it from core). Per admitted field it
records the column type and a coercer: `date` → ISO-string/epoch → `Date`
(reject invalid); `number` → reject non-finite; `boolean` → require boolean;
`option` → if the column declares/infers options, value must be one of them;
`text` family → require string/null. It also runs the column's
`ValidationRule`s. Unknown field, non-editable field, or failed
coercion/validation → a typed rejection with a safe message.

**Verify**: core unit suite for the policy: admitted-field set matches the
def; each coercion happy/reject case; validation rules run; unknown field
rejected. `cd packages/core && bun test` green (including the existing
053 suites after the `resolveEditableField` move — ui must still pass).

### Step 2: `tables.cellEditAction(tableDef)`

On the instance (follow 047's method-wiring pattern in `factory.ts`):

```ts
instance.cellEditAction = (tableDef) => {
  const policy = buildCellEditPolicy(tableDef); // built once, closed over
  return async (input: CellEditActionInput): Promise<CellEditActionResult> => {
    const check = policy.check(input);           // allow-list + coerce + validate
    if (!check.ok) return { ok: false, error: check.error };
    try {
      const data = await instance.updateRecord(tableDef, input.id, {
        [check.field]: check.value,
      });
      return { ok: true, data };
    } catch (error) {
      // server-side detail, generic client message (035 policy)
      console.error('[better-tables] cellEditAction failed:', error);
      return { ok: false, error: 'Save failed.' };
    }
  };
};
```

The returned function is a PLAIN async function over serializable
input/output — exportable from a `'use server'` module (Next) or wrappable
in `createServerFn` (TanStack Start) with zero library involvement. Type it
so `value` on the wire is the serialized form while the policy owns
re-hydration (dates arrive as ISO strings — the coercer converts).

**Verify**: core tests with a stub adapter: allowed field saves through
`updateRecord` with the coerced value (ISO string in → `Date` out for a date
column); disallowed/unknown field → `{ ok: false }` and `updateRecord` NEVER
called; adapter throw → generic error, detail logged; a type test that the
input/result types are serializable-shaped (no functions/classes).

### Step 3: `saveAction` in the UI save resolution

In `use-editable-cells.ts` (+ thread through `BetterTable` and
`VirtualizedTable` props): new optional
`saveAction?: (input: CellEditActionInput) => Promise<CellEditActionResult>`.

Save resolution ORDER becomes: `onCellEdit` (rich client callback — full
control) → **`saveAction`** (serializable boundary-crossing) → direct
adapter → read-only. For `saveAction`: serialize the value (Date →
`toISOString()`), await; `{ ok: false, error }` triggers the SAME rollback +
cell-error path as an adapter rejection (053's optimistic semantics
unchanged); `{ ok: true }` confirms the overlay. A column is
editable-resolvable when a saveAction is present even if the adapter can't
write (mirrors the existing onCellEdit rule).

**Verify**: ui hook tests: saveAction success confirms; `{ok:false}` rolls
back + sets error + fires `onCellEditError`; Date serialization on the way
out; precedence (onCellEdit beats saveAction beats adapter); editability
gating counts saveAction as a save path. Existing 053 suites and the
025/041 perf-locks unchanged.

### Step 4: Opt-in HTTP write proxy (split deployments)

- `http-protocol.ts`: add the CELL-ORIENTED write body (see the
  joined-table section — a singular cell edit, not a free-form record):
  `{ method: 'cellEdit'; id: string; field: string /* the COLUMN id, may be dotted */; value: unknown; table?: string }`.
- `http-handler.ts`: `AdapterRouteHandlerOptions.writes?: boolean | { columns: string[] }`
  (default absent = disabled; the object form narrows to the app's actual
  editable columns — RECOMMEND it in docs). A `cellEdit` body with writes
  disabled → 403-mapped `bad_request`
  (`'Writes are not enabled on this endpoint.'`). With writes enabled: run
  `authorize`/`constrainRequest` as usual, then the server-side policy —
  resolve the column via `adapter.resolveCellWriteTarget` (joined section;
  fail closed when absent), reject unknown/`writable: false`/`single: false`
  targets and columns outside the `writes.columns` narrowing, coerce by
  column type (reuse the Step 1 coercers — export them field-agnostically
  from `cell-edit-core`), then
  `adapter.updateRecord(id, { [target.field]: value }, { table: target.table })`.
  Dev-mode `console.warn` ONCE when writes are enabled without `authorize`.
- `http-adapter.ts`: `HttpAdapterConfig.writes?: boolean`. When true:
  implement `updateRecord` (uncached `send`, like `fetchData`) and flip
  `defaultHttpAdapterMeta().features.update` to true. When absent/false:
  today's read-only shape, byte-identical.

**Verify**: http tests (loopback pattern): writes-disabled → 403 + adapter
never called; enabled + unknown/unwritable field → rejected; enabled + valid
→ adapter receives coerced values (ISO → Date); authorize runs before the
write; client without `writes` still advertises `update: false`; dev-warn
fires once. `bun run typecheck` exit 0.

### Step 5: Rewire the dogfood to the DIRECT path

In `apps/marketing`:
1. DELETE `src/app/api/tables/tickets/update/route.ts` and
   `src/lib/demo/support/ticket-cell-edit.ts`.
2. Add `src/lib/demo/support/actions.ts`:
   ```ts
   'use server';
   import { getSupportTables } from './db';
   import { ticketsTable } from './columns';
   export async function saveTicketCell(input: CellEditActionInput) {
     const tables = await getSupportTables();
     return tables.cellEditAction(ticketsTable)(input);
   }
   ```
   (The lazy `getSupportTables` keeps the native binding out of module scope
   — same finding-13 rule as the read routes. If building the policy per
   call measures as wasteful, memoize the bound action in module scope
   behind the promise — but correctness first.)
3. In the three `*-table-client.tsx` components: replace
   `onCellEdit={...persistTicketCellEdit...}` with
   `saveAction={saveTicketCell}`.
4. Update the route-file comment trail: the editable demo now has ZERO
   custom API surface for writes; reads keep their existing wiring.

**Verify**: `grep -rn "ticket-cell-edit\|api/tables/tickets/update" apps/marketing/src`
→ no matches. Dev server: edit subject (text), status (dropdown),
slaBreached (toggle), createdAt (calendar) → values persist across a
filter-away-and-back refetch; a disallowed edit (craft a saveAction call
with field `id` from the console) → `{ ok: false }`, no write. Report the
observations.

### Step 6: Docs, changesets, gates

1. Wiki editable section: a **persistence-paths matrix** — (1) Monolith
   (RECOMMENDED, primary): `cellEditAction` + `'use server'` one-liner /
   `createServerFn`; (2) split frontend/backend: `httpAdapter` +
   `writes: true` both sides + authorize; (3) full control: `onCellEdit`.
   State explicitly: httpAdapter is for separated deployments only — in a
   monolith prefer the direct path.
2. `HTTP_ADAPTER.md`: writes section (double opt-in, schema allow-list,
   coercion, authorize warning, 403 semantics).
3. Changesets: core minor (`cellEditAction`, `saveAction` types, protocol
   `updateRecord`, handler/adapter `writes`), ui private (none).
4. Full gates: root typecheck, all package suites, `bunx biome check .`
   0 errors; CLI manifest updated if ui files were added.

**Verify**: gates green; `plans/README.md` row updated.

## Test plan

- Core: policy suite (allow-list/coercion/validation), action suite
  (save/reject/error mapping), serializability type test, **joined-target
  policy cases** (dot column resolves table/field via the capability;
  one-to-many rejected; client cannot redirect to an unexposed table/field).
- UI: saveAction resolution/rollback/precedence; dot-column editability
  gating (related id present/absent, null related object → read-only row);
  053 + perf-lock suites unchanged.
- HTTP: writes-gating (boolean + `{columns}` narrowing), allow-list,
  coercion, authorize ordering, meta flip, dev-warn-once, fail-closed
  without `resolveCellWriteTarget`.
- Integration: extend 043's harness — a real-adapter `cellEditAction`
  round-trip, AND a **joined edit**: the sqlite fixture already joins two
  tables; edit a related-table field from the primary table's grid and
  assert the RELATED table's row changed in the database (and the primary
  table's row did NOT).
- Patterns: 047's typed-write tests, 035's loopback tests, 053's hook suite.

## Done criteria

- [ ] `tables.cellEditAction(def)` exists; policy derives the allow-list from `.editable()` columns; core suites green incl. coercion + never-call-on-reject
- [ ] ONE `resolveEditableField` implementation (core), imported by ui — `grep -rn "resolveEditableField" packages/ui/src packages/core/src` shows a single definition
- [ ] `saveAction` prop wired through both table components with rollback/precedence tests green
- [ ] Wire `updateRecord` exists behind DOUBLE opt-in; disabled-path byte-compatible (`features.update` false without the flag); all Step-4 tests green
- [ ] Marketing: custom update route + fetch shim DELETED; `'use server'` action wired in all three clients; browser round-trip reported
- [ ] **Joined-table editing proven**: a dot-id column (e.g. a customer field on the tickets table) is editable end-to-end — integration test asserts the related table's row changed and the primary row didn't; the demo includes one joined editable column; one-to-many columns remain read-only (test)
- [ ] Persistence-paths matrix in wiki; HTTP_ADAPTER.md writes section; core minor changeset
- [ ] Root `bun run typecheck` exit 0; all suites green; `bunx biome check .` 0 errors
- [ ] `plans/README.md` row updated

## STOP conditions

- Next's server-action serialization rejects the action's input/result shape
  as designed (e.g. `undefined` in results under `exactOptionalPropertyTypes`
  conventions) — adjust the SHAPE, not the security (never widen to
  non-validated passthrough), and report.
- Building the policy requires ui-only knowledge that can't move to core
  without a dependency inversion — report the coupling before restructuring.
- The write proxy can't get a schema allow-list because the adapter lacks
  `describeColumns` (054 not landed / non-drizzle adapter): writes for that
  adapter must FAIL CLOSED (`bad_request`, "adapter cannot validate writes")
  — never fall back to trusting the client. If that makes the proxy useless
  for a real adapter, report.
- Deleting the demo route breaks a test that asserted its behavior — port
  the assertion to the action, don't resurrect the route.

## Maintenance notes

- `createRecord`/`deleteRecord` actions + proxying are the natural
  follow-up, on the same policy core — record as backlog when this lands.
- Plan 049's future `beforeSave`/`afterSave` hooks should wrap
  `cellEditAction`'s updateRecord call — the policy/action split was shaped
  for that.
- Reviewer scrutiny: the policy is the security boundary for BOTH paths —
  verify no code path reaches `updateRecord` without passing it, and that
  the HTTP proxy fails closed without `describeColumns`.
