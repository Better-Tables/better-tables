---
"@better-tables/core": patch
---

Fix three `memoryAdapter` filter-evaluation bugs:

- `currency` and `percentage` columns now evaluate as numbers. They share `NUMBER_OPERATORS` with `number`, but only `number` was handled, so every filter on a currency/percentage column silently matched zero rows.
- `isThisWeek` now uses a Sunday-start week, matching the toolkit's `computeDatePeriodRange` (and therefore the Drizzle adapter). It previously used a Monday-start week, so the same filter returned different rows in memory than against SQL.
- The unevaluatable-filter fall-through no longer dereferences `process` bare, which threw `ReferenceError` in browsers without a `process` global. It also emits a one-time dev warning naming the column type and operator instead of silently returning no matches — `custom` columns support only the universal `isNull` / `isNotNull`, since their operators are user-defined.
