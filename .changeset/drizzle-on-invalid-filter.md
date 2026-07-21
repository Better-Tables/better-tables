---
'@better-tables/adapters-drizzle': minor
---

Add `onInvalidFilter: 'skip' | 'throw'` for strict, fail-closed filtering

When a filter leaf can't be translated to SQL — an operator that isn't valid
for the column's type, or a supported operator with missing/incomplete values —
the adapter drops it by default so partial URL/UI filter state still fetches.
But dropping a leaf **widens** the result set: under implicit-AND a discarded
predicate reads as "no restriction", so a filter meant to scope rows (a tenant
or owner guard built server-side) silently returns everything.

The new `options.onInvalidFilter` makes that choice explicit:

- `'skip'` (default, unchanged) — drop the leaf and continue. An invalid
  operator still warns; incomplete values stay silent.
- `'throw'` — raise a `QueryError` instead of dropping, so a malformed scoping
  filter fails loudly rather than exposing rows.

```ts
const adapter = drizzleAdapter(db, {
  options: { onInvalidFilter: 'throw' },
});
```

The option threads through every dialect (Postgres/MySQL/SQLite) and applies to
both flat filters and leaves nested inside a `FilterGroupNode`. The legitimate
"match null rows only" intent (`includeNull` with empty values) is a real
condition, not a drop, and is unaffected. As part of this change, a `QueryError`
raised during filter translation now propagates with its type intact instead of
being flattened into a generic `Error`.
