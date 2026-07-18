# Plan 036: Give date `between`/`notBetween` the timestamp-column fallback the other date operators have

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/adapters/toolkit/src/filter-router.ts packages/adapters/toolkit/src/types.ts packages/adapters/toolkit/tests/filter-router.test.ts packages/adapters/drizzle/src/drizzle-predicate-emitter.ts packages/adapters/drizzle/tests/date-filter-operators.test.ts packages/adapters/drizzle/tests/adapter-postgres.test.ts packages/adapters/drizzle/tests/adapter-mysql.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / tests
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

Commit `fbd7f9a` fixed date filters on SQLite timestamp columns and routed
date-column `between`/`notBetween` to the date handler. But its routing guard
is `columnType === 'date'` only, while the single-value date operators
(`is`/`isNot`/`before`/`after`) reach the date handler via
`isDateOperator(operator)` regardless of `columnType` — and the emitter then
applies `shouldUseDateComparison = columnType === 'date' || isTimestamp`,
i.e. a deliberate fallback for "the filter didn't say `date`, but the column
IS a timestamp" (untyped programmatic filters, `buildFilter` calls without a
type, or a timestamp column whose column def wasn't typed `date`). For
`between`/`notBetween` in that same situation, the router classifies them as
*number* operators and sends them to `numberOperator`, which either throws
`QueryError` (Date/ISO-string endpoints fail the number type assertion —
whole fetch fails) or, with numeric epoch-millisecond endpoints, binds raw
ms values against a seconds-mode column and silently matches nothing. This
is the exact bug class `fbd7f9a` set out to kill, still live for the
two-value operators. Separately, the fix's regression tests exist only for
SQLite: the pg/mysql suites have no date-`between` case at all, and the
router's date/number disambiguation has no unit test — so the divergent
dialect branches are unguarded.

## Current state

All excerpts verified at `787a816`.

- `packages/adapters/toolkit/src/filter-router.ts:273-282` — the dispatch
  chain (inside the leaf-routing method):

  ```ts
  } else if (columnType === 'date' && (operator === 'between' || operator === 'notBetween')) {
    // `between`/`notBetween` are shared between number and date columns. On a
    // date column they need the date handler's day-range semantics — the
    // numeric handler would treat the ISO/Date values as raw numbers and
    // silently drop the filter (matching every row).
    condition = this.emitter.dateOperator(column, operator, values, columnType);
  } else if (this.isNumberOperator(operator)) {
    condition = this.emitter.numberOperator(column, operator, values);
  } else if (this.isDateOperator(operator)) {
    condition = this.emitter.dateOperator(column, operator, values, columnType);
  }
  ```

  `isNumberOperator` (`:185-194`) includes `between`/`notBetween`, so when
  the `columnType === 'date'` gate is false they go numeric.
  `isDateOperator` (`:195+`) covers `is/isNot/before/after/...` — those
  reach `dateOperator` for ANY columnType.
- `packages/adapters/drizzle/src/drizzle-predicate-emitter.ts:267-271` —
  inside `dateOperator`:

  ```ts
  // Check if this is a timestamp column (even if columnType from frontend isn't 'date')
  const isTimestamp = this.isTimestampColumn(column);
  const shouldUseDateComparison = columnType === 'date' || isTimestamp;
  ```

  `isTimestampColumn` is private at `:1152`. The `between`/`notBetween`
  branch of `dateOperator` exists (`:415-419` region, using
  `createDateRangeCondition`/`createDateComparisonCondition`) — the date
  handler already handles these operators correctly once reached.
- The emitter interface the router programs against is in
  `packages/adapters/toolkit/src/types.ts` (the `PredicateEmitter`-style
  interface with `numberOperator`/`dateOperator`/`textOperator`/... —
  locate the exact interface name there before editing).
- Tests today:
  - `packages/adapters/toolkit/tests/filter-router.test.ts:109-110` asserts
    `between`/`notBetween` route to `numberOperator` — with NO columnType
    variation; no date-column case exists.
  - `packages/adapters/drizzle/tests/date-filter-operators.test.ts` — the
    `fbd7f9a` regression suite: `bun:sqlite`, an
    `integer('occurred_at', { mode: 'timestamp' })` column, row-COUNT
    assertions, and a `dateFilter()` helper that hardcodes `type: 'date'`
    on every filter. This file is the structural pattern for new drizzle
    tests.
  - `packages/adapters/drizzle/tests/adapter-postgres.test.ts:430-506` and
    `adapter-mysql.test.ts:392-467` — date-operator describes covering
    `is/isNot/before/after/isToday…/isNull` but no `between`/`notBetween`.
    These suites need `POSTGRES_TEST_URL`/`MYSQL_TEST_URL` (they FAIL, not
    skip, without them — locally ignore those two files; CI provisions
    both databases as service containers, see `.github/workflows/test.yml`
    `test-adapters`).
