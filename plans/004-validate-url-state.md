# Plan 004: Validate URL-deserialized table state and make bad input fail closed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/core/src/utils/filter-serialization.ts packages/core/src/utils/compression.ts packages/core/src/utils/type-guards.ts packages/core/src/managers/filter-manager.ts packages/core/src/managers/table-state-manager.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive validation gate; behavior only changes for inputs that today crash or corrupt)
- **Depends on**: 001 (CI gate) recommended
- **Category**: bug (security-adjacent: untrusted input crossing into query construction)
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

Filter and pagination state round-trips through the URL — that's a headline feature (shareable views). But the deserialization path trusts URL content almost completely: a decompressed `?filters=` payload is only checked with `Array.isArray` before its objects flow into (a) the client-side filter manager, whose validator reads `filter.values.length` and throws `TypeError` on a missing `values` — aborting the whole state restore — and (b) server-side query construction via `parseTableSearchParams` (documented for RSC/server usage). Separately, a URL `?limit=15` passes deserialization but `updateState` then throws because 15 isn't in `pageSizeOptions` — a self-inconsistent contract that crashes legitimate bookmarked URLs. A user-visible URL is untrusted input; it must be validated at the boundary, with invalid entries dropped (fail closed) and valid state preserved.

## Current state

- `packages/core/src/utils/filter-serialization.ts:63-90` — `deserializeFiltersFromURL`; the only structural guard is:

  ```typescript
  const decoded = decompressAndDecode<FilterState[]>(urlString);
  if (!decoded) {
    throw new Error('Failed to decompress data');
  }
  if (!Array.isArray(decoded)) {
    throw new Error('Invalid filter data format: expected array');
  }
  return decoded;   // ← individual filter objects never validated
  ```

- `packages/core/src/utils/compression.ts` — `decompressAndDecode` does `JSON.parse` on the decompressed string and returns `renameKeys(...) as T` (the cast is the whole "validation").
- `packages/core/src/managers/filter-manager.ts:385-415` — `validateFilter` dereferences `filter.values.length` with no guard (e.g. `filter.values.length > 0`, `filter.values.length !== operatorDef.valueCount`). A URL-derived object missing `values` throws `TypeError` here; `setFilters` runs this inside a `.filter()`, so one malformed entry kills the whole restore.
- `packages/core/src/utils/server-url-params.ts:62-88` — `parseTableSearchParams` returns the unvalidated `filters` to server code:

  ```typescript
  const deserialized = deserializeTableStateFromUrl(searchParams, {...});
  return {
    page: ..., limit: ...,
    filters: deserialized.filters,   // ← straight through
    ...
  };
  ```

- `packages/core/src/utils/url-serialization.ts:227-235` — `limit` parsing accepts any positive integer:

  ```typescript
  if (params.limit) {
    const limit = Number.parseInt(params.limit, 10);
    if (!Number.isNaN(limit) && limit > 0) {
      result.pagination.limit = limit;
    }
  ```

  …but `packages/core/src/managers/pagination-manager.ts:540-560` `validatePageSize` rejects any size not in `pageSizeOptions` (default `[10, 20, 50, 100]`), and `packages/core/src/managers/table-state-manager.ts:538-543` applies restored state unguarded:

  ```typescript
  if (limit !== undefined && limit !== this.paginationManager.getPageSize()) {
    this.paginationManager.changePageSize(limit);   // throws on 15
  }
  if (page !== undefined && page !== this.paginationManager.getCurrentPage()) {
    this.paginationManager.goToPage(page);          // throws when page > totalPages
  }
  ```

