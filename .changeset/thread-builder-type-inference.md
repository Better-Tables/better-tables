---
"@better-tables/core": minor
"@better-tables/ui": minor
---

Column builders now infer and propagate real value types end-to-end instead of widening everything to `string`/`unknown`, and the `BetterTable` boundary no longer erases column types to `any`.

**What breaks (migration-guide input):**

- **`.accessor()` rebinds `TValue` from the accessor's return type** on `ColumnBuilder` and all six specialized builders (`text`, `number`, `date`, `boolean`, `option`, `multiOption`). Code that previously relied on the class-level generic default (e.g. explicit `ColumnBuilder<TData, string>` annotations written to work around the old behavior) may need those explicit generics removed — inference now does the right thing on its own. Legacy call sites that pass an explicit generic annotation matching the accessor's actual return type still compile unchanged.
- **`.options()` on option/multi-option builders now takes a `const`-inferred literal array** (`options<const V extends TValue>(options: ReadonlyArray<FilterOption<V>>, ...)`), so `FilterOption` gained a generic parameter (`FilterOption<V extends string = string>`, default preserves old callers). Option values are now checked against the accessor's declared union — an option `value` outside that union is a compile error, and `cellRenderer`'s `value` parameter is the narrowed literal union (e.g. `'admin' | 'editor' | 'viewer'`) instead of plain `string`. Any `cellRenderer` body that cast `value as string` or otherwise worked around the old widening should drop the cast (see the demo app's `user-columns.tsx` for the before/after).
- **The `any`-erasure surface at the `BetterTable` boundary is gone.** `packages/ui`'s `BetterTableProps.columns` no longer accepts `ColumnDefinition<TData, any>[]`; build column arrays with the new `defineColumns<TData>()(...)` helper exported from `@better-tables/core` (`packages/core/src/builders/column-factory.ts`), which infers each column's value type independently and erases to `unknown` in one audited place instead of at every consumer. Consumers passing a raw array literal to `columns` should wrap it in `defineColumns<TData>()([...])`.

**Intentionally not included:** Step 3 of plan 005 (compile-time-gated `build()` via a phantom `TSet` type parameter, so forgetting `.id()`/`.displayName()`/`.accessor()` would be a compile error) was skipped per plan 011's approved path-first design (`t.text('name')` columns are complete-at-birth, so that failure class doesn't exist on the primary API going forward, and the fluent builder layer becomes low-level/internal after the 0.6 release). The runtime `validateConfig()` backstop remains unchanged — missing required config still throws at `build()` time, just not at compile time.
