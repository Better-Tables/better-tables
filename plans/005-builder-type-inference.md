# Plan 005: Thread real type inference through the column builders and the BetterTable boundary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/core/src/builders/ packages/core/src/types/column.ts packages/ui/src/components/table/table.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (public generic signatures change; goal is that existing correct call sites compile unchanged)
- **Depends on**: 001 (CI gate — this change needs typecheck running everywhere)
- **Category**: dx
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

The library's headline claim is "end-to-end type safety", but today: option columns widen literal unions to `string` (the library's own demo has to cast inside `cellRenderer`); `.id()` accepts any string with no relationship to the data type; forgetting `.id()`/`.displayName()`/`.accessor()` compiles fine and throws at runtime; and at the single most important boundary — passing columns into `BetterTable` — everything collapses to `ColumnDefinition<TData, any>`. This plan makes the type system actually deliver the promise: values inferred from accessors flow to renderers and validation, missing required config is a compile error, and `any` disappears from the public boundary. This is the foundation the maintainer's "full typesafety" goal stands on, and plans 006/008 build on its conventions.

Relationship to plan 011: plan 011 designs a path-first definition API (`t.text('profile.location')`) **layered on top of** this plan's primitives — the `t.*` builders reuse the accessor/value inference (Step 1), the `const`-literal options checking (Step 2), and the de-`any`'d boundary (Step 5). Those steps are unconditional. Step 3 (compile-gated `build()`) is the one piece the path API obsoletes — see the conditional note in Step 3.

## Current state

- `packages/core/src/builders/column-builder.ts:61` — `export class ColumnBuilder<TData = unknown, TValue = unknown>`; `.id()` at `:106` takes plain `string`; `.accessor()` at `:137-140` uses the class-level `TValue` rather than inferring:

  ```typescript
  accessor(accessor: (data: TData) => TValue): this {
    this.config.accessor = accessor;
    return this;
  }
  ```

- All six specialized builders pin `TValue` at the class level, discarding inference:
  - `text-column-builder.ts:33` — `extends ColumnBuilder<TData, string>`
  - `number-column-builder.ts:32` — `extends ColumnBuilder<TData, number>`
  - `date-column-builder.ts:32` — `extends ColumnBuilder<TData, Date>`
  - `boolean-column-builder.ts:32` — `extends ColumnBuilder<TData, boolean>`
  - `option-column-builder.ts:35` — `extends ColumnBuilder<TData, string>` (this is where `'admin' | 'editor' | 'viewer'` becomes `string`)
  - `multi-option-column-builder.ts:35` — `extends ColumnBuilder<TData, string[]>`
- `option-column-builder.ts:68-80` — `.options(options: FilterOption[], config?)`; `FilterOption.value: string` (`packages/core/src/types/filter.ts:97-99`), so option values are neither inferred from nor checked against the accessor's return type.
- `column-builder.ts:363-379` — `build()` calls `validateConfig()` then `return this.config as ColumnDefinition<TData, TValue>`; `validateConfig()` at `:385-404` throws at **runtime** for missing id/displayName/accessor/type ("Column ID is required. Use .id() ..."). Nothing is compile-time.
- `packages/ui/src/components/table/table.tsx:51-57` — the `any` erasure at the consumer boundary:

  ```typescript
  // biome-ignore lint/suspicious/noExplicitAny: Need to accept columns with mixed value types
  type MixedColumnDefinition<TData> = ColumnDefinition<TData, any>;
  // ...
  columns: MixedColumnDefinition<TData>[];
  ```

