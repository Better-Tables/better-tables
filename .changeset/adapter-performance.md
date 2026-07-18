---
"@better-tables/core": minor
"@better-tables/adapters-toolkit": patch
"@better-tables/adapters-drizzle": patch
---

Adapter performance: memoize schema column introspection and transformer
path/pk lookups, bound the Drizzle query cache with LRU eviction, and default
facet value queries to top-100 by count (`FacetQueryParams.limit`; `null` opts out).
