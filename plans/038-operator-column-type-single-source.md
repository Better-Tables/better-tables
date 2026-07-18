# Plan 038: Single-source the operator and column-type tables (kill the 4-way drift)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row in `plans/README.md` unless a reviewer
> told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/types/filter-operators.ts packages/core/src/types/column.ts packages/adapters/toolkit/src/filter-router.ts packages/adapters/drizzle/src/drizzle-adapter.ts packages/core/src/builders/option-column-builder.ts packages/core/src/adapters/http-adapter.ts packages/core/src/builders/build-filter.ts packages/core/src/utils/type-guards.ts`
> On any change to an in-scope file, compare the "Current state" excerpts to
> the live code before proceeding; on a mismatch, treat it as a STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (the router change alters which filters pass the SQL gate)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `787a816`, 2026-07-17
- **Maintainer decision (2026-07-17)**: canonical option-equality spelling is
  **`is` / `isNot`** (matches core's `FILTER_OPERATORS`, the option builder's
  defaults, and the UI dropdown). Adapters conform to core, not the reverse.

## Why this matters

"Which operators apply to column type X" is encoded in **four** places that
have already drifted, and "the set of column types" in **four** more:

- Canonical operators: `packages/core/src/types/filter-operators.ts`
  (`FILTER_OPERATORS`, exposed via `getOperatorsForType()`). The UI already
  derives from it (`filter-operator-select.tsx`).
- A hardcoded copy in the toolkit router (`filter-router.ts`
  `getSupportedOperators`) — this is the **live validation gate**.
- A third copy in the Drizzle adapter (`drizzle-adapter.ts` `buildAdapterMeta`).
- The option-column builder's default operators.

Confirmed drift: core's canonical `option` operators are
`is/isNot/isAnyOf/isNoneOf` (+ universal `isNull/isNotNull`) and the option
builder emits exactly `['is','isNot','isAnyOf','isNoneOf']` as defaults — but
the router gate accepts `equals/notEquals/isAnyOf/isNoneOf` for `option`,
i.e. it rejects `is`/`isNot`, the very operators the builder ships. Today only
the filter-handler's "supported-by-adapter OR core-validation-passes"
OR-fallback masks it. Every new operator or column type is a 4-to-8-file
lockstep edit with no compiler enforcement — and `type-guards.ts` already
shows the intended pattern (`KNOWN_FILTER_OPERATORS` derives from
`getAllOperators()` "so it can't drift").

## Current state

Verified at `787a816`:

- `packages/core/src/types/filter-operators.ts:517` —
  `export const FILTER_OPERATORS: Record<ColumnType, readonly FilterOperatorDefinition[]> = { ... }`;
  `:547` `export function getOperatorsForType(type: ColumnType)`. The `option`
  entry (`OPTION_OPERATORS`, ~`:301`) is `is/isNot/isAnyOf/isNoneOf`.
- `packages/adapters/toolkit/src/filter-router.ts:400-465` —
  `getSupportedOperators(columnType): FilterOperator[]` with a per-type
  `switch`; the `option` case (`:446`) returns
  `[...baseOperators, 'equals', 'notEquals', 'isAnyOf', 'isNoneOf']`
  (`baseOperators = ['isNull','isNotNull']`). Called from
  `filter-handler.ts` (the gate).
- `packages/adapters/drizzle/src/drizzle-adapter.ts:1243-1359` —
  `buildAdapterMeta` builds a `supportedOperators` table; `:1227-1359`
  builds `supportedColumnTypes: ColumnType[]`.
- `packages/core/src/builders/option-column-builder.ts:132` — default
  `operators: ['is', 'isNot', 'isAnyOf', 'isNoneOf']`.
- `ColumnType` is a 13-member union at `packages/core/src/types/column.ts:9`
  with NO runtime array. Re-enumerated by hand in:
  `packages/core/src/adapters/http-adapter.ts:22` (`ALL_COLUMN_TYPES`),
  `packages/core/src/builders/build-filter.ts:110` (`COLUMN_TYPES` Set),
  `packages/adapters/drizzle/src/drizzle-adapter.ts:1227`
  (`supportedColumnTypes`), `packages/core/src/utils/type-guards.ts:20`
  (`KNOWN_FILTER_TYPES`, though that one is over `FilterState['type']`).
- Convention: core + toolkit + drizzle are published → changesets required.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Build deps | `bun run build --filter=@better-tables/core --filter=@better-tables/adapters-toolkit` | exit 0 |
| Core tests | `cd packages/core && bun test` | all pass (1181+) |
| Toolkit tests | `cd packages/adapters/toolkit && bun test` | all pass (100+) |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | SQLite green (pg/mysql fail w/o env DBs — expected) |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/core/src/types/column.ts` (add `COLUMN_TYPES as const`)
- `packages/core/src/adapters/http-adapter.ts`,
  `packages/core/src/builders/build-filter.ts`,
  `packages/core/src/utils/type-guards.ts` (point arrays at the const)
- `packages/adapters/toolkit/src/filter-router.ts` (derive from core)
- `packages/adapters/drizzle/src/drizzle-adapter.ts` (`buildAdapterMeta`
  derives from core; `supportedColumnTypes` from the const)
- tests in the three packages; `.changeset/*.md`; `plans/README.md`

**Out of scope**:
- Adding new operators or column types.
- The filter-handler OR-fallback itself (it stays as defense-in-depth).
- `drizzle-predicate-emitter.ts` operator *emit* logic — this plan changes
  the *supported-set declaration*, not SQL generation.

