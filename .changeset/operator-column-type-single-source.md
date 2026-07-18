---
'@better-tables/core': patch
'@better-tables/adapters-toolkit': patch
'@better-tables/adapters-drizzle': patch
---

Single-source `COLUMN_TYPES` and adapter supported-operator tables from core's `FILTER_OPERATORS`. Option columns now accept canonical `is`/`isNot` at the adapter gate (matching builder defaults); `equals`/`notEquals` remain aliases.
