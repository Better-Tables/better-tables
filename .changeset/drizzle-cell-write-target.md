---
"@better-tables/adapters-drizzle": minor
---

`resolveCellWriteTarget`: where a cell edit actually lands

Implements the new `TableAdapter.resolveCellWriteTarget(columnId, table?)`
capability (plan 055) — pure schema/relationship introspection, no query.
Flat ids resolve to the own table (PKs report `writable: false`);
relationship paths (`'customer.company'`) resolve through
`resolveColumnPath` to the REAL related table (the relationship's `to`, not
the alias) with `relatedIdPath` addressing the related row's PK through the
alias path in row data and `single: false` when any hop is one-to-many.
JSON accessors, bare relation aliases, unknown columns, and composite
related PKs resolve to `null`. Results are memoized per (table, columnId).
This powers joined-table cell editing end-to-end: policy admission in
`cellEditAction`, dot-column gating in the UI, and fail-closed validation
in the HTTP write proxy.
