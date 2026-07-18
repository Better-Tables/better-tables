---
"@better-tables/core": patch
---

Add in-flight deduplication and a short-TTL result cache for facet reads in `httpAdapter`. Configurable via `cacheTtlMs` (default 2000ms); `fetchData` remains uncached.
