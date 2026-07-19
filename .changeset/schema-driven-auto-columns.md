---
"@better-tables/core": minor
---

Schema-driven auto columns: `t.auto()`, no-factory `define`, and one lazy resolver

The adapter already knows every column's name, type, nullability, and enum
values — auto columns make that knowledge flow into column definitions
instead of being re-typed by hand.

- **`TableAdapter.describeColumns?(table)`** (new optional capability) returns
  `InferredColumnSpec[]` — the schema-derived raw material (field, mapped
  column type, humanized label, enum options, nullable/PK/FK/writable).
- **No-factory define**: `tables.define('users')` /
  `defineTable<typeof tables>()('users')` / `defineTableRow<Row>()('users')`
  with NO factory produce a fully inferred table (`columns: []` +
  `autoColumns` marker).
- **`t.auto()`**: spread inside a factory —
  `columns: [...t.auto(), t.text('subject').editable()]` — includes every
  remaining schema column; explicit entries always win by id (explicit first,
  inferred in stable schema order). Inferred columns are read-only until
  explicitly overridden.
- **`resolveTableColumns(def, adapter)`** (exported): the ONE lazy resolver
  behind both halves, run at mount (never at definition time — the curried
  `defineTable` form stays runtime-adapter-free/RSC-safe) and memoized per
  (definition, adapter) pair. Enrichment runs with or without `t.auto()`: an
  explicit `t.option('status')` with no `.options()` gets its choices from
  the schema enum; declared config always wins, contradictions log a dev
  warn. `tableNeedsColumnResolution(def)` reports whether a definition needs
  the async hop at all — fully-declared tables skip it entirely.
- **Wire support**: `httpAdapter` proxies `describeColumns` through the
  shared TTL cache; `handleAdapterRequest` answers it (absent capability →
  `bad_request` envelope).
