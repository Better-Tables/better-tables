# Plan 047: Typed, explicit-table write surface on the instance (createRecord/updateRecord/deleteRecord)

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index. This is a
> DESIGN + BUILD plan for a new public surface — if the design decisions
> below turn out not to fit the shipped types, STOP and report rather than
> improvising the API shape.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/factory.ts packages/core/src/types/factory.ts packages/core/src/types/adapter.ts packages/adapters/drizzle/src/drizzle-adapter.ts plans/design/core-contract-v2.md`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (widens the write interface; ships in the 0.6 breaking window)
- **Depends on**: 018 (done — instance API + `TableNamesOf`/`RowOf`), 002 (done — mutation routing safety)
- **Category**: direction / migration
- **Planned at**: commit `787a816`, 2026-07-17
- **Maintainer decision (2026-07-17)**: build this **into the 0.6 train** so
  the write API never needs a two-step migration. Target table is an
  **explicit, schema-checked parameter**, replacing the interim
  "first schema table" heuristic at the instance level. Shape per
  `plans/design/core-contract-v2.md:565-599` open question (d).

## Why this matters

Reads got a table-scoped, typed instance surface in plan 030
(`tables.fetchData(table, params)` injects `primaryTable`, returns the
table's own row type). Writes did NOT: the adapter's `createRecord?(data)` /
`updateRecord?(id, data)` / `deleteRecord?(id)` take no table and rely on
plan 002's `defaultMutationTable` heuristic (safe — it throws on ambiguity —
but implicit). The design doc's decision (d) is to make writes symmetric with
reads: `createRecord(table, data)` etc., keyed off the same `TableNamesOf`/
`RowOf` machinery, so the target is a compile-time decision and the heuristic
is removed at the instance level. The breaking window is the moment to do it.

## Current state

Verified at `787a816`:

- Adapter write contract, `packages/core/src/types/adapter.ts`:
  `:366` `createRecord?(data: Partial<TData>): Promise<TData>`;
  `:382` `updateRecord?(id: string, data: Partial<TData>): Promise<TData>`;
  `:395` `deleteRecord?(id: string): Promise<void>`;
  `:411` `bulkUpdate?(ids, data)`; `:424` `bulkDelete?(ids)`.
- Instance (`packages/core/src/factory.ts`): only READ methods are wired on
  the instance (`fetchData`, `getFacetedValues`, `getMinMaxValues`,
  `getFilterOptions`, `:103-170`) — no instance write methods exist yet.
  `asTableAdapter` (`:150+`) is the audited erasure bridge to the real
  adapter. `TableNamesOf`/`RowOf` are exported (`:249`).
- Drizzle mutation routing: `resolveMutationTable` +
  `defaultMutationTable` escape hatch (plan 002), in `drizzle-adapter.ts`
  (`:907-982` region).
- Design sketch: `plans/design/core-contract-v2.md:565-599` — the
  table-keyed write signatures.
- Release policy: 0.6 is the breaking slot; changesets use `minor`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Core tests | `cd packages/core && bun test` | pass |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | SQLite green |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/core/src/types/factory.ts` (instance write method types, keyed by
  `TableNamesOf`/`RowOf`)
- `packages/core/src/factory.ts` (wire instance `createRecord`/`updateRecord`/
  `deleteRecord`, injecting the resolved table)
- `packages/core/src/types/adapter.ts` (adapter write contract — decide
  whether the low-level method gains a table param or the instance resolves
  table→adapter; see Step 1)
- `packages/adapters/drizzle/src/drizzle-adapter.ts` (honor an explicit
  table target from the instance)
- `MIGRATION.md` (new write-API section), `.changeset/*.md`, core + drizzle
  tests, `plans/README.md`

**Out of scope**:
- Removing `defaultMutationTable` from the adapter (the low-level adapter can
  keep a single-table form internally — the design doc says the instance-level
  API is the table-keyed one; the exact split is decided in Step 1).
- Bulk write ergonomics beyond mirroring the single-record shape (note as
  follow-up if large).
- Reads (already done).

## Git workflow

- Branch: `typed-write-surface`; commits `Plan 047 Step N: …`.

## Steps

### Step 1: Decide the adapter-vs-instance split (design, then lock)

Two coherent options — pick one and record it in the plan's report:
- **(A) Instance resolves, adapter unchanged**: the instance's
  `createRecord(table, data)` maps `table` → the adapter's existing
  single-table write by setting the mutation target (e.g. passing the table
  through a params object the adapter already understands, mirroring how
  `fetchData` injects `primaryTable`). Smallest adapter change.
- **(B) Adapter write contract gains a table param**: `createRecord?(table, data)`
  on `TableAdapter`, drizzle honors it, `defaultMutationTable` becomes a
  fallback only. Cleaner long-term, wider blast radius.
