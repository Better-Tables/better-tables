---
'@better-tables/adapters-drizzle': patch
---

Warn when a filter is dropped because its operator is invalid for its type

A filter leaf whose operator is not valid for its declared type (an unknown
operator, or one the adapter does not advertise for that type) is skipped so
partial URL/UI filter state can still fetch. That drop was silent — and because
dropping a leaf under implicit-AND *widens* the result set, a malformed filter
returned the full table with no error and no warning. Measured against a live
database: a filter with a mismatched type returned all 1,000,000 rows instead of
the 49,937 matching ones.

The fail-soft behavior is unchanged (dropping is deliberate — see plan 038), but
these drops now emit a `[better-tables]` warning naming the column, operator and
type. Warnings are value-free, matching the existing `normalizeFilterNode` and
`deserializeFiltersFromURL` convention.

Genuinely incomplete values on a supported operator — a user who picked a column
but has not finished typing — remain silent, since warning there would fire on
every keystroke.
