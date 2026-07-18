# Plan 042: UI test coverage — filter components, table interactions, deterministic timers

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index. This
> plan ADDS tests only — it must not change any `src/` behavior. If a new
> test reveals a real bug, STOP and report it as a finding (don't fix source
> here).
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/ui/src/components/filters packages/ui/src/components/table/table.tsx packages/ui/src/hooks packages/ui/tests`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW (tests only)
- **Depends on**: 033 (turbo `tests/**` cache fix — so new tests actually run); land 033 first
- **Category**: tests
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

The filter UI — the product's central interaction (turn user input into
`FilterState`) — has near-zero automated coverage, and two of its components
were just rewritten in `787a816` with no regression net:

- `filter-dropdown.tsx` (561 lines): mobile detection, a `ViewState`
  groups/drill-in state machine, search filtering, `ungroupedMode` branching
  — 0 test refs.
- `inputs/option-filter-input.tsx` (rewritten +226): `allowsMultiple`
  derivation, `handleToggleOption` add/remove-vs-replace, isNull/isNotNull
  short-circuit, search threshold — 0 tests. Same for the sibling inputs
  (`date` 381, `number` 327, `multi-option`, `text`) and the shared hooks
  `use-filter-validation`, `use-keyboard-navigation` (9.2k), `use-virtualization`
  (13k) — all 0 test refs.
- `table.tsx` (1315 lines, rewritten +171): its only tests are plan-025
  memoization/effect-churn perf locks — sort/select/reorder/visibility/
  pagination wiring are exercised only incidentally.
- **TEST-08**: UI hook tests use real-timer waits (200/250 ms) — a flaky
  pattern that also slows the suite.

## Current state

Verified at `787a816`:

- `packages/ui/tests/` structure: `components/` (9 test files — none touch
  `filter-dropdown` or any `inputs/*`), `hooks/` (`use-facets`,
  `use-table-data`, `use-table-url-sync`), `helpers/` (`stub-adapter.ts`,
  `render-count.tsx`, `url-sync.ts`), `setup.ts` (happy-dom via
  `GlobalRegistrator.register()`). `grep -rln "FilterDropdown\|option-filter-input" tests/` → none.
- `table.tsx` interaction handlers: `:511` `useTableSorting` →
  `handleSortingChange` (`:731-736`, calls `toggleSort`); `:512`
  `useTableSelection` → `handleSelectAll` (`:748-757`, `selectAll`/
  `clearSelection`); sort headers wire `onClick`/`onSort` (`:1025`,
  `:1089`, `:1122`); select-all checkbox `:1008`. Column reorder/visibility
  live in `column-order-list.tsx` / `column-visibility-toggle.tsx`.
- Real-timer waits: `use-table-url-sync.test.tsx:59,73,75,173,178` (200/50/250 ms),
  `use-facets.test.tsx:168` (50 ms), `use-table-data.test.tsx:128` (0 ms).
- Test runner: `bun test` (happy-dom + `@testing-library/react`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| UI tests | `cd packages/ui && bun test` | pass |
| One file | `cd packages/ui && bun test components/<file>` | pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope** (test files + helpers ONLY):
- New: `packages/ui/tests/components/filter-dropdown.test.tsx`,
  `tests/components/inputs/option-filter-input.test.tsx` (+ `date`, `number`,
  `multi-option`, `text` input tests), `tests/hooks/use-filter-validation.test.tsx`,
  `tests/hooks/use-keyboard-navigation.test.tsx`,
  `tests/components/table-interactions.test.tsx`
- Edits: `tests/hooks/use-table-url-sync.test.tsx`,
  `use-facets.test.tsx`, `use-table-data.test.tsx` (fake timers),
  `tests/helpers/*` (extend stub only if needed)
- `plans/README.md`

**Out of scope**:
- Any `packages/ui/src/**` change (this is coverage, not fixes).
- Cross-package integration + E2E (plan 043).
- `@better-tables/ui` is private — no changeset.

## Git workflow

- Branch: `ui-test-coverage`; commits `Plan 042 Step N: …`.

## Steps

### Step 1: Filter input component tests

For each of `inputs/{option,date,number,multi-option,text}-filter-input.tsx`,
write a characterization suite asserting VALUE EMISSION per operator: render
with a given operator, drive the input (type/click/select via
`@testing-library`), and assert the emitted `FilterState.values` (via the
component's onChange/onFilterChange prop). Cover for option:
single-select replace vs multi-select toggle (`allowsMultiple`),
isNull/isNotNull emitting no values, search-threshold behavior. For date:
the operator/value shapes (single vs range). Model structure on an existing
component test (e.g. `tests/components/active-filters-render.test.tsx`) and
the stub patterns in `tests/helpers/`.

**Verify**: `cd packages/ui && bun test components/inputs` → all new tests
pass.

### Step 2: `filter-dropdown` tests

Cover the `ViewState` transitions (open → group → drill-in → back), the
`ungroupedMode: 'group' | 'inline'` branches, and search filtering of the
column list. Mobile detection can be exercised by controlling the viewport
signal the component reads (find how `:84` detects mobile — likely a media
query or width; stub it). Assert which columns/inputs render per state.

**Verify**: `cd packages/ui && bun test components/filter-dropdown.test.tsx`
→ pass.

### Step 3: Shared filter hooks

Unit-test `use-filter-validation` (valid/invalid value cases per operator,
matching core's operator definitions) and `use-keyboard-navigation`
(arrow/enter/escape behavior over a list). These are pure-ish hooks — use
`renderHook`.

**Verify**: `cd packages/ui && bun test hooks/use-filter-validation.test.tsx hooks/use-keyboard-navigation.test.tsx`
→ pass.

### Step 4: `table.tsx` interaction tests

New `tests/components/table-interactions.test.tsx` driving the REAL component
against the stub adapter: sort-header click cycles (asc→desc→…, verifying
`toggleSort` state), select-all checkbox toggling `selectedRows`, and
pagination controls changing the page. Keep the existing perf-lock tests
(`table-row-render`, `table-effect-churn`) untouched — they lock memoization,
this locks behavior.

**Verify**: `cd packages/ui && bun test components/table-interactions.test.tsx`
→ pass.

### Step 5: Replace real-timer waits with fake timers

In `use-table-url-sync.test.tsx`, `use-facets.test.tsx`, `use-table-data.test.tsx`,
replace `await new Promise(r => setTimeout(r, N))` waits with fake timers
(`bun:test` supports `setSystemTime`; for debounce logic prefer advancing
timers deterministically — if `bun test` lacks timer mocking for the debounce
util, inject the debounce delay as a test-only small value, or `await` a
flushed microtask + a single real 0 ms tick). The goal: no assertion depends
on a 200–250 ms wall-clock wait.

**Verify**: `cd packages/ui && bun test hooks/` → pass; `grep -rn "setTimeout(resolve, 2" packages/ui/tests`
→ no 200/250 ms waits remain.

### Step 6: Gates + ledger

`cd packages/ui && bun test` (full), `bun run typecheck`. Update plan 042 row
with the new test count.

## Test plan

This plan IS the test plan. New suites: 5 input components, filter-dropdown,
2 shared hooks, table interactions. Edited: 3 hook suites → deterministic
timers. All model on existing `tests/components/*` and `tests/hooks/*`.

## Done criteria

- [ ] `grep -rln "option-filter-input\|FilterDropdown" packages/ui/tests` → matches (was 0)
- [ ] New suites exist for all five `inputs/*`, `filter-dropdown`, `use-filter-validation`, `use-keyboard-navigation`, and `table.tsx` interactions
- [ ] `grep -rn "setTimeout(resolve, 2[05]0)" packages/ui/tests` → 0
- [ ] `cd packages/ui && bun test` → all pass (49 baseline + new, count recorded)
- [ ] No `packages/ui/src/**` files modified (`git status`)
- [ ] `plans/README.md` updated

## STOP conditions

- A new test reveals a real bug in a rewritten component (wrong value emitted,
  broken state transition) — STOP and report it as a correctness finding; do
  not fix `src/` in this plan.
- `bun test` cannot control the debounce/media-query signals without a `src/`
  change — report; prefer a test-only injection point only if it already
  exists, else document the coverage gap.
- Fake-timer conversion (Step 5) changes what a hook test asserts (not just
  how it waits) — keep the assertion, report the difficulty.

## Maintenance notes

- These characterization tests lock CURRENT behavior — if a later plan
  intentionally changes filter-input semantics, it updates them deliberately.
- Reviewer scrutiny: Step 1/2 tests must assert real emitted values/state,
  not just "renders without throwing" (the anti-pattern §4 warns about).
- Coverage of `use-virtualization` is deferred to plan 043's integration
  test where it runs against real data (noted, not silently dropped).
