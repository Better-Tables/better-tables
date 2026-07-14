---
"@better-tables/adapters-drizzle": patch
"@better-tables/adapters-toolkit": patch
---

Fix date filters on SQLite `mode: 'timestamp'` columns

Range-shaped date operators (`is`, `isNot`, `isToday`/`isYesterday`/
`isThisWeek`/`isThisMonth`/`isThisYear`) crashed with `value.getTime is not a
function`, and the comparison operators (`before`/`after`) silently returned
wrong results, when filtering a Drizzle `integer('...', { mode: 'timestamp' })`
column. The predicate emitter pre-converted the bound `Date` to `getTime()` and
handed the raw number to Drizzle's typed `gte`/`lte` helpers, whose column
mapper expects a `Date` (and stores Unix **seconds**, not the millisecond value
the emitter produced). The emitter now binds `Date` objects and lets the column
mapper convert units correctly for both `timestamp` (seconds) and
`timestamp_ms` (milliseconds) columns.

Also fixes `between`/`notBetween` on date columns, which were silently dropped
(match every row): they were missing from the router's date supported-operator
list and dispatch, and had no date handler. They now apply an inclusive
day-range condition and are advertised in `adapter.meta.supportedOperators.date`.
