---
"@better-tables/adapters-drizzle": patch
---

Fixed under-filled and truncated pages when fetching data across a one-to-many (or array-FK) join. `total` has counted distinct primary keys since the `fix-join-count-inflation` fix, but the data query still applied `LIMIT`/`OFFSET` to the row-multiplied join result — a "page of 10" could contain fewer than 10 distinct rows, and worse, a single row's related records could be split across two pages, silently truncating its nested array. Fetch results under one-to-many joins now fill pages correctly: every page has `min(limit, total - offset)` rows, no row is duplicated across pages, and no nested relationship array is ever split by pagination. Many-to-one/one-to-one joins (which never row-multiply) and the PostgreSQL relational-query path are unaffected — no API change.
