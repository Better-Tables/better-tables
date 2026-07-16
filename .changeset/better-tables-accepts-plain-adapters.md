---
"@better-tables/core": patch
---

fix(core): `betterTables()` now accepts adapters that don't carry `$types`

`betterTables()` constrained its adapter generic to `SchemaAwareAdapter`, which
is all-optional (`{ $types?: T }`). That made it a **weak type**, so TypeScript
rejected any adapter with no properties in common with it:

```
Type 'MyAdapter' has no properties in common with type 'SchemaAwareAdapter<AdapterTypes>'
```

In other words, every adapter that doesn't populate the `$types` phantom —
REST, in-memory, and the new `httpAdapter`, i.e. exactly the adapters
`SchemaAwareAdapter`'s own documentation says are supported — could not be
passed to `betterTables()` at all without a cast. Only the Drizzle factory's
return type (which intersects the phantom in) worked, so the existing tests,
whose mock adapter explicitly declares `& SchemaAwareAdapter<...>`, never caught
it.

The constraint is now `object`. `SchemaOf<TAdapter>` still extracts the schema
catalog when `$types` is present, and adapters without it fall back to the
documented untyped-name behavior (`defineTable<TRow>()`). This only widens what
is accepted — no existing usage changes.
