---
"@better-tables/core": minor
---

Execute plugin fetch hooks. `betterTables({ plugins })` previously stored plugins but never ran them; now `TableDefPlugin` models `beforeFetch(ctx)` / `afterFetch(ctx)` and `tables.fetchData` runs them around the adapter call in array order — `beforeFetch` can rewrite the params (with `primaryTable` already injected), `afterFetch` can transform the result. Hooks are async and thread their return value forward; a throwing hook fails the fetch (never swallowed); the no-plugin path is an empty-loop wrapper, unchanged in behavior.

Ships the first real plugin, `logPlugin({ onFetch })`, which observes each fetch's row count/total and returns the result unchanged.

New exports: `logPlugin`, `LogPluginOptions`, `LogPluginFetchInfo`, and the hook context types `PluginBeforeFetchContext` / `PluginAfterFetchContext`. Additional hook points (facet, write, per-row) are deliberately deferred until a second real plugin validates a second shape.