## Git workflow

- Branch: `operator-type-single-source`; commits `Plan 038 Step N: …`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: One runtime source for `ColumnType`

In `packages/core/src/types/column.ts`, add
`export const COLUMN_TYPES = [...] as const` listing all 13 members in the
union's order, and change the type to
`export type ColumnType = (typeof COLUMN_TYPES)[number]`. Export it from the
package index if `column.ts`'s exports are re-exported there (check
`packages/core/src/index.ts`).

Point the three hand-copies at it: `http-adapter.ts` `ALL_COLUMN_TYPES = [...COLUMN_TYPES]`,
`build-filter.ts` `COLUMN_TYPES` Set = `new Set(CORE_COLUMN_TYPES)` (alias the
import to avoid the name clash), `drizzle-adapter.ts` `supportedColumnTypes = [...COLUMN_TYPES]`.
Leave `type-guards.ts`'s `KNOWN_FILTER_TYPES` if it's over `FilterState['type']`
(a different union) — note in a comment whether it can also derive.

**Verify**: `bun run typecheck` → exit 0 (the `Record<ColumnType, …>` sites
still get exhaustiveness checking); core + drizzle tests pass.

### Step 2: Reconcile the option-operator spelling to `is`/`isNot`

Per the maintainer decision, `is`/`isNot` is canonical. Core already uses it
(`FILTER_OPERATORS.option`), the builder already emits it. The only change is
the ADAPTER side (Step 3) — but first confirm the emitter can execute
`is`/`isNot` on option columns: read `optionOperator` in
`drizzle-predicate-emitter.ts`. If it only handles `equals/notEquals/isAnyOf/isNoneOf`,
add `is`→equality / `isNot`→inequality handling (they are semantically
identical to equals/notEquals for a single-select option). If it already maps
`is`/`isNot`, no emitter change.

**Verify**: write a scratch assertion (temporary test) that
`getOperatorsForType('option')` contains `is` and `isNot`; run core tests.
Remove the scratch test.

### Step 3: Adapters derive supported operators from core

In `filter-router.ts`, replace the `getSupportedOperators` `switch` body with
`return getOperatorsForType(columnType).map((o) => o.key)` (import
`getOperatorsForType` from `@better-tables/core`). In
`drizzle-adapter.ts` `buildAdapterMeta`, replace the hardcoded
`supportedOperators` table with the same derivation over the supported column
types. Keep whatever adapter-specific *subtraction* is real (if a dialect
genuinely can't do an operator, express it as an explicit deny-list applied
to the derived set, with a comment — do NOT silently re-hardcode).

**Verify**: toolkit + drizzle tests pass. Add a toolkit test asserting
`getSupportedOperators('option')` now includes `is` and `isNot` (the drift
this plan closes) and no longer diverges from
`getOperatorsForType('option')`.

### Step 4: Drift-lock test

In core (or toolkit), add a test that iterates every `ColumnType` and asserts
the router's `getSupportedOperators(type)` set equals
`getOperatorsForType(type).map(o => o.key)` minus any documented dialect
deny-list — so a future re-hardcoding fails CI.

**Verify**: the new test passes; deliberately re-add a bogus operator to the
router `switch` in a scratch edit → the test FAILS → revert.

### Step 5: Changesets + gates + ledger

Changeset for `@better-tables/core` (patch — `COLUMN_TYPES` export),
`@better-tables/adapters-toolkit` + `@better-tables/adapters-drizzle` (patch —
"option columns now accept `is`/`isNot` at the adapter gate, matching the
builder defaults; supported-operator tables derive from core"). Full gates;
update the plan 038 row.

## Test plan

- Toolkit: `getSupportedOperators('option')` includes `is`/`isNot`; the
  drift-lock test (Step 4).
- Core: emitter option `is`/`isNot` if Step 2 touched the emitter; scratch
  assertions removed.
- Model on `packages/adapters/toolkit/tests/filter-router.test.ts`.

## Done criteria

- [ ] `grep -n "COLUMN_TYPES = \[" packages/core/src/types/column.ts` → 1 match; the 3 array copies reference it (`[...COLUMN_TYPES]` / `new Set(...)`)
- [ ] `filter-router.ts` `getSupportedOperators` and `drizzle-adapter.ts` `buildAdapterMeta` call `getOperatorsForType` (grep confirms)
- [ ] `cd packages/adapters/toolkit && bun test` → pass, incl. option `is`/`isNot` + drift-lock
- [ ] core + drizzle SQLite tests pass; `bun run typecheck` exit 0
- [ ] Changesets for core + toolkit + drizzle exist
- [ ] No out-of-scope files modified; `plans/README.md` row updated

## STOP conditions

- The router's `switch` encodes a real dialect limitation for some type that
  `getOperatorsForType` doesn't know about (not just drift) — report it;
  express as an explicit deny-list, don't drop the constraint.
- Deriving `buildAdapterMeta` from core changes `adapter.meta.supportedOperators`
  in a way that breaks an existing drizzle meta test whose expectation was the
  OLD (drifted) table — reconcile the test to the canonical set, but STOP if
  it implies a real capability regression.
- Emitter can't execute `is`/`isNot` on option columns and adding it looks
  non-trivial (more than aliasing to equals/notEquals) — report before writing SQL.

## Maintenance notes

- Plan 044 (drizzle decomposition) extracts `buildAdapterMeta` into
  `adapter-meta.ts`; do 038 first so the extracted module is already thin.
- The drift-lock test is the durable guard — reviewers should keep it green
  rather than special-casing it.
