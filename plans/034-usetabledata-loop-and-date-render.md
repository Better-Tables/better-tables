# Plan 034: Fix the `useTableData` unbounded refetch loop and raw string/number date rendering

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/ui/src/hooks/use-table-data.ts packages/ui/tests/hooks/use-table-data.test.tsx packages/core/src/lib/format-utils.ts packages/core/tests/lib/format-utils.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (parallel-safe with 033; if both run, land 033 first — disjoint files)
- **Category**: bug
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

Two consumer-visible bugs, both small, both certain.

**Bug 1 — refetch loop.** `useTableData` defaults `filters = []` and
`params = {}` with inline literals. Both are fresh references on every
render, both are dependencies of the `fetchData` `useCallback`, and the fetch
effect depends on `fetchData`. So any caller that omits either option gets:
render → new identity → effect runs → fetch resolves → `setData` (fresh array
from the adapter) → re-render → new identity → fetch again — an unbounded
request loop hammering the adapter/backend as fast as it resolves. The
sibling hook `useVirtualizedTableData` already hoists a module-level
`EMPTY_PARAMS` with a comment naming this exact hazard, and `useFacets`
interns its array/filters props by content for the same reason —
`useTableData` is the one outlier. The existing test suite misses it because
its stub adapter returns promises that never resolve.

**Bug 2 — raw date rendering.** The `date` branch of `getFormatterForType`
only formats values that are `Date` instances (or duck-typed `getTime`
objects); strings and numbers fall through to `String(value)`. Every
JSON-transport adapter — including the new first-party `httpAdapter`, whose
handler `JSON.stringify`s result rows — delivers dates as ISO strings, so
date columns render `2026-03-10T09:00:00.000Z` instead of the column's
configured `dateFormat`/timezone output. The in-process Drizzle path returns
real `Date`s and hides the bug; it surfaces exactly when apps adopt the HTTP
adapter.

## Current state

- `packages/ui/src/hooks/use-table-data.ts:84-90` — the signature:

  ```ts
  export function useTableData<TData = unknown>({
    adapter,
    filters = [],
    pagination,
    params = {},
    enabled = true,
  }: UseTableDataOptions<TData>): UseTableDataResult<TData> {
  ```

  `:102` `fetchData = useCallback(...)` with deps
  `[adapter, filters, pagination, params, enabled]` (`:148`); the fetch
  effect at `:158-164` depends on `[fetchData]`. The abort/requestId guards
  inside are correct — only the default-parameter identities are wrong.

- `packages/ui/src/hooks/use-virtualized-table-data.ts:13-16` — the pattern
  to copy, comment included:

  ```ts
  // Stable default so an omitted `params` doesn't recreate `fetchData`'s
  // identity (and retrigger the fetch effect) on every render the way a
  // `params = {}` default-parameter object literal would.
  const EMPTY_PARAMS: Record<string, unknown> = {};
  ```

- `packages/core/src/lib/format-utils.ts:326-331` — the date branch:

  ```ts
  case 'date':
    if (value instanceof Date || (value && typeof value === 'object' && 'getTime' in value)) {
      const dateConfig = meta?.dateFormat as Record<string, unknown> | undefined;
      return formatDateWithConfig(value as Date, dateConfig || {});
    }
    return String(value || '');
  ```

  `formatDateWithConfig` lives in `packages/core/src/lib/date-utils.ts` and
  accepts `Date | null | undefined`. Both cell renderers route through this:
  `packages/ui/src/components/table/table.tsx:309` and
  `virtualized-table.tsx:146`.

- Existing tests: `packages/ui/tests/hooks/use-table-data.test.tsx` (uses
  `tests/helpers/stub-adapter.ts` and `@testing-library/react`'s
  `renderHook`; happy-dom is registered by `tests/setup.ts`).
  `packages/core/tests/lib/format-utils.test.ts` exists (835 bytes) — extend
  it, don't create a parallel file.