- Convention: drizzle adapter changes that affect consumers need a
  changeset (`@better-tables/adapters-drizzle`, patch); the toolkit is also
  published (`@better-tables/adapters-toolkit`, patch). Changesets
  accumulate for the 0.6 train.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Build deps for drizzle tests | `bun run build --filter=@better-tables/core --filter=@better-tables/adapters-toolkit` | exit 0 |
| Toolkit tests | `cd packages/adapters/toolkit && bun test` | all pass (100+ as of `787a816`) |
| Drizzle SQLite tests | `cd packages/adapters/drizzle && bun test tests/date-filter-operators.test.ts` | all pass |
| Full drizzle local | `cd packages/adapters/drizzle && bun test` | SQLite suites pass; `adapter-postgres`/`adapter-mysql` fail without env DBs — expected |
| Typecheck | `bun run typecheck` (root) | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `packages/adapters/toolkit/src/filter-router.ts`
- `packages/adapters/toolkit/src/types.ts` (one optional method on the
  emitter interface)
- `packages/adapters/toolkit/tests/filter-router.test.ts`
- `packages/adapters/drizzle/src/drizzle-predicate-emitter.ts` (implement
  the optional method — a one-line public wrapper)
- `packages/adapters/drizzle/tests/date-filter-operators.test.ts`
- `packages/adapters/drizzle/tests/adapter-postgres.test.ts`,
  `packages/adapters/drizzle/tests/adapter-mysql.test.ts` (add cases to the
  existing date describes)
- `.changeset/<new-file>.md`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- The single-value date-operator routing (`isDateOperator` chain) — already
  correct.
- `filter-handler.ts`, `drizzle-adapter.ts`, relationship code.
- The operator-table consolidation (audit finding DEBT-01, ledger backlog)
  — do not refactor `getSupportedOperators` here even though you'll be in
  the same file.

## Git workflow

- Branch: `date-between-timestamp-fallback`
- Commits: `Plan 036 Step N: <imperative summary>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an optional date-semantics probe to the emitter contract

In `packages/adapters/toolkit/src/types.ts`, on the emitter interface the
router consumes (locate it — it declares `numberOperator`, `dateOperator`,
etc.), add:

```ts
/**
 * Optional: report whether `column` stores date/timestamp semantics even
 * when the filter's `columnType` doesn't say `date` (e.g. a Drizzle
 * `integer(..., { mode: 'timestamp' })` column receiving an untyped
 * programmatic filter). Used by the router to give `between`/`notBetween`
 * the same timestamp fallback the single-value date operators get inside
 * `dateOperator` itself. Absent ⇒ no fallback (columnType decides alone).
 */
