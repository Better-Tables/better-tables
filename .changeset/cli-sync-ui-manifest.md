---
"@better-tables/cli": patch
---

Fix `init` copying a stale file set: the copy manifest now matches the current UI source (adds the facets sidebar, filter type styles, and the facets/URL-sync/virtualized-data hooks; drops files that moved into `@better-tables/core`). A new test pins the manifest to the UI source tree so future drift fails CI instead of shipping a broken `init`.