- Conventions: `@better-tables/ui` is private (no changeset needed);
  `@better-tables/core` is published (changeset REQUIRED — patch bump).
  Strictness flags `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
  are on in core and ui — no non-null assertions.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| UI tests | `cd packages/ui && bun test` | all pass |
| Core tests | `cd packages/core && bun test` | all pass (1181+ as of `787a816`) |
| Typecheck | `bun run typecheck` (root) | exit 0 |
| Changeset | `bun run changeset` (root, interactive) — or write `.changeset/<slug>.md` by hand matching an existing file's frontmatter | file exists |

## Scope

**In scope** (the only files you should modify):
- `packages/ui/src/hooks/use-table-data.ts`
- `packages/ui/tests/hooks/use-table-data.test.tsx`
- `packages/core/src/lib/format-utils.ts`
- `packages/core/tests/lib/format-utils.test.ts`
- `.changeset/<new-file>.md` (core patch)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `packages/ui/src/hooks/use-virtualized-table-data.ts` and
  `use-facets.ts` — already correct; they are the reference, not the target.
- `packages/core/src/lib/date-utils.ts` — `formatDateWithConfig`'s signature
  and timezone semantics (plan 028) stay untouched; coercion happens in
  `format-utils.ts` before the call.
- The HTTP adapter files — date *wire* semantics are plan 035's concern.
- Any change to `UseTableDataOptions`' public shape.

## Git workflow

- Branch: `fix-usetabledata-loop-date-render`
- Commits: `Plan 034 Step N: <imperative summary>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Stabilize `useTableData` defaults

In `packages/ui/src/hooks/use-table-data.ts`, add module-level constants
above the hook (mirroring the `use-virtualized-table-data.ts` comment style):

```ts
// Stable defaults so omitted `filters`/`params` don't recreate `fetchData`'s
// identity (and retrigger the fetch effect) on every render the way inline
// `= []` / `= {}` default-parameter literals would.
const EMPTY_FILTERS: FilterState[] = [];
const EMPTY_PARAMS: Record<string, unknown> = {};
```

and change the signature defaults to `filters = EMPTY_FILTERS`,
`params = EMPTY_PARAMS`. (`FilterState` is already imported in this file; if
the params type in `UseTableDataOptions` is narrower than
`Record<string, unknown>`, type the constant to match the option's declared
type instead.)

**Verify**: `cd packages/ui && bun test` → existing suite still passes;
`bun run typecheck` (root) → exit 0.

### Step 2: Regression test that fails on the old code

In `packages/ui/tests/hooks/use-table-data.test.tsx`, add a test using a
stub adapter whose `fetchData` **resolves immediately** and counts calls:

- Render the hook via `renderHook` with ONLY `{ adapter }` (both `filters`
  and `params` omitted — the loop trigger).
- Await one microtask flush (`await act(async () => {})` or the file's
  existing async-settling helper), then call `rerender()` two or three
  times with the same props, flushing between.
- Assert the adapter's `fetchData` call count is exactly **1**.

With the pre-fix code this count grows with every resolve/render cycle;
with the fix it stays 1. Model setup/imports on the existing tests in the
same file and `tests/helpers/stub-adapter.ts` (extend the helper only if it
cannot already count calls — prefer a local counting wrapper in the test).

**Verify**: `cd packages/ui && bun test hooks/use-table-data.test.tsx` → all
pass including the new test. Optional but recommended proof: temporarily
revert Step 1 (`git stash`), run the new test, confirm it FAILS, then
`git stash pop`.

### Step 3: Coerce string/number dates in `getFormatterForType`

In `packages/core/src/lib/format-utils.ts`, replace the `date` case with:

```ts
case 'date': {
  const dateConfig = meta?.dateFormat as Record<string, unknown> | undefined;
  if (value instanceof Date || (value && typeof value === 'object' && 'getTime' in value)) {
    return formatDateWithConfig(value as Date, dateConfig || {});
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const coerced = new Date(value);
    if (!Number.isNaN(coerced.getTime())) {
      return formatDateWithConfig(coerced, dateConfig || {});
    }
  }
  return String(value || '');
}
```

