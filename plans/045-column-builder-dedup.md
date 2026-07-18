# Plan 045: De-duplicate the six column builders (shared operator setter + normalized accessor constraint)

> **Executor instructions**: Follow step by step; run every verification and
> confirm before moving on. On any STOP, stop and report. Update
> `plans/README.md` when done unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- packages/core/src/builders`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (type-level fluent-builder change; 1181-test core suite is the guard)
- **Depends on**: 038 recommended first (also touches option operators); land 038, then rebase
- **Category**: tech-debt
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

The six type-specific column builders repeat two verbatim override methods and
six identical-bodied operator setters, and the accessor constraint has quietly
drifted:

- Every builder repeats `override id<const K>` and `override accessor<V>`,
  differing only in the return-type cast (`text-column-builder.ts:52,66`,
  `number/boolean/date` at `:51,65`, `option` at `:61,79`, `multi-option` at
  `:54,72`).
- The `*Operators()` methods (`textOperators`/`numberOperators`/…/
  `multiOptionOperators`) have **identical bodies**
  (`this.config.filter = { ...this.config.filter, operators }; return this;`),
  differing only in the operator string-union parameter type.
- Drift: `text/number/date/boolean` constrain `accessor<V extends string|number|Date|boolean>`,
  but `option`/`multi-option` use `V extends TValue` — a different, undocumented-
  as-a-group contract.

Any base-builder method that must return the narrowed subclass type is
re-declared 6×; the operator duplication compounds plan 038's drift risk.

## Current state

Verified at `787a816`:

- `packages/core/src/builders/text-column-builder.ts:52` `override id<const K extends string>`
  and `:66` `override accessor<V extends string>` — casts to
  `TextColumnBuilder<...>`. The same pattern in each sibling builder.
- Operator setters: `boolean-column-builder.ts:91` `booleanOperators(operators: Array<'isTrue'|'isFalse'|'isNull'|'isNotNull'>): this`,
  `date-column-builder.ts:143` `dateOperators(...)`,
  `multi-option-column-builder.ts:184` `multiOptionOperators(...)`,
  `number-column-builder.ts:155` `numberOperators(...)`,
  `option-column-builder.ts:169` `optionOperators(operators: Array<'is'|'isNot'|'isAnyOf'|'isNoneOf'>): this`
  — all with the same one-line body.
- `option-column-builder.ts:79` `accessor<V extends TValue>` (the drifted
  constraint).
- Base class: `packages/core/src/builders/column-builder.ts` (the shared
  parent) — the natural home for a protected `applyOperators` helper.
- Core suite: 1181 tests (`packages/core/tests/builders/`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Core tests | `cd packages/core && bun test` | pass (1181+) |
| Builder tests | `cd packages/core && bun test builders` | pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/core/src/builders/column-builder.ts` (base: `applyOperators`)
- The six `*-column-builder.ts` files (thin operator wrappers; normalized
  accessor constraint)
- `packages/core/tests/builders/*` (add/adjust as needed)
- `.changeset/*.md` (core patch, only if any public type narrows — see STOP);
  `plans/README.md`

**Out of scope**:
- The operator string-unions themselves (plan 038 owns the canonical sets).
- Changing which operators are valid per type.
- `column-factory.ts`, `path-builders.ts`.

## Git workflow

- Branch: `column-builder-dedup`; commits `Plan 045 Step N: …`.

## Steps

### Step 1: Shared protected operator setter

In `column-builder.ts`, add
`protected applyOperators(operators: readonly string[]): this { this.config.filter = { ...this.config.filter, operators }; return this; }`
(match the existing `config.filter` typing). In each of the six builders,
replace the `*Operators` body with `return this.applyOperators(operators);`
— keeping each public method's typed operator-union parameter (that's the
DX-preserving type surface; only the body is shared).

**Verify**: `cd packages/core && bun test builders` → all pass; the public
signatures of `textOperators` etc. are unchanged (grep confirms the
parameter unions are intact).

### Step 2: Reduce the id/accessor re-declaration tax

Assess whether the `override id<const K>` / `override accessor<V>` narrowing
can be centralized. The fluent-builder "return the narrowed subclass"
pattern is a known TS cost; if a shared `this`-rebinding helper on the base
(returning `this` typed to the subclass via a protected generic) removes the
per-file boilerplate without changing the public return types, apply it.
If it can't be done without changing the observable return types (which
would be a breaking DX change), SKIP this step and leave id/accessor as-is —
the operator dedup (Step 1) is the main win.

**Verify**: `bun test builders` → pass; the builders' fluent return types
(what chaining sees) are unchanged — add/confirm a type test in
`tests/builders/` or `tests/types/` that `t.text().id('x').accessor(...)`
still infers the literal id and value type.

### Step 3: Normalize the accessor constraint

Decide the accessor constraint deliberately: the value-family constraint
(`string|number|Date|boolean`) vs the prior-value constraint
(`V extends TValue`). Pick one policy and document it in a comment on the
base builder. If option/multi-option genuinely NEED `V extends TValue`
(narrowing to the declared option value type), keep it but add a comment
explaining WHY it differs — turning silent drift into a documented decision.
Do NOT loosen a constraint that was catching real mistakes.

**Verify**: `bun test builders` → pass; add a type test asserting the chosen
constraint (e.g. an invalid accessor return type is a compile error where
intended).

### Step 4: Gates + changeset + ledger

`cd packages/core && bun test`; `bun run typecheck`. Changeset for
`@better-tables/core` ONLY IF a public type observably changed (patch:
"internal column-builder dedup; accessor constraint normalized/documented").
If Steps 2–3 left public types identical, no changeset. Update plan 045 row.

## Test plan

- Existing builder suite (1181 core tests) guards runtime behavior.
- New/confirmed type tests: literal-id + accessor-value inference still works
  (Step 2); the chosen accessor constraint rejects the intended invalid case
  (Step 3). Model on `packages/core/tests/types/*` and `tests/builders/*`.

## Done criteria

- [ ] `column-builder.ts` has a protected `applyOperators`; all six `*Operators` bodies delegate to it (grep: no repeated `this.config.filter = { ...this.config.filter, operators }` in the six files)
- [ ] Public `*Operators` signatures + builder fluent return types unchanged (type tests pass)
- [ ] The accessor constraint is one documented policy (or the option/multi-option difference is explained in a comment)
- [ ] `cd packages/core && bun test` → pass; `bun run typecheck` exit 0
- [ ] Changeset only if a public type changed; `plans/README.md` updated

## STOP conditions

- Step 2's centralization changes any builder's observable fluent return type
  (chaining breaks or inference degrades) — revert Step 2, keep Step 1, report.
- Normalizing the accessor constraint (Step 3) would reject a usage the tests
  currently rely on — that means the constraint difference is load-bearing;
  document it instead of unifying, and report.
- Any core builder test fails in a way that implies a runtime behavior change
  (dedup should be behavior-neutral).

## Maintenance notes

- After plan 038, the operator unions are canonical; this plan makes adding a
  new builder cheaper (one thin wrapper, not a copied body).
- Reviewer scrutiny: the DX surface (typed per-type operator params, literal
  id inference) must be preserved — the shared body is an internal detail, not
  a public-type change.