- `packages/core/src/types/column.ts:27-38` — `ColumnDefinition<TData = unknown, TValue = unknown>` with `accessor: (data: TData) => TValue`; `cellRenderer` receives `CellRendererProps` (same file) whose `value` is `TValue`.
- `packages/core/src/builders/column-factory.ts:106` — `createColumnBuilder<TData = unknown>()` returns the factory with `.text()`, `.option()`, etc.; `:145` exports an untyped global `export const column = createColumnBuilder();`.
- Consumer proof of the failure: the demo (`apps/demo/lib/columns/user-columns.tsx`) writes `value as string` casts inside option-column `cellRenderer`s.
- Conventions: TS 5.8, `strict: true`. Builders are classes with `this`-returning fluent methods and heavy JSDoc on every public method — keep both. Existing builder tests: `packages/core/tests/builders/*.test.ts` (bun:test). Compile-time behavior is tested via type-level test files — see `packages/core/tests/types/*.test.ts` for the convention (they use `@ts-expect-error` style assertions and typed helper functions; mirror it).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                | exit 0              |
| Typecheck core | `cd packages/core && bun run typecheck` | exit 0          |
| Typecheck ui | `cd packages/ui && bun run typecheck` | exit 0              |
| Typecheck repo (apps/demo compile too) | `bun run typecheck` (root) | exit 0 |
| Tests     | `cd packages/core && bun test`           | all pass            |
| Build     | `bun run build` (root, turbo)            | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `packages/core/src/builders/*.ts` (all builders + `column-factory.ts`)
- `packages/core/src/types/column.ts`, `packages/core/src/types/filter.ts` (only the `FilterOption` genericization)
- `packages/ui/src/components/table/table.tsx` (remove the `any` erasure; type the prop as `ColumnDefinition<TData, unknown>` — wait for Step 5's shape)
- `packages/core/tests/builders/*.test.ts`, new `packages/core/tests/types/builder-inference.test.ts`
- `apps/demo/lib/columns/user-columns.tsx` (delete the now-unneeded casts — proves the win)
- `.changeset/*.md` (minor bump: `@better-tables/core`, `@better-tables/ui`)

**Out of scope** (do NOT touch, even though they look related):
- `TableAdapter` / `FetchDataParams` typing (`packages/core/src/types/adapter.ts`) — that contract redesign is plan 006; keep this plan compiling against the existing adapter types.
- Enabling `noUncheckedIndexedAccess` repo-wide (deferred; see `plans/README.md`).
- `virtualized-table.tsx` and filter input components — they consume `ColumnDefinition` but must keep compiling via the default `TValue = unknown`; only touch if typecheck forces a mechanical fix, and report it in the commit body if so.

## Git workflow

- Branch: `builder-type-inference`
- Commit per step; style: imperative sentence, e.g. "Infer option column value types from accessor return type"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `.accessor()` infer and rebind `TValue`

Change the fluent methods to return a **re-typed** builder instead of `this` where `TValue` is refined. The pattern (apply to the base class):

```typescript
accessor<V extends TValue>(accessor: (data: TData) => V): ColumnBuilderWithValue<this, TData, V>
```

Concretely: introduce a type-level rebinding rather than new runtime classes — the method body still `this.config.accessor = accessor; return this as ...`. For the base `ColumnBuilder<TData, TValue>`, `accessor<V>(fn: (data: TData) => V)` returns `ColumnBuilder<TData, V>` (safe: the config object is untyped internally). For subclasses, constrain `V` to the subclass's domain (`V extends string` for text/option, `V extends number` for number, etc.) and return the subclass type with `V` substituted — this requires the subclasses to become generic in `TValue` with a default (`class OptionColumnBuilder<TData, TValue extends string = string> extends ColumnBuilder<TData, TValue>`), which preserves existing behavior for code that never relies on inference.

**Verify**: `cd packages/core && bun run typecheck` → exit 0; existing builder tests pass (`bun test tests/builders/`)

### Step 2: Infer literal option values in `.options()`

In `option-column-builder.ts` (and the multi-option builder), genericize:

```typescript
options<const V extends TValue>(
  options: ReadonlyArray<FilterOption<V>>,
  config?: {...}
): OptionColumnBuilder<TData, V>
```

with `FilterOption<V extends string = string>` in `types/filter.ts` (`value: V`; default keeps every existing usage compiling). `const` type parameters (TS ≥5.0) preserve literal types without requiring `as const` at call sites. Now `.accessor(u => u.role).options([{value:'admin',...},{value:'editor',...}])` type-errors if an option value isn't in the accessor's union, and vice-versa flag mismatches surface.

**Verify**: `cd packages/core && bun run typecheck` → exit 0

### Step 3: Compile-time-gated `build()` — SKIP (decided 2026-07-12)

**Decision**: plan 011's design was approved by the maintainer on 2026-07-12 (see `plans/README.md`, rows 011 and RELEASE POLICY). The path-first API (`t.text('name')`) constructs columns complete-at-birth, so the "forgot `.id()`" failure class this step guarded against disappears from the primary API, and with the 0.6 breaking release the fluent layer is internal/low-level — phantom-type machinery there is maintenance weight with no consumer. SKIP this step; note the skip in your commit body. (The original step text is preserved below only so the numbering and the historical rationale survive; do not execute it.)

Track required config in a phantom type parameter. Minimal shape that avoids exploding the class hierarchy:

```typescript
type RequiredKeys = 'id' | 'displayName' | 'accessor';
class ColumnBuilder<TData, TValue, TSet extends RequiredKeys = never> {
  id(id: string): ColumnBuilder<TData, TValue, TSet | 'id'> { ... }
  displayName(n: string): ColumnBuilder<TData, TValue, TSet | 'displayName'> { ... }
  accessor<V>(...): ColumnBuilder<TData, V, TSet | 'accessor'> { ... }
  build(this: ColumnBuilder<TData, TValue, RequiredKeys>): ColumnDefinition<TData, TValue> { ... }
}
```

The `this`-parameter trick on `build()` produces a clear error ("The 'this' context of type ... is not assignable") only when a required method wasn't called. Keep `validateConfig()` as the runtime backstop (JS consumers). Subclass fluent methods that return `this` must be re-typed to propagate `TSet` — this is the mechanical bulk of the step. If the `this`-parameter error message proves too cryptic in practice, an acceptable alternative is a `build` overload returning `never` with a branded error-message type — choose one, don't ship both.

**Verify**: `cd packages/core && bun run typecheck` → exit 0. Add a type-level test (new `tests/types/builder-inference.test.ts`) with `// @ts-expect-error missing id` on a `.build()` after only `.displayName()`.

### Step 4: Type-level test suite

In `packages/core/tests/types/builder-inference.test.ts` (mirroring the conventions in the existing `tests/types/*.test.ts` files), assert:

1. `cb.option().id('role').accessor((u: User) => u.role)` → `cellRenderer(({ value }) => ...)` sees `value: 'admin' | 'editor' | 'viewer'` (use a `type Expect<T extends true> = T` / `Equal` helper if one exists in the existing type tests — reuse theirs, don't invent a second one).
2. `.options([{ value: 'admin', label: 'A' }, { value: 'bogus', label: 'B' }])` after that accessor → `@ts-expect-error`.
3. ~~`.build()` without `.accessor()` → `@ts-expect-error`.~~ **DROPPED (2026-07-13)** — Step 3 (compile-gated `build()`) is skipped; runtime `validateConfig()` remains the backstop. Breaking changes are in-policy for 0.6.
4. Plain `ColumnBuilder<User, string>` legacy-style usage still compiles (back-compat).

**Verify**: `cd packages/core && bun run typecheck && bun test tests/types/` → exit 0 / pass

### Step 5: Remove the `any` at the BetterTable boundary

In `packages/ui/src/components/table/table.tsx:51-57`, replace `MixedColumnDefinition<TData> = ColumnDefinition<TData, any>` with `ColumnDefinition<TData, unknown>`... **but** heterogeneous arrays of `ColumnDefinition<TData, V_i>` are not assignable to `ColumnDefinition<TData, unknown>[]` because `accessor`'s return type is covariant while `cellRenderer`'s `value` parameter is contravariant. The working shape: make the *prop* accept `ReadonlyArray<AnyColumnOf<TData>>` where

```typescript
type AnyColumnOf<TData> = {
  [K in keyof ColumnDefinition<TData, unknown>]: ColumnDefinition<TData, never> extends Pick<ColumnDefinition<TData, never>, K> ? never : never
} // ← placeholder; the practical implementation:
type AnyColumnOf<TData> = ColumnDefinition<TData, never> | ColumnDefinition<TData, unknown>;
```

If a clean variance-safe union proves unachievable (this is genuinely fiddly in TS), the acceptable fallback is: keep an internal erased type but make it `unknown`-based and **not exported**, and add a `defineColumns<TData>()` helper in core (`packages/core/src/builders/column-factory.ts`) that accepts a tuple of properly-typed built columns and returns the erased array — so the erasure happens in ONE audited place instead of at every consumer. Demo (`apps/demo/lib/columns/user-columns.tsx`) then drops its `as string` casts.

**Verify**: `cd packages/ui && bun run typecheck` → exit 0; `bun run typecheck` at root (compiles apps/demo) → exit 0; `grep -n "as string" apps/demo/lib/columns/user-columns.tsx` → 0 matches

### Step 6: Full verification + changeset

Root typecheck, full core test suite, turbo build. Changeset: minor bump for `@better-tables/core` and `@better-tables/ui` (per the RELEASE POLICY in `plans/README.md`, 0.x minor IS the breaking slot — this rides the 0.6.0 train). Breaking changes are acceptable and need no softening: the body lists what breaks (explicit builder generic annotations, any removed erasure surface) as migration-guide input, not as apology.

**Verify**: `bun run typecheck && bun run build` at root → exit 0; `cd packages/core && bun test` → pass

## Test plan

Type-level: Step 4's four assertions (the option-literal-union case is the flagship — name the test after it). Runtime: existing `tests/builders/*.test.ts` must pass unmodified except where they asserted the old runtime-throw for missing config — those stay valid (runtime backstop remains). Add one runtime test: `build()` after full chain returns a definition whose `accessor` output feeds `cellRenderer` untouched.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "ColumnDefinition<TData, any>" packages/ui/src/components/table/table.tsx` → 0 matches
- [ ] `grep -rn "as string" apps/demo/lib/columns/user-columns.tsx` → 0 matches
- [ ] `bun run typecheck` (root) exits 0
- [ ] `cd packages/core && bun test` exits 0, including `tests/types/builder-inference.test.ts`
- [ ] `bun run build` exits 0
- [ ] `.changeset/*.md` exists with minor bumps for core and ui
- [ ] No files outside the in-scope list are modified (`git status`) — mechanical compile fixes in ui filter components are permitted but must be listed in the commit body
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Excerpts at the cited lines don't match (drift).
- Step 3's phantom-type approach forces changes to more than ~15 files or breaks the six subclass builders' fluent chains in a way that requires duplicating every method signature — report with a sketch of the damage; the maintainer may prefer shipping Steps 1–2 alone first.
- Step 5's variance problem cannot be solved even with the `defineColumns` fallback without re-introducing `any` — stop and report; do NOT ship a hidden `any` and call it done.
- Root typecheck reveals pre-existing errors in `apps/web` or `apps/marketing` unrelated to this change — report; don't fix unrelated apps in this branch.

## Maintenance notes

- Plan 006 (contract v2) builds a typed column-id registry on top of this: once `TValue` flows, `FilterState` can be keyed per column. Whoever executes 006 should read this plan's final shape first.
- Plan 011 (path-typed definition API) consumes Steps 1/2/5 as primitives; its `t.*` builders must keep emitting the same `ColumnDefinition` shape this plan types. If Step 3 was skipped per its conditional, do not resurrect it later without checking 011's shipped state.
- Reviewers: scrutinize every `as` inside the builders after this change — the internal `config` object is the one sanctioned erasure point; new casts elsewhere are a smell.
- Future builders (e.g. a JSON column builder) must follow the `TSet`-propagation pattern or they silently lose the compile-time gating.
