---
"@better-tables/core": minor
---

`.id()` is now literal-preserving: `ColumnDefinition` gains a third type parameter, `TId extends string = string`, and `ColumnBuilder.id()` (plus its override in all six specialized builders) rebinds the builder's id type to the literal passed in rather than widening it to `string`. `.id('name').accessor(u => u.name).build()` now produces a definition whose `id` type is exactly `'name'`, in either call order (`.id().accessor()` or `.accessor().id()`), and dotted relation-path literals like `'profile.location'` are preserved as-is — `.id()` is intentionally not constrained to `keyof TData`.

This unblocks deriving a typed `columnId -> valueType` registry from a tuple of built column definitions (plan 006's contract-v2 design, plan 011's `defineTable()`).

**Migration:** the new type parameter defaults to `string`, so existing explicit two-parameter annotations (`ColumnBuilder<TData, TValue>`, `ColumnDefinition<TData, TValue>`) keep compiling unchanged. The only source of breakage is code that captured a builder variable *before* chaining `.id(...)` and later compared its static type against the post-chain result (e.g. `expectTypeOf` assertions) — the pre-chain variable's static type no longer matches the post-chain type even though both refer to the same mutated object at runtime.