prefersDateSemantics?(column: ColumnLike): boolean;
```

(Use the same column parameter type the interface's other methods use.)

In `packages/adapters/drizzle/src/drizzle-predicate-emitter.ts`, implement
it as a public one-liner delegating to the existing private
`isTimestampColumn` (`:1152`):

```ts
prefersDateSemantics(column: ColumnOrExpression): boolean {
  return this.isTimestampColumn(column);
}
```

**Verify**: root `bun run typecheck` → exit 0.

### Step 2: Extend the router gate

In `filter-router.ts:273`, change the date-`between` guard to:

```ts
} else if (
  (operator === 'between' || operator === 'notBetween') &&
  (columnType === 'date' || this.emitter.prefersDateSemantics?.(column) === true)
) {
```

Keep the explanatory comment, extending it with one line about the
timestamp fallback mirroring `dateOperator`'s own
`shouldUseDateComparison`. A NUMBER column is unaffected:
`prefersDateSemantics` returns false for it and the next branch
(`isNumberOperator`) fires as before.

Before moving on, confirm the emitter's `dateOperator` `between` branch can
parse the value shapes that now reach it: read `parseFilterDate` in
`drizzle-predicate-emitter.ts` and check it handles `Date` instances, ISO
strings, AND numbers. If it does not handle numbers, the fallback path for
numeric epoch values must throw the emitter's existing wrong-type
`QueryError` rather than silently misbehave — see STOP conditions.

**Verify**: `cd packages/adapters/toolkit && bun test` → existing suite
passes (the `:109-110` number-routing assertions must still pass — they use
no date columnType and a mock emitter without `prefersDateSemantics`, so
they exercise the absent-method path).

### Step 3: Router unit tests

In `packages/adapters/toolkit/tests/filter-router.test.ts`, add cases
(model on the existing `between` cases at `:109-110`):

1. `columnType: 'date'` + `between` → dispatches to `dateOperator` (the
   `fbd7f9a` guard, previously untested at unit level).
2. No/`'number'` columnType + mock emitter with
   `prefersDateSemantics: () => true` + `between` → dispatches to
   `dateOperator` (the new fallback).
3. No columnType + `prefersDateSemantics: () => false` + `between` →
   dispatches to `numberOperator` (numbers unaffected).
4. No columnType + emitter WITHOUT the method + `between` →
   `numberOperator` (optional-method absence).

**Verify**: `cd packages/adapters/toolkit && bun test` → all pass including
4 new.

### Step 4: SQLite row-set regression for the untyped-filter path

In `packages/adapters/drizzle/tests/date-filter-operators.test.ts`, add a
describe using the existing seed (five events, one per day 2026-03-08 →
2026-03-12):

1. `between` on `occurredAt` with `type` NOT `'date'` (use the file's
   filter-building style but pass `type: 'number'` — the realistic
   misroute shape) and ISO-string endpoints
   `['2026-03-09T00:00:00Z', '2026-03-11T23:59:59Z']` → expect exactly 3
   rows. Before Step 2 this throws or returns wrong rows; after, it matches
   the typed equivalent.
2. The same with `notBetween` → expect exactly 2 rows.
3. A control: identical filters WITH `type: 'date'` → same counts (locks
   equivalence between the two routes).

**Verify**: `cd packages/adapters/drizzle && bun test tests/date-filter-operators.test.ts`
→ all pass. Recommended proof: stash Step 2, confirm the new untyped tests
FAIL, unstash.

### Step 5: pg/mysql `between` coverage

Add to the existing date-operator describes —
`adapter-postgres.test.ts` (`:430-506` region) and `adapter-mysql.test.ts`
(`:392-467` region) — `between` and `notBetween` cases with `type: 'date'`,
asserting row counts against those suites' existing seeded date data
(reuse each file's established seed + assertion style; pick endpoint dates
that select a strict subset of seeded rows). These only execute with env
DBs (CI), so also run a syntax-level check locally.

**Verify**: locally `bunx tsc --noEmit` inside `packages/adapters/drizzle`
→ exit 0 (compiles). If you have Docker available and can trivially source
`packages/adapters/drizzle/.env.example`-style URLs, run the suites live;
otherwise state in your report that pg/mysql execution is deferred to CI.

### Step 6: Changeset + gates + ledger

Changeset covering `@better-tables/adapters-toolkit` (patch) and
`@better-tables/adapters-drizzle` (patch): "date `between`/`notBetween` now
fall back to date semantics on timestamp columns when the filter's
columnType isn't 'date', matching the other date operators." Run full
gates; update the plan 036 row in `plans/README.md`.

**Verify**: root `bun run typecheck`; toolkit + drizzle SQLite tests green.

## Test plan

- Toolkit unit tests (Step 3): 4 routing cases including optional-method
  absence.
- Drizzle SQLite row-set tests (Step 4): untyped `between`/`notBetween` +
  typed control — the regression this plan exists for.
- pg/mysql `between`/`notBetween` (Step 5): closes the dialect asymmetry
  from the `fbd7f9a` fix (audit finding TEST-04).
- Patterns: `filter-router.test.ts` existing between-cases;
  `date-filter-operators.test.ts` seed/count style; each dialect suite's
  own date describe.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "prefersDateSemantics" packages/adapters/toolkit/src/types.ts packages/adapters/toolkit/src/filter-router.ts packages/adapters/drizzle/src/drizzle-predicate-emitter.ts` → all three match
- [ ] `cd packages/adapters/toolkit && bun test` → pass, incl. 4 new router cases
- [ ] `cd packages/adapters/drizzle && bun test tests/date-filter-operators.test.ts` → pass, incl. the untyped `between`/`notBetween` cases
- [ ] `grep -n "notBetween" packages/adapters/drizzle/tests/adapter-postgres.test.ts packages/adapters/drizzle/tests/adapter-mysql.test.ts` → matches in both
- [ ] Root `bun run typecheck` → exit 0
- [ ] New `.changeset/*.md` bumping toolkit + drizzle (patch) exists
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The emitter interface in `toolkit/src/types.ts` is structured so an
  optional method can't be added without breaking other emitter
  implementations found by typecheck.
- `parseFilterDate` (Step 2 check) does NOT handle numeric values and the
  `between` date branch would silently mis-handle epoch numbers routed to
  it — report; do not extend `parseFilterDate` yourself (value-shape policy
  is an ADAPTER-07-adjacent decision).
- Step 4's new tests do not fail with Step 2 stashed (the misroute differs
  from this plan's analysis).
- The existing toolkit suite fails after Step 2 in any case not listed in
  Step 3 — the gate change leaked wider than `between`/`notBetween`.

## Maintenance notes

- Future emitters (the held Prisma adapter, or an in-memory adapter) should
  implement `prefersDateSemantics` when their column objects can identify
  timestamp storage; absence degrades gracefully to columnType-only
  routing.
- The operator-table consolidation (ledger backlog, DEBT-01) touches
  `filter-router.ts`'s `getSupportedOperators` — unrelated to this gate,
  but rebase-order matters if both run.
- Reviewer scrutiny: the Step 2 guard must not capture plain number
  columns (test 3 in Step 3 is the lock), and the `?.` + `=== true` form
  keeps absent-method behavior identical to today.
