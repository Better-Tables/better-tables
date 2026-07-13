---
"@better-tables/adapters-toolkit": minor
"@better-tables/adapters-drizzle": minor
---

The Drizzle adapter now translates `FilterGroupNode` AND/OR trees to real SQL
instead of rejecting them. `adapter.meta.supportsFilterGroups` is now `true`
(previously `false`), with `maxGroupDepth: 3` enforced on `fetchData` at the
public API boundary (a `QueryError` naming the cap is thrown for a deeper
tree; core's own URL-boundary normalization already caps at the same depth,
but `fetchData` is a public API callers can hit directly with unnormalized
trees). A group anywhere in the tree — including nested inside another group,
and mixing direct and cross-table (joined) leaves — now produces correct
`AND`/`OR` `WHERE` clauses, with all JOINs required by any leaf in the tree
present via `LEFT JOIN` regardless of which branch of an `OR` ultimately
matches. `total` and paginated results agree under `OR` queries (the count
query translates the same tree as the data query). A flat `FilterState[]`
(implicit AND) behaves exactly as before — this is additive, not a behavior
change for existing callers.

`@better-tables/adapters-toolkit`'s `FilterRouter` gains
`buildNodeCondition(node, leafCondition)`: a generic recursive walk over a
`FilterNode` (leaf or `FilterGroupNode`) that classifies and combines via the
existing `PredicateEmitter.and`/`or`, with leaf resolution supplied by the
caller. The `PredicateEmitter` interface itself is unchanged, so a future
Prisma adapter (or any other) gets group translation by reusing this method
and supplying its own leaf resolver.

This supersedes the interim "Drizzle adapter rejects filter groups" behavior
shipped ahead of this change — that changeset is removed since the described
reject-only behavior no longer exists.
