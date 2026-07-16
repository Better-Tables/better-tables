---
"@better-tables/adapters-toolkit": patch
"@better-tables/adapters-drizzle": patch
---

fix(adapters): route `equals`/`notEquals` on number columns to the numeric handler

`equals` and `notEquals` are shared between text and number columns, but the
filter router dispatched them by operator name alone — always to the text
handler, which asserts a string value. Filtering a numeric column (e.g.
`reopenCount`) with `equals`/`notEquals` therefore threw `Invalid filter value
type: expected string`. The router now checks `columnType === 'number'` for
these shared operators (mirroring the existing date-`between` guard) and routes
them to the numeric handler.
