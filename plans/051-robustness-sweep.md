# Plan 051: Robustness sweep — singleton races, decompression bound, resolver suggestion, driver-detect, computed-TREE, skip-guards

> **Executor instructions**: Each step is INDEPENDENT and independently
> revertable — do them in any order, commit per step. Some steps are
> INVESTIGATE-first (marked): produce a finding and a minimal fix, or STOP and
> report if the fix isn't obvious. Run every verification; on any STOP, stop
> and report. Update `plans/README.md` when done unless a reviewer maintains
> the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- apps/marketing/src/lib packages/core/src/utils/compression.ts packages/adapters/toolkit/src/primary-table-resolver.ts packages/adapters/drizzle/src/utils/driver-detector.ts packages/adapters/drizzle/src/filter-handler.ts packages/adapters/drizzle/tests CLAUDE.md`

## Status

- **Priority**: P3
- **Effort**: M (six small independent items)
- **Risk**: LOW-MED (mostly small; two are investigate-first)
- **Depends on**: none
- **Category**: bug / tests / dx
- **Planned at**: commit `787a816`, 2026-07-17
- **Completed**: wave-b branch (`robustness-sweep`), 2026-07-17 — items 4
  documented-and-deferred (lazy factory sufficient); item 5
  documented-and-deferred (loud `QueryError` + MIGRATION known gap; tree
  substitution deferred to computed-fields owner)

## Why this matters

Six small, verified robustness gaps that don't each warrant a plan but
shouldn't rot in the backlog. All independently scoped.

## Current state (per item)

Verified at `787a816`:

1. **ADCORR-02 — marketing singleton race (S).**
   `apps/marketing/src/lib/db/index.ts:11-14` `getDatabase()` and
   `adapter.ts:9-25` `getAdapter()` / `:34-41` `getTables()` are check-then-act
   across an `await` (create + seed 5000 rows, assign singleton only after).
   Concurrent cold-start requests each re-seed and leak better-sqlite3 handles.
   The correct pattern is in the SAME repo:
   `apps/marketing/src/lib/demo/support/db.ts:84-168` (`getSupportTables`
   memoizes the in-flight promise synchronously).
2. **SEC-05 — URL decompression bound (S).**
   `packages/core/src/utils/compression.ts:165-186` `decompressAndDecode`
   runs `LZString.decompressFromEncodedURIComponent` + `JSON.parse` +
   recursive `renameKeys` (`:84-100`, no depth limit) with no input-size cap.
   Reached server-side via `parseTableSearchParams`. Largely mitigated by
   fail-closed try/catch + `isFilterStateShape`; a hardening bound is wanted.
3. **Resolver "did you mean" gap (S).**
   `packages/adapters/toolkit/src/primary-table-resolver.ts:341` — suggestions
   require `distance > 0`, so a correct column behind a wrong table prefix
   (`user.name` vs table `users`) throws with NO suggestion.
4. **Finding 13b — detectDriver under Next build (INVESTIGATE).**
   `packages/adapters/drizzle/src/utils/driver-detector.ts:36` `detectDriver`
   returns null under Next's build-time page-data collection for a
   better-sqlite3 binding that detects fine at request time. The HTTP handler's
   lazy factory works around it at mount sites; root cause uninvestigated.
5. **Computed-field TREE substitution (INVESTIGATE / owner call).**
   `packages/adapters/drizzle/src/filter-handler.ts` — computed-field filter
   substitution is skipped for TREE (`FilterGroupNode`) inputs (plan 017 scope
   cut); a computed-field leaf inside a group resolves as a regular column and
   errors loudly.
6. **pg/mysql skip-guards vs CLAUDE.md (S).**
   Drizzle pg/mysql integration suites FAIL (not skip) without env DBs,
   contrary to CLAUDE.md's "skipped otherwise". Either add skip-guards or fix
   the claim.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Core tests | `cd packages/core && bun test` | pass |
| Toolkit tests | `cd packages/adapters/toolkit && bun test` | pass |
| Drizzle SQLite | `cd packages/adapters/drizzle && bun test` | SQLite green |
| Marketing test | `cd apps/marketing && bun test` | pass (after 033 wires it) |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope** (one step each):
- `apps/marketing/src/lib/db/index.ts`, `apps/marketing/src/lib/adapter.ts`
- `packages/core/src/utils/compression.ts`
- `packages/adapters/toolkit/src/primary-table-resolver.ts`
- `packages/adapters/drizzle/src/utils/driver-detector.ts` (investigate)
- `packages/adapters/drizzle/src/filter-handler.ts` (investigate/owner)
- Drizzle pg/mysql test files OR `CLAUDE.md` (pick one, item 6)
- tests as noted; `.changeset/*.md` (core patch for SEC-05, toolkit patch for
  resolver); `plans/README.md`

**Out of scope**: anything not in the six items; refactors beyond the minimal fix.

## Git workflow

- Branch: `robustness-sweep`; commits `Plan 051 Step N: …` (one per item).

## Steps

### Step 1: Fix the marketing singleton race (item 1)

Replace the value-caches in `getDatabase`/`getAdapter`/`getTables` with an
in-flight promise memo assigned SYNCHRONOUSLY before the first `await`
(mirror `getSupportTables` in `demo/support/db.ts:84-168`). Reset the memo to
`null` in a `.catch` so a failed seed remains retryable.

**Verify**: `cd apps/marketing && bun test` — add/extend a test that two
concurrent `getDatabase()` calls resolve to the SAME instance (one seed). If
marketing tests aren't wired yet, land plan 033 first or run
`cd apps/marketing && bun test` directly.

### Step 2: Bound URL decompression (item 2)

In `decompressAndDecode`, add a max encoded-input length check before
decompression and a decompressed-size / `renameKeys` recursion-depth cap;
return `null` past the limit (matches the existing fail-closed behavior). Pick
generous bounds that never reject legitimate table state (document the numbers
in a comment).

**Verify**: `cd packages/core && bun test` — add tests: an over-long input
returns `null`; a deeply-nested payload past the depth cap returns `null`; a
normal filter state still round-trips.

### Step 3: Resolver suggestion for wrong-prefix-right-column (item 3)

In `primary-table-resolver.ts:341`, allow `distance === 0` candidates (exact
column name under a different table prefix) into the suggestion list so
`user.name` suggests `users.name`. Keep the `distance <= maxDistance` upper
bound.

**Verify**: `cd packages/adapters/toolkit && bun test` — add a test that a
correct column behind a wrong table prefix throws WITH a suggestion naming the
right prefix.

### Step 4 (INVESTIGATE): detectDriver under Next build (item 4)

Read `driver-detector.ts` and determine why detection returns null in the
build-time phase (likely the binding/proxy isn't the expected shape then).
Produce a finding: is the lazy-factory workaround sufficient (then document it
in the detector's JSDoc + a code comment and STOP), or is there a robust
detection tweak (e.g. an additional shape check) that works in both phases? If
a safe tweak exists, apply it with a test; otherwise document and defer.

**Verify**: if fixed, a test covering the build-phase shape; if deferred, a
JSDoc note explaining the phase limitation and the lazy-factory mitigation.

### Step 5 (INVESTIGATE / owner): computed-field TREE substitution (item 5)

Read `filter-handler.ts`'s computed-field substitution and the TREE-walk path
(plan 017). Confirm the scope cut: computed-field leaves inside a
`FilterGroupNode` aren't substituted. Decide with the computed-fields context:
either (a) extend substitution to walk TREE inputs (if tractable and low-risk),
or (b) document the limitation precisely (error message + a code comment +
a MIGRATION/known-gaps note) and leave the fix to the computed-fields owner.
Prefer (b) unless the walk is a clean addition — this is correctness-sensitive.

**Verify**: if (a), a test with a computed-field leaf inside a group produces
correct SQL; if (b), the loud error is confirmed + documented, and a
known-gaps note is added.

### Step 6: Reconcile pg/mysql suites with CLAUDE.md (item 6)

Pick ONE: add env-guarded `describe.skipIf`/early-return to the pg/mysql
suites so they SKIP (not fail) without `POSTGRES_TEST_URL`/`MYSQL_TEST_URL`,
matching CLAUDE.md's "skipped otherwise" — OR fix CLAUDE.md's claim to say
they fail without env DBs. Prefer the skip-guard (makes local `bun test` clean
and matches the documented contract), but verify it doesn't hide the suites
from CI (which HAS the env DBs — the guard must key on presence of the URL, so
CI still runs them).

**Verify**: locally `cd packages/adapters/drizzle && bun test` — pg/mysql
suites SKIP (not fail); confirm the guard checks the env URL so CI still runs
them (grep the guard).

### Step 7: Changesets + gates + ledger

Changesets: `@better-tables/core` (patch — decompression bound),
`@better-tables/adapters-toolkit` (patch — resolver suggestion), and drizzle
(patch) if items 4/5 changed adapter behavior. Full gates. Update plan 051
row noting which of 4/5 were fixed vs documented.

## Test plan

- Marketing: single-flight singleton (Step 1).
- Core: decompression bounds (Step 2).
- Toolkit: wrong-prefix suggestion (Step 3).
- Drizzle: detectDriver build-phase (Step 4 if fixed); computed-TREE (Step 5
  if fixed); pg/mysql skip-guard (Step 6).
- Patterns: the sibling correct singleton; existing resolver/decompression
  tests.

## Done criteria

- [x] Marketing singletons memoize the in-flight promise (grep for the promise memo); concurrent-call test passes
- [x] `decompressAndDecode` bounds input length + recursion depth; over-limit returns null (tests pass)
- [x] Resolver suggests the right prefix for a `distance === 0` column; test passes
- [x] detectDriver (item 4) and computed-TREE (item 5) are each either fixed-with-test or documented-and-deferred (state which)
- [x] pg/mysql suites SKIP without env DBs (or CLAUDE.md corrected); CI still runs them (env-keyed guard)
- [x] Changesets exist; `bun run typecheck` exit 0; all touched suites green
- [x] `plans/README.md` updated

## STOP conditions

- Item 4 or 5 turns out to be a deeper correctness issue than a sweep item —
  STOP, write it up as its own finding, and leave a documented note rather
  than a rushed fix.
- The decompression bound rejects a realistic large-but-valid filter state —
  raise the bound; the guard must never break legitimate bookmarked URLs.
- The pg/mysql skip-guard would also skip in CI (where the URLs exist) —
  the guard must key on URL presence, not just NODE_ENV.

## Maintenance notes

- Items 4 and 5 are the ones most likely to escalate — if they do, they graduate
  from this sweep to their own plan; the sweep records the decision.
- Reviewer scrutiny: the singleton memo must null-on-reject (retryable), and
  the skip-guard must not hide CI coverage.
