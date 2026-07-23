---
"@better-tables/core": minor
"@better-tables/adapters-drizzle": minor
---

Guard against unbounded page sizes: the Drizzle adapter now clamps an incoming
`pagination.limit` to a configurable `maxPageSize` (new adapter option, default
`DEFAULT_MAX_PAGE_SIZE` = 200) before querying. Because `limit` is commonly
URL-driven (`?limit=…`), an oversized value previously flowed straight to the
database and forced the client to render tens of thousands of rows; it is now
capped, and the clamped value is reflected in the returned pagination metadata.
Raise `options.maxPageSize` for deliberately larger pages, or set it to a
non-positive value to disable the clamp. `DEFAULT_MAX_PAGE_SIZE` is exported
from `@better-tables/core`.