Recommendation: **(A)** for 0.6 (least risk, keeps the low-level single-table
form), exposing the table-keyed API at the instance level as the design doc
specifies. Confirm the adapter has a param seam to carry the target (like
`primaryTable` for reads); if it does NOT, that pushes toward (B) — STOP and
report before widening the contract.

**Verify**: write the chosen signatures as types first; `bun run typecheck`
compiles the type-level surface (methods can be stubbed to `throw` at this
step).

### Step 2: Instance write types

In `packages/core/src/types/factory.ts`, add to `BetterTablesInstance`:

```ts
createRecord<TName extends TableNamesOf<TAdapter>>(
  table: TName, data: Partial<RowOf<TAdapter, TName>>
): Promise<RowOf<TAdapter, TName>>;
updateRecord<TName extends TableNamesOf<TAdapter>>(
  table: TName, id: string, data: Partial<RowOf<TAdapter, TName>>
): Promise<RowOf<TAdapter, TName>>;
deleteRecord<TName extends TableNamesOf<TAdapter>>(table: TName, id: string): Promise<void>;
```

(Use the same generic machinery the read methods use; the `table` arg may be
a `TableDefinition` like the read surface, or a table-name key — match the
READ surface's convention so writes and reads look symmetric. Check whether
`tables.fetchData` takes a `TableDefinition` or a name and mirror it.)

**Verify**: `bun run typecheck` → exit 0; add a type test that a wrong-table
key / wrong-shape `data` is a compile error.

### Step 3: Instance write implementation

Wire the three methods in `factory.ts` through `asTableAdapter`, injecting the
resolved table target per Step 1's choice. Keep the single audited erasure
pattern the read methods use.

**Verify**: `cd packages/core && bun test` → pass; add a runtime test with a
stub adapter asserting the correct table target is passed for each method.

### Step 4: Drizzle honors the explicit target

Ensure `drizzleAdapter`'s write path uses the instance-provided table target
over the `defaultMutationTable` heuristic when present (option A: read the
injected target; option B: the new param). `defaultMutationTable` remains the
fallback for direct adapter callers.

**Verify**: `cd packages/adapters/drizzle && bun test` — add SQLite tests:
`tables.createRecord('tickets', {...})` inserts into tickets even in a
multi-table schema; wrong table shapes rejected at compile time (type test).

### Step 5: MIGRATION + changeset + gates + ledger

- `MIGRATION.md`: new section — instance writes now take an explicit table;
  show before (implicit) → after (`tables.createRecord(table, data)`).
- Changeset for `@better-tables/core` (minor) + `@better-tables/adapters-drizzle`
  (minor if its contract changed under option B; patch under A).
- Mark `core-contract-v2.md` open question (d) resolved. Full gates; update
  plan 047 row.

## Test plan

- Core: type tests (wrong table / wrong data → compile error); runtime stub
  tests (correct target passed per method).
- Drizzle: SQLite insert/update/delete against the explicit table in a
  multi-table schema; compile-time rejection type tests.
- Patterns: plan 030's table-scoped read tests (`factory.test.ts` +
  drizzle multi-table suites) — mirror them for writes.

## Done criteria

- [ ] `BetterTablesInstance` exposes `createRecord`/`updateRecord`/`deleteRecord` keyed by `TableNamesOf`/`RowOf`; wrong-table/wrong-data are compile errors (type tests pass)
- [ ] Instance writes route to the correct table in a multi-table schema (runtime tests pass)
- [ ] Drizzle honors the explicit target over `defaultMutationTable`; `defaultMutationTable` still works for direct adapter callers
- [ ] `MIGRATION.md` documents the write API; `core-contract-v2.md` (d) marked resolved
- [ ] Changesets exist; `bun run typecheck` exit 0; core + drizzle SQLite tests pass
- [ ] `plans/README.md` updated

## STOP conditions

- The adapter has no param seam to carry a write target (forcing option B's
  contract change) AND widening `TableAdapter`'s write methods breaks other
  adapters/tests — STOP and get a maintainer call on A-vs-B before proceeding.
- The read surface takes a `TableDefinition` but writes can't cleanly reuse it
  (e.g. row-type inference differs) — report the asymmetry before shipping a
  mismatched write API.
- This can't land before the 0.6 publish without rushing — flag it: the whole
  point is to be inside the breaking window, so a slip means re-deciding with
  the maintainer.

## Maintenance notes

- Bulk writes (`bulkUpdate`/`bulkDelete`) should get the same table-keyed
  treatment in a fast-follow — note it if not done here.
- This removes the last implicit-table behavior from the instance surface;
  reviewers should confirm no instance method still relies on "first table".
- Reviewer scrutiny: Step 1's A-vs-B choice and that `defaultMutationTable`
  remains a working fallback for low-level adapter consumers.
