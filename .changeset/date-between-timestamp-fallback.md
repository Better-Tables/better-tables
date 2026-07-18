---
"@better-tables/adapters-toolkit": patch
"@better-tables/adapters-drizzle": patch
---

date `between`/`notBetween` now fall back to date semantics on timestamp
columns when the filter's columnType isn't `date`, matching the other date
operators.
