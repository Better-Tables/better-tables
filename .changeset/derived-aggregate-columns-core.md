---
"@better-tables/core": minor
---

Add declarative derived aggregate columns (`t.count` / `t.aggregate`), serializable
`DerivedColumnSpec` on column defs and `FetchDataParams.derived`, and
`AdapterMeta.capabilities.aggregates`. Instance `fetchData` and `memoryAdapter`
attach/evaluate specs; `'custom'` builders (`t.computed` / `t.custom`) now default
to `filterable: false` and `sortable: false`.
