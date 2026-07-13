---
"@better-tables/adapters-drizzle": patch
---

Reject filter-group input explicitly until translation lands. Contract v2 widened `FetchDataParams.filters` to `FilterState[] | FilterGroupNode`; previously a group input would not compile against this adapter. It is now rejected at runtime with a clear `QueryError` ("Filter groups are not yet supported by the Drizzle adapter…") instead of being silently flattened — flattening an OR group into an implicit AND would return a wrong, narrower result set with no signal. The adapter also advertises the limitation truthfully via `meta.supportsFilterGroups: false`. Flat `FilterState[]` filtering is unchanged. Group translation (recursive AND/OR `WHERE` trees) lands in a follow-up release.
