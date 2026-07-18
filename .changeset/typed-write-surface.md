---
"@better-tables/core": minor
"@better-tables/adapters-drizzle": patch
---

Add table-scoped instance writes (`tables.createRecord/updateRecord/deleteRecord`)
that inject an explicit mutation target, with optional `MutationOptions.table`
on the low-level adapter write methods.
