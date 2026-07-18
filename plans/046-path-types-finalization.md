# Plan 046: Finalize path-typed columns — promote from experimental, humanize auto-labels, document depth override, retire stale prototypes

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/types packages/core/src/builders packages/core/tests/types plans/design/table-definition-dx.md`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (type-surface promotion; a small new runtime helper)
- **Depends on**: none (018's runtime shipped; this finalizes the type layer)
- **Category**: tech-debt / direction
- **Planned at**: commit `787a816`, 2026-07-17
- **Maintainer decisions (2026-07-17)**, from `plans/design/table-definition-dx.md`
  open questions:
  - **(a)** path types live in **`@better-tables/core`** (`src/types/`), NOT a
    new package.
  - **(c)** relationship depth cap default stays **3**, with a per-call
    override (`Paths<Row, 2>`) documented.
  - **(d)** `t.option()` auto-labels use a **runtime `humanize()` helper**
    (split on `_`/`-`, capitalize words), not type-level `Capitalize`.

## Why this matters

Plan 018 shipped the `betterTables()`/`defineTable()`/`t.*` runtime, but the
path-type machinery still sits in `packages/core/src/types/experimental/`
(test-only, not in the build), and three design-doc questions that the type
surface depends on were left open. The ledger also flags stale prototype
signatures (`contract-v2.ts:228-230` uses pre-021 param-less facet
signatures) and notes `$infer.ColumnId` currently displays as `string`
(union absorption — the future tuple-derived registry is meant to fix it).
This plan lands the DECIDED, shippable pieces and cleanly scopes the deeper
registry work out (to plan 047-adjacent follow-up), so the experimental dir
stops being a limbo.

## Current state

Verified at `787a816`:

- `packages/core/src/types/experimental/` contains `contract-v2.ts` (11k) and
  `table-def-v1.ts` (19k). Only `tests/types/*.test.ts` import them; the
  tsdown build entry is `src/index.ts`, which never imports experimental — so
  they ship to no consumer.
- `contract-v2.ts:226-231` — `TableAdapterV2` still has param-less facet
  signatures (`getFilterOptions(columnId)`, `getFacetedValues(columnId)`,
  `getMinMaxValues(columnId)`) — pre-021, which added `FacetQueryParams`.
- Design doc `plans/design/table-definition-dx.md:865-960` — the open
  questions (a)/(c)/(d)/(e) with recommendations; (b) already decided.
- `t.option()` builder: `packages/core/src/builders/option-column-builder.ts`
  — `.options([...])` sets labels; there is no auto-label humanize helper today.
- The ledger records `$infer.ColumnId` displays as `string` (018 flag).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Core tests | `cd packages/core && bun test` | pass |
| Type tests | `cd packages/core && bun test types` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Perf gate | (the core benchmark the ledger cites) | within budget |

## Scope

**In scope**:
- Promote the path-type utilities out of `experimental/` into
  `packages/core/src/types/` (only the ones that are decided-and-used; leave
  the deep registry prototype where it is if it's not ready — see Step 4)
- Add a runtime `humanize()` helper (core `src/utils/`) + wire `t.option()`
  auto-labels to it
- Document the depth-cap per-call override (`Paths<Row, 2>`) in the type's
  JSDoc + the design doc's "resolved" note
- Fix or remove the stale `contract-v2.ts` facet signatures
- `packages/core/tests/types/*`; `.changeset/*.md`; `plans/README.md`;
  `plans/design/table-definition-dx.md` (mark (a)/(c)/(d) resolved)

**Out of scope**:
- The tuple-derived `ColumnId` registry itself (the deep 018 flag) — scope it
  to a follow-up; if you finish the promotion and it's tractable, note it, but
  do NOT block this plan on it.
- Write-surface types (plan 047).
- RSC/actions bridge (deferred — HTTP adapter is the bridge; plan 035).

## Git workflow

- Branch: `path-types-finalization`; commits `Plan 046 Step N: …`.

## Steps

### Step 1: Runtime humanize helper + option auto-labels

Add `humanize(value: string): string` in `packages/core/src/utils/` (split on
`_`/`-`/camelCase boundaries, capitalize each word, join with spaces:
`'multi_word_value'` → `'Multi Word Value'`). Wire `t.option()` to use it as
the DEFAULT label when a caller passes bare option values without explicit
labels; `.options([{value,label}])` still overrides. Export `humanize` if
useful to consumers.

**Verify**: `cd packages/core && bun test` — add tests: `humanize` unit cases
(snake/kebab/camel/single-word); an option column with bare values gets
humanized default labels; explicit labels win.

### Step 2: Document the depth-cap override

On the `Paths<Row, D>` type (wherever it lives after promotion), add JSDoc:
default depth 3 (perf-justified, ~10x/2.5x headroom); pass `Paths<Row, 2>`
per call to lower it; re-measure the perf fixture before ever changing the
global default. Add a type test exercising `Paths<Row, 2>` (a depth-2 path
resolves, a depth-3 path does not).

**Verify**: `cd packages/core && bun test types` → pass, incl. the override
test; perf gate within budget.

### Step 3: Promote path types into `src/types/`

Move the decided, in-use path-type utilities from `experimental/` into
`packages/core/src/types/` (per maintainer decision (a)). Update the type
tests' imports. Do NOT add them to the runtime build if they're type-only
(they have no runtime code) — they become part of the public type surface via
`src/index.ts`'s type exports if intended to be consumer-facing; if they're
internal to `defineTable`'s inference, keep them internal. Decide based on
whether `defineTable`/`t.*` already re-exports them.

**Verify**: `bun run typecheck` exit 0; type tests pass with new import paths;
`grep -rn "types/experimental" packages/core/src` → only the still-unpromoted
prototype (Step 4) remains.

### Step 4: Reconcile the stale prototypes

Update `contract-v2.ts:226-231` facet signatures to carry `FacetQueryParams`
(match the shipped `TableAdapter`), OR — if `contract-v2.ts`/`table-def-v1.ts`
are pure historical prototypes with no forward use — delete them and their
tests, recording in the design doc that the registry work supersedes them.
Prefer updating over deleting only if the tests still assert something useful
about the future registry; otherwise delete to remove limbo. State which you
chose and why in your report.

**Verify**: `cd packages/core && bun test` → pass; no test imports a
now-deleted file; `bun run typecheck` exit 0.

### Step 5: Design-doc resolution + changeset + gates + ledger

- In `plans/design/table-definition-dx.md`, mark (a)/(c)/(d) RESOLVED with the
  maintainer's 2026-07-17 decisions and a pointer to this plan.
- Changeset for `@better-tables/core` (minor if the public type surface grew,
  e.g. exported `humanize` + promoted path types; patch if internal-only).
- Full gates; perf gate; update plan 046 row.

## Test plan

- `humanize` unit tests + option auto-label default/override (Step 1).
- `Paths<Row, 2>` override type test (Step 2).
- Promoted-type import tests still pass (Step 3).
- Prototype reconciliation leaves the type-test suite green (Step 4).
- Patterns: `packages/core/tests/types/*`, `tests/builders/*`.

## Done criteria

- [ ] `humanize()` exists with tests; `t.option()` bare values get humanized default labels, explicit labels override
- [ ] `Paths<Row, D>` documents the depth-3 default + per-call override; a depth-2 override type test passes
- [ ] Decided path types live under `packages/core/src/types/` (not `experimental/`); type tests pass with new paths
- [ ] `contract-v2.ts` stale facet signatures fixed or the prototype removed; no dangling test imports
- [ ] Design doc marks (a)/(c)/(d) resolved; changeset exists; perf gate within budget
- [ ] `bun run typecheck` exit 0; core tests pass; `plans/README.md` updated

## STOP conditions

- Promoting a path-type utility surfaces type errors in `defineTable`/`t.*`
  that trace to the tuple-derived-registry gap (the 018 `ColumnId=string`
  flag) — leave the deep registry in `experimental/`, promote only the
  independent utilities, and record the registry work as a scoped follow-up.
- `humanize` wiring changes existing option-label behavior for callers who
  passed bare values expecting the raw value as the label — that's a visible
  change; put it under the 0.6 window with a MIGRATION note and flag it.
- Deleting a prototype file breaks a type test that was actually guarding
  shipped behavior — update instead of delete, report.

## Maintenance notes

- The tuple-derived `ColumnId` registry (making `$infer.ColumnId` a literal
  union instead of `string`) remains the open deep item — record it as a
  scoped follow-up in the ledger, seeded by whatever stays in `experimental/`.
- `humanize` is now a shared util — the write-surface plan (047) and any
  future auto-label site should reuse it, not re-implement.
- Reviewer scrutiny: whether promoted types are correctly public vs internal,
  and that the perf gate didn't regress from the promotion.
