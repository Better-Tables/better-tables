---
"@better-tables/adapters-toolkit": minor
"@better-tables/adapters-drizzle": minor
---

Primary-table resolution and relationship inference no longer silently guess when there's no reliable signal:

- `PrimaryTableResolver` now throws a `SchemaError` when none of the requested columns match any table in the schema (e.g. a typo'd column id) instead of silently falling back to the first table in the schema and returning plausible-but-wrong rows. The error lists the unmatched columns, the available tables, and levenshtein-nearest suggestions (e.g. "did you mean `users.name`?"). Resolving with no columns at all (there's no better signal, and some internal callers legitimately pass none) still falls back to the first table, but now emits a single `console.warn` per resolver instance naming the assumed table and pointing at the `primaryTable` option to set it explicitly.
- The Drizzle adapter's convention-based foreign key guessing (used for `many()` relations without explicit `fields`/`references`, e.g. `posts: many(comments)`) now verifies the guessed column against real foreign key metadata before accepting it: metadata that confirms the guess is accepted silently, metadata that contradicts it (references a different table) causes that candidate to be skipped so a coincidentally-named column can't bind a join to the wrong table, and a total absence of metadata still accepts the guess but now warns once per detector instance. The assumed source primary key column also now comes from real primary-key metadata when available, instead of hard-coding `'id'`.

**What might change for you:**

- If a table/column-selection typo previously "worked" by silently resolving to the wrong table, it will now throw a `SchemaError` instead. Fix the typo, or set the `primaryTable` option explicitly.
- If your schema has `many()` relations without explicit `fields`/`references` and no foreign key metadata on the guessed column (e.g. no `.references()` and no schema-level FK), you'll start seeing a one-time `console.warn` per relation on first use. The relationship still resolves the same way as before; the warning is purely informational. Add a real foreign key / `.references()`, or define the relationship explicitly via manual relationships, to silence it.