Behavior contract: ISO strings and epoch-millisecond numbers format exactly
like the equivalent `Date`; unparseable strings keep the current
`String(value)` fallback; `null`/`undefined` keep returning `''`.

**Verify**: `cd packages/core && bun test lib/format-utils.test.ts` → passes
(new cases come in Step 4); root `bun run typecheck` → exit 0.

### Step 4: Formatter test cases

Extend `packages/core/tests/lib/format-utils.test.ts` with `date`-type cases
(match the file's existing structure):

1. ISO string `'2026-03-10T09:00:00.000Z'` → equals the output of the same
   value passed as `new Date('2026-03-10T09:00:00.000Z')` (assert equality
   between the two calls rather than a hardcoded string — keeps the test
   timezone-config agnostic).
2. Epoch ms number (`new Date('2026-03-10T09:00:00.000Z').getTime()`) →
   same equality assertion.
3. Unparseable string `'not-a-date'` → returns `'not-a-date'`.
4. `null` → `''` (locks the existing fallback).

**Verify**: `cd packages/core && bun test` → all pass, including 4 new
assertions.

### Step 5: Changeset + gates + ledger

Add a changeset for `@better-tables/core` (patch):
"getFormatterForType now formats date columns receiving ISO strings or epoch
numbers (as produced by JSON transports like httpAdapter) instead of
rendering them raw." (`@better-tables/ui` is private — no changeset.)
Run root `bun run typecheck` + core and ui `bun test`. Update the plan 034
row in `plans/README.md`.

**Verify**: changeset file exists with `"@better-tables/core": patch`
frontmatter; all gates green.

## Test plan

- New UI test (Step 2): fetch-count regression locking the stable-identity
  contract — the specific bug this plan fixes.
- New core tests (Step 4): string/number/invalid/null date formatting.
- Pattern sources: `packages/ui/tests/hooks/use-table-data.test.tsx`
  (existing structure), `packages/core/tests/lib/format-utils.test.ts`.
- Verification: `cd packages/ui && bun test` and
  `cd packages/core && bun test` → all pass with the new tests present.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "filters = \[\]" packages/ui/src/hooks/use-table-data.ts` → no matches
- [ ] `grep -n "params = {}" packages/ui/src/hooks/use-table-data.ts` → no matches
- [ ] `grep -n "EMPTY_PARAMS\|EMPTY_FILTERS" packages/ui/src/hooks/use-table-data.ts` → matches present
- [ ] `cd packages/ui && bun test` → pass, including a fetch-count test in `use-table-data.test.tsx`
- [ ] `cd packages/core && bun test` → pass, including new date-coercion cases
- [ ] Root `bun run typecheck` → exit 0
- [ ] A `.changeset/*.md` with `"@better-tables/core": patch` referencing date formatting exists
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 2 test does NOT fail against the pre-fix code (stash check) —
  that means the loop mechanism differs from this plan's analysis; report
  what you observed.
- Fixing the loop reveals the existing suite depended on the extra
  refetches (tests that only pass because of repeated fetches).
- `formatDateWithConfig` rejects or mis-handles coerced dates in a way that
  requires editing `date-utils.ts` (out of scope — report instead).
- The `params` option's declared type is not assignable from
  `Record<string, unknown>` and the constant needs a cast beyond a plain
  type annotation.

## Maintenance notes

- If `UseTableDataOptions` ever gains more optional array/object props, they
  need the same stable-default treatment — consider a lint note in review.
- Plan 035 (HTTP adapter) documents that dates cross the wire as ISO
  strings; this plan is what makes the UI render them correctly. If a future
  change adds wire-level Date revival, these formatter tests still hold
  (Date instances remain the fast path).
- Reviewer scrutiny: the Step 2 test's flush pattern — make sure it awaits
  real resolution (not just pending promises), otherwise it can pass
  vacuously like the pre-existing tests did.
