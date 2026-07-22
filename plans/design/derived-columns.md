# Design: Server-derived columns (aggregates)

> Design deliverable for **Step 1** of `plans/060-derived-aggregate-columns.md`.
> Decides the serializable spec shape, transport, capability declaration,
> honest builder defaults, and SQL lowering strategy. Prisma (061) and Kysely
> (062) declare against the capability shape chosen here.

---

## 1. Spec shape (declarative, serializable)

```ts
interface DerivedColumnSpec {
  kind: 'aggregate';
  /** Relation name on the primary table (e.g. `'posts'`). Single hop. */
  relation: string;
  fn: 'count' | 'sum' | 'avg' | 'min' | 'max';
  /** Required for sum/avg/min/max; ignored for count. */
  field?: string;
}
```

**Why no functions or SQL strings:** specs cross the HTTP wire and must be
validated server-side against the schema. The server builds SQL from an enum
+ schema-validated identifiers.

| `fn` | Result type | `field` |
|------|-------------|---------|
| `count` | `number` | ignored |
| `sum` / `avg` / `min` / `max` | follows target field (numeric) | required |

`distinct` (present on toolkit `AggregateColumn`) is **deferred** — not in
this union. Nested-relation paths (`posts.comments`) are deferred; `relation`
is a single hop by design.

---

## 2. Transport: `FetchDataParams.derived`

```ts
FetchDataParams.derived?: Array<{ columnId: string } & DerivedColumnSpec>
```

Attached by the two layers that own column definitions:

1. Core instance `fetchData` (`factory.ts`) — from `table.columns`
2. UI `use-table-data` — from its columns prop

**Not** adapter-constructor config. Rationale: stateless per-request, works
over HTTP unchanged, multi-table safe, keeps `defineTable` the single source
of truth. The adapter validates every spec against schema/relationships and
throws `SchemaError` on unknown relation/field or non-`many` cardinality.

When `params.columns` is set, only derived specs for requested column ids are
attached. When omitted, all derived columns on the table definition are
attached.

---

## 3. Security

Declarative-only is the injection boundary. A malicious client can at worst
request an aggregate over data the endpoint already serves. HTTP allow-lists
(docs `adapters/http.mdx`) apply to derived `columnId`s like any other id.
Adapters MUST build identifiers from relationship metadata, never from raw
client strings for table/column names (only enum `fn` + validated keys).

---

## 4. Honest defaults

| Builder | `filterable` / `sortable` default | Notes |
|---------|-----------------------------------|--------|
| `t.computed` / `t.custom` (`type: 'custom'`) | **false** / **false** | Client-only display; no DB column. Explicit `.filterable(true)` still works. |
| `t.count` / `t.aggregate` | **true** / **true** | Server-backed via `derived`; number operators work. |

---

## 5. Capability declaration (per-operation granularity)

Plan 061: Prisma can SELECT and ORDER BY a relation count but cannot
WHERE-by-count. A flat `fns: string[]` cannot describe that. Shape:

```ts
AdapterMeta.capabilities?: {
  aggregates?: {
    fns: Array<'count' | 'sum' | 'avg' | 'min' | 'max'>;
    render: boolean;
    filter: boolean;
    sort: boolean;
  };
}
```

- **Drizzle + memoryAdapter (this plan):** all fns; `render/filter/sort: true`.
- **Prisma (061 Phase 7):** likely `filter: false` with count still in `fns`.
- Core instance fetch throws early when specs are present and the adapter
  lacks a sufficient capability (missing block, missing `fn`, or
  `render === false`). Filter/sort requests are enforced at the adapter when
  those flags are false (or core can preflight when filters/sorts reference
  derived ids — prefer clear errors).

Vocabulary: use **capabilities** and the key **aggregates** (from
`table-definition-dx.md`).

---

## 6. SQL strategy

Correlated subqueries, lowered into the existing drizzle `ComputedFieldConfig`
pipeline (`filterSql` / `sortSql` / SELECT alias). No parallel pipeline. No
`GROUP BY`/`HAVING` (preserves pagination `total` and plan 003's
count-inflation hardening).

Example:

```sql
(SELECT count(*) FROM posts WHERE posts.user_id = users.id) AS "postsCount"
```

`FilterGroupNode` trees: substitute derived/`filterSql` leaves in place,
preserving AND/OR. Legacy callback-`filter` computed fields still reject
trees (with advice that does **not** recommend unconditional flattening).

---

## 7. Builder API

```ts
t.count('posts')                          // id postsCount, fn count
t.aggregate('revenue', { relation: 'orders', fn: 'sum', field: 'amount' })
t.count('posts').displayName('Posts')     // NumberColumnBuilder chain
```

Relation name is a runtime-validated string (schema check in the adapter).
Type-level relation autocomplete is a stretch — ship runtime validation as
the contract.
