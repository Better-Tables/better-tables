---
'@better-tables/adapters-drizzle': patch
---

`drizzleAdapter()` / `createDrizzleAdapter()` no longer silently drop `computedFields` and `hooks`

`DrizzleAdapterFactoryOptions` had no `computedFields` or `hooks` fields, so
both factory entry points ignored them without error — an adapter built with
`drizzleAdapter(db, { computedFields })` had no computed fields at all, and the
first filter on one failed with "Field … not found in primary table". Only the
`new DrizzleAdapter({ … })` constructor honored them.

Both options are now part of the factory surface (same shapes as
`DrizzleAdapterConfig`, via the shared `ComputedFieldsConfig<TSchema>` type)
and are forwarded to the constructor. Covered by end-to-end tests through
`fetchData` for both factories.
