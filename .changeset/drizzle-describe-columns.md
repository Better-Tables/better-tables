---
"@better-tables/adapters-drizzle": minor
---

`describeColumns`: schema introspection for auto columns

The Drizzle adapter now implements `TableAdapter.describeColumns(table?)` —
pure schema introspection (no query), mapping each Drizzle column to an
`InferredColumnSpec`: enum columns (`pgEnum`, `text(..., { enum })`) become
`option` with humanized choice labels; the timestamp `columnType` family
(shared with the predicate emitter via the new `isTimestampDrizzleColumn`)
becomes `date`; arrays become `multiOption`; `string`/`number`/`bigint`/
`boolean`/`json` map directly; anything unmapped falls back to `text` with a
dev warn (inference is total — it never throws). Primary keys report
`writable: false`. `table` resolution matches the other read entry points
(explicit > `defaultPrimaryTable` > single-table zero-config), and results
are memoized per table object.