- Existing conventions to build on: `packages/core/src/utils/type-guards.ts` already exports per-type guards (`isTextFilterState`, `isNumberFilterState`, … at `:17-66`) — but note they take an already-typed `FilterState` input; the new boundary validator must accept `unknown`. The known filter `type` strings and `FilterOperator` union live in `packages/core/src/types/filter.ts:10-57` (operators) and `:156-239` (the eight `type` discriminants: `text|email|url|phone`, `number|currency|percentage`, `date`, `boolean`, `option`, `multiOption`, `json`, `custom`). Canonical operator definitions (with `valueCount`) are in `packages/core/src/types/filter-operators.ts`.
- Test conventions: `packages/core/tests/utils/filter-serialization.test.ts` and `tests/utils/url-serialization.test.ts` exist — extend them; they use plain `bun:test` (`describe/it/expect`).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                | exit 0              |
| Typecheck | `cd packages/core && bun run typecheck`  | exit 0              |
| Tests     | `cd packages/core && bun test`           | all pass            |
| Focused   | `cd packages/core && bun test tests/utils/filter-serialization.test.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `packages/core/src/utils/type-guards.ts` (add `isFilterStateShape(value: unknown): value is FilterState`)
- `packages/core/src/utils/filter-serialization.ts`
- `packages/core/src/utils/url-serialization.ts` (apply the same validation where filters/sorting are deserialized; clamp handled in manager instead — see Step 3)
- `packages/core/src/managers/filter-manager.ts` (harden `validateFilter` against malformed input)
- `packages/core/src/managers/table-state-manager.ts` (coerce-instead-of-throw on the restore path)
- `packages/core/src/index.ts` (export the new guard if package convention exports type-guards — check `utils/index.ts`)
- `packages/core/tests/utils/filter-serialization.test.ts`, `packages/core/tests/managers/table-state-manager.test.ts` (extend)
- `.changeset/*.md` (create; patch bump for `@better-tables/core`)

**Out of scope** (do NOT touch, even though they look related):
- `compression.ts` `renameKeys` recursion (CORE-06 in `plans/README.md`) — changes the wire format; separate decision.
- The Drizzle adapter's silent filter-drop (ADAPTER-07) — same failure *class* but a separate package and release; noted in README for a follow-up.
- Pagination manager's `validatePageSize` policy itself — don't loosen what sizes are allowed; change only how the *restore path* handles invalid ones.

## Git workflow

- Branch: `validate-url-state`
- Commit style: imperative sentence, e.g. "Validate URL-deserialized filters and clamp restored pagination"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an `unknown`-input filter shape guard

In `type-guards.ts`, add `isFilterStateShape(value: unknown): value is FilterState` that checks: value is a non-null object; `columnId` is a non-empty string; `type` is one of the eight known discriminants; `operator` is a known `FilterOperator` (build the set from the definitions in `types/filter-operators.ts` — do not hand-copy the union, import the canonical list so it can't drift); `values` is an array; when present, `includeNull` is boolean. Per-type element checking (e.g. all-numbers for `number`) is a bonus, not required — the managers re-validate values.

**Verify**: `cd packages/core && bun run typecheck` → exit 0

### Step 2: Filter invalid entries at every deserialization boundary

In `filter-serialization.ts` `deserializeFiltersFromURL` (and the sibling path in `url-serialization.ts` where `filters` are decoded inside `deserializeTableStateFromUrl`): after the `Array.isArray` check, map the array through `isFilterStateShape`, **dropping** invalid entries (fail closed — a filter we can't trust must not silently become "no filter" at the adapter; dropping at the boundary with a `console.warn` naming the dropped `columnId`/reason is the chosen semantic, matching the "lenient mode" spirit the filter manager already has for UI editing). Return the surviving valid filters. Only throw when *nothing* about the payload is usable (current behavior for non-arrays stays).

**Verify**: `cd packages/core && bun test tests/utils/filter-serialization.test.ts` → existing tests still pass

### Step 3: Make the restore path coerce instead of throw

- `filter-manager.ts` `validateFilter`: guard the `values` access (`Array.isArray(filter.values)` first; if not, return `{ valid: false, error: ... }` instead of throwing).
- `table-state-manager.ts:538-543` (`updateState` pagination application): wrap the two calls in validation — if `changePageSize(limit)` would fail (call the manager's public validation or catch its error), fall back to the nearest allowed page size (e.g. the closest value in `pageSizeOptions`) and `console.warn`; if `goToPage(page)` would fail because `page > totalPages`, clamp to the last valid page. Restoring a shared URL must never throw for out-of-range numbers.

**Verify**: `cd packages/core && bun test tests/managers/table-state-manager.test.ts` → passes

### Step 4: Tests for the attack/corruption cases

Extend `tests/utils/filter-serialization.test.ts` (build malicious payloads with the package's own `serializeFiltersToURL`/compression helpers, then tamper before deserializing — or compress hand-built JSON with the same lz-string calls `compression.ts` uses):

1. Filter object missing `values` → dropped, remaining valid filters survive, no throw.
2. Filter with unknown `type` / unknown `operator` → dropped.
3. Filter where `values` is a string, not array → dropped.
4. Completely valid payload → identical round-trip (regression guard).
5. Non-array payload → throws (existing behavior preserved).

Extend `tests/managers/table-state-manager.test.ts`:

6. `updateState({ pagination: { limit: 15 } })` → no throw; page size becomes a member of `pageSizeOptions` (nearest = 10 or 20 — assert your chosen rule).
7. `updateState({ pagination: { page: 999 } })` with a small dataset → no throw; clamped to last page.

**Verify**: `cd packages/core && bun test` → all pass including 7 new tests

### Step 5: Changeset

`.changeset/validate-url-state.md`, patch bump for `@better-tables/core`: "URL-deserialized filters are now shape-validated (invalid entries dropped with a warning) and restored pagination is clamped instead of throwing."

**Verify**: `ls .changeset/*.md` shows the file

## Test plan

Steps 4's seven cases; model on the existing `describe/it` structure in `tests/utils/filter-serialization.test.ts`. The malformed-`values` crash (case 1) and the `limit=15` throw (case 6) are the two regressions this plan exists to prevent — they must be present by name in test descriptions.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "isFilterStateShape" packages/core/src/utils/type-guards.ts packages/core/src/utils/filter-serialization.ts` → defined and used
- [ ] `cd packages/core && bun run typecheck` exits 0
- [ ] `cd packages/core && bun test` exits 0 with the 7 new tests present
- [ ] `.changeset/*.md` exists
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Excerpted code at the cited lines doesn't match (drift).
- You cannot import the canonical operator list from `types/filter-operators.ts` without a circular import — report the cycle rather than duplicating the operator strings.
- Existing tests assert that malformed filters throw from `deserializeFiltersFromURL` (would mean the throw-on-bad-entry behavior is depended on; the drop-and-warn semantic then needs maintainer sign-off).
- Clamping page size requires knowledge of per-table `pageSizeOptions` that isn't reachable from `table-state-manager.ts` — report instead of hard-coding `[10,20,50,100]`.

## Maintenance notes

- Plan 006's contract redesign (typed filters + AND/OR groups) will change the serialized shape; `isFilterStateShape` is the single place to extend when group nodes exist — keep it the only boundary validator.
- Follow-up recorded in `plans/README.md`: the Drizzle adapter still silently drops type-mismatched filter values deep in `filter-handler.ts` (fails open). After this plan, core drops them at the boundary first, but the adapter-side hardening (throw `QueryError` on type mismatch) should ride along with plan 007's refactor.
- Reviewers: check the `console.warn` messages don't print filter *values* (may contain user data) — column id and reason only.
