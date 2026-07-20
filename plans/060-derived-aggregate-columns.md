# Plan 060: Server-derived columns — filterable, sortable aggregates ("how many posts does this user have")

> **Executor instructions**: DESIGN + BUILD plan. Step 1 writes the design
> record; do not start Step 2 until its decisions are recorded. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do
> not improvise. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- packages/core/src/builders packages/core/src/types packages/core/src/factory.ts packages/core/src/adapters/memory-adapter.ts packages/adapters/drizzle/src packages/adapters/toolkit/src/types.ts apps/marketing/src/lib/columns/user-columns.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (maintainer-requested direction centerpiece)
- **Effort**: L
- **Risk**: MED-HIGH (touches the fetch/filter/sort pipeline in core + drizzle; mitigated by phasing and by lowering into the adapter's EXISTING computed-fields machinery)
- **Depends on**: none to start. **Coordinate with**: 057 (contract removals — disjoint fields), 058 (both extend the instance fetch path in `factory.ts`; land in either order, rebase the second), 048 (filter-group UI — no file overlap, but this plan's tree-walk closes a gap 048 benefits from).
- **Category**: direction
- **Planned at**: commit `27c59b9`, 2026-07-20

## Why this matters

The flagship pitch is "define columns once, the adapter turns them into
SQL" — but the moment a column is *derived* ("posts count", "days since
last order"), the story collapses. Today:

- `t.computed(id, accessor)` is client-only display sugar, yet its builder
  inherits `filterable: true` / `sortable: true` defaults
  (`packages/core/src/builders/column-builder.ts:82-83`), so derived
  columns silently offer filter/sort controls that send a non-existent
  column id to the SQL layer. The homepage demo had to hand-disable both
  (`apps/marketing/src/lib/columns/user-columns.tsx`, `hasBio`/`roleTags`
  with `.filterable(false).sortable(false)` and a comment explaining why).
- The Drizzle adapter ALREADY has a full server-side derived-field engine —
  `ComputedFieldConfig` with `compute`, `filter` (FilterState
  substitution), `filterSql` (WHERE-clause SQL), and `sortSql`
  (`packages/adapters/drizzle/src/types/computed-fields.ts:61-81`; sorting
  resolution at `drizzle-adapter.ts:625-637`; per-table registration at
  `:165`, `:238-241`, `:451-460`) — but it is (a) adapter-config-only,
  invisible from `defineTable`, (b) zero-dogfooded
  (`grep -rn computedFields apps/marketing/src` → nothing), and (c)
  flat-filters-only: a computed-field filter inside a `FilterGroupNode`
  throws (`drizzle-adapter.ts:1430`) with advice ("flatten the tree at the
  call site") that is WRONG for OR trees — flattening turns a union into an
  intersection.
- The toolkit's `AggregateColumn` type
  (`packages/adapters/toolkit/src/types.ts:129` — `{ columnId, function:
  'count'|'sum'|'avg'|'min'|'max'|'distinct', field, relationshipPath }`)
  and drizzle's `AggregateFunction`
  (`packages/adapters/drizzle/src/types/aggregates.ts`) exist but nothing
  produces or consumes them end-to-end.

This plan connects the three: a declarative, **serializable** derived-column
spec on the column definition (`t.count('posts')`), carried through the
fetch params, lowered by the Drizzle adapter into correlated-subquery
SELECT/WHERE/ORDER BY (reusing the computed-fields pipeline), interpreted
by `memoryAdapter` over nested arrays, and honest-by-default client
computeds everywhere else. The acceptance scenario is the maintainer's own
phrasing: **a users table with a `postsCount` column you can render, filter
("more than 5 posts"), and sort — defined in one builder line.**

## Current state

Verified at `27c59b9` (all excerpts re-read at that commit):

- `packages/core/src/builders/column-builder.ts:82-86` — builder defaults:

  ```ts
  sortable: true,
  filterable: true,
  ...
  nullable: false,
  ```

- `packages/core/src/builders/path-builders.ts:305-310` — `t.computed`
  constructs `new ColumnBuilder<TRow, TValue, TId>('custom')` (runtime type
  `'custom'`; the honest-runtime note is at `:124-150`). `t.custom()` at
  `:313` shares the class.

- Drizzle derived-field engine:
  - `packages/adapters/drizzle/src/types/computed-fields.ts:61-81` —
    `ComputedFieldConfig { field; compute(row, ctx); filter?(filter, ctx) → FilterState[]; filterSql?(…) }`
    (`filterSql` takes precedence; doc comment at `:74-80` explains it
    applies in WHERE before pagination). `sortSql` exists — resolution at
    `drizzle-adapter.ts:625-637` (`computedFieldsForSorting`,
    `computedField?.sortSql`).
  - Registration: `drizzle-adapter.ts:165` (`private computedFields`),
    `:238-241` (from `config.computedFields`), `:451-460` (fetch-path
    inclusion incl. `includeByDefault` handling).
  - Tree gap: `drizzle-adapter.ts:1430` throws
    `Computed-field filters inside a FilterGroupNode are not supported yet (columnId: "…"). Use a flat FilterState[] (implicit AND) for computed-field filters, or flatten the tree at the call site.`
    — the comment at `:1414` says the substitution should learn to "walk
    `FilterGroupNode`". Plan 051 item 5 investigated and deferred exactly
    this (see `plans/README.md`, reconcile notes).
- `packages/core/src/adapters/memory-adapter.ts` — single-table, no
  relations; `describeColumns` samples row values; filter evaluation in
  `matchesNode` handles trees. Memory rows MAY carry nested arrays (e.g.
  `{ id, name, posts: [...] }`) — nothing uses them today.
- `memoryAdapter` meta (`memory-adapter.ts:580-601`) — `supportedColumnTypes`
  / `supportedOperators` derived from `FILTER_OPERATORS`; a
  capability-declaration precedent for Step 2's `aggregates` meta field.
- Design vocabulary (from `plans/design/table-definition-dx.md:309-352`):
  capability contributions like `{ aggregates: ['count','sum'] }` merged
  into `AdapterMeta` were explicitly reserved — use the word
  **capabilities** and the key **aggregates**.
- Dogfood target: the marketing demo schema has `posts` with
  `postsRelations` (`apps/marketing/src/lib/db/schema.ts:47-62`,
  `posts.user_id` FK in `src/lib/db/index.ts:58-68`), and the users demo is
  fully on `defineTable<UsersTables>()` path builders
  (`user-columns.tsx:40`).
- Conventions: breaking/feature changesets `minor` on core/drizzle in the
  0.6 window; integration tests for drizzle live in
  `packages/adapters/drizzle/tests/` (sqlite suites run with no setup).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Core tests | `cd packages/core && bun test` | all pass |
| Drizzle tests (sqlite) | `cd packages/adapters/drizzle && bun test` | all pass |
| UI tests | `cd packages/ui && bun test` | all pass |
| Marketing tests | `cd apps/marketing && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Live check | `cd apps/marketing && bun run dev` → `/` | Posts column renders; filter "> 5" narrows; sort orders |

## Scope

**In scope**:
- `plans/design/derived-columns.md` (create — Step 1)
- `packages/core/src/types/` (DerivedColumnSpec; `derived?` on
  `ColumnDefinition`; `derived?` on `FetchDataParams`; `aggregates?` on
  `AdapterMeta`)
- `packages/core/src/builders/` (honest defaults for `'custom'`-typed
  builders; `t.count` / `t.aggregate` factories in `path-builders.ts`)
- `packages/core/src/factory.ts` (attach specs from the table definition on
  the instance fetch path)
- `packages/core/src/adapters/memory-adapter.ts` (nested-array aggregate
  evaluation)
- `packages/adapters/drizzle/src/**` (spec validation + lowering; tree-walk
  substitution; the `:1430` error-message fix)
- `packages/ui/src/hooks/use-table-data.ts` (attach specs client-side, same
  seam as filters)
- `apps/marketing/src/lib/columns/user-columns.tsx` +
  `apps/marketing/src/lib/demo/fetch-users.ts` (dogfood `postsCount`)
- Tests across core/drizzle/ui/marketing; docs
  (`columns/index.mdx`, `filtering.mdx`, `adapters/custom.mdx`,
  `adapters/drizzle.mdx`, `better-table.mdx`); `.changeset/*`;
  `plans/README.md`

**Out of scope** (do NOT touch):
- Editing/writes on derived columns — never editable; the editing gate
  already requires a write target, keep it that way.
- Faceting on derived columns (`getMinMaxValues` for a count range slider)
  — stretch goal; record as follow-up, do not build.
- `GROUP BY`/`HAVING`-based implementations — see STOP conditions; the
  prescribed shape is correlated subqueries precisely so pagination and
  `total` counting are untouched.
- The HTTP adapter — specs are serializable data on `FetchDataParams`; the
  wire carries them with zero protocol changes (verify, don't modify).
- Plan 048's group-builder UI.

## Git workflow

- Branch: current working branch unless the operator says otherwise;
  commits `Plan 060 Step N: …`.

## Steps

### Step 1: Design record

Write `plans/design/derived-columns.md` capturing (with the trade-offs, so
future maintainers know why):

1. **Spec shape** (serializable, declarative — NEVER functions or SQL
   strings, because it crosses the HTTP wire and must be validated
   server-side against the schema):

   ```ts
   interface DerivedColumnSpec {
     kind: 'aggregate';
     /** Relation name on the primary table (e.g. 'posts'). */
     relation: string;
     fn: 'count' | 'sum' | 'avg' | 'min' | 'max';
     /** Required for sum/avg/min/max; ignored for count. */
     field?: string;
   }
   ```

   Result type mapping: `count` → `number`; others follow the target
   field. (`distinct` from the toolkit union is deferred — record that.)

2. **Transport decision**: specs ride `FetchDataParams.derived?:
   Array<{ columnId: string } & DerivedColumnSpec>`, attached by the two
   layers that own column definitions (core instance fetch; UI
   `use-table-data`) — NOT adapter-constructor config. Rationale to
   record: stateless per-request, works over HTTP unchanged, multi-table
   safe, and keeps `defineTable` the single source of truth. The adapter
   validates every spec against its schema/relationships and throws
   `SchemaError` on unknown relation/field or non-many cardinality.
3. **Security note**: declarative-only is the injection boundary — the
   server builds SQL from an enum + schema-validated identifiers; a
   malicious client can at worst request an aggregate over data the
   endpoint already serves. HTTP allow-lists (docs `adapters/http.mdx`
   pattern) apply to derived columnIds like any other id.
4. **Honest defaults**: `'custom'`-typed builders (this covers
   `t.computed` and `t.custom`) flip to `filterable: false, sortable:
   false` at construction; aggregate builders set `derived` AND leave
   filterable/sortable available (default ON — they're server-backed).
5. **Capability declaration**: `AdapterMeta.capabilities?: { aggregates?:
   DerivedColumnSpec['fn'][] }` (the design-doc vocabulary). Core's
   instance fetch throws early with a clear error when specs are present
   and the adapter doesn't declare the capability.
   **Weigh per-operation granularity here** (plan 061's finding): Prisma
   can SELECT and ORDER BY a relation count but cannot WHERE-by-count, so
   a flat fn-list can't describe it — consider
   `{ aggregates?: { fns: [...], render: boolean, sort: boolean, filter: boolean } }`
   (or per-fn flags). Decide now and record it — 061 Phase 7 and 062
   Step 6 declare against whatever shape this step picks.

**Verify**: the record exists and states all five decisions.

### Step 2: Core types + builders + honest defaults

1. Types per the design record (`DerivedColumnSpec`, `ColumnDefinition.derived?`,
   `FetchDataParams.derived?`, `AdapterMeta.capabilities?`), exported from
   the barrel.
2. `path-builders.ts`: `t.count(relation)` (id defaults to
   `${relation}Count`, type `'number'`, `derived: { kind: 'aggregate',
   relation, fn: 'count' }`) and `t.aggregate(id, spec)` for the general
   form. Both return a NumberColumnBuilder-shaped builder so `.range()` /
   number operators work. Runtime validation of `field` presence for
   non-count fns.
3. Flip the `'custom'` default: in `column-builder.ts`, when the
   constructor type is `'custom'`, initialize `filterable: false, sortable:
   false` (explicit `.filterable()` still re-enables). Update
   `user-columns.tsx`'s `hasBio`/`roleTags` comment to say the default now
   handles this (keep or drop the explicit flags — keep the test in
   `apps/marketing/src/lib/columns/user-columns.test.ts` green either way).
4. `factory.ts` instance fetch: collect `derived` specs from
   `table.columns`, attach to params, and enforce the capability check
   (clear error naming the adapter and the missing capability).

**Verify**: `cd packages/core && bun test` — new tests: builder produces
the spec; custom/computed default to non-filterable/sortable
(`@ts-expect-error`-free runtime asserts); instance fetch attaches specs;
capability check throws against a `memoryAdapter` **before** Step 4 adds
its support (temporarily assert the error, then flip the test in Step 4 —
or write the capability test against a stub adapter with no capabilities).

### Step 3: Drizzle lowering (SELECT + WHERE + ORDER BY, tree-aware)

1. Validate incoming specs against the relationship map (relation exists on
   the primary table, cardinality `'many'`; `field` exists and is numeric
   for sum/avg). Unknown → `SchemaError` with the resolver suggestion
   pattern the adapter already uses.
2. SELECT: for each requested derived column, emit a correlated subquery
   (`(SELECT count(*) FROM posts WHERE posts.user_id = users.id) AS "postsCount"`)
   — build identifiers from the relationship metadata, never from raw
   client strings. Internally, lower each spec into the EXISTING
   computed-fields pipeline (register an internal `ComputedFieldConfig`
   with `filterSql`/`sortSql` generated from the spec) so filtering and
   sorting reuse the machinery at `:625-637` and the substitution path —
   do not build a parallel pipeline.
3. Filters: derived-column filters lower to the same subquery expression in
   WHERE (`(SELECT …) > ?`). **Extend the substitution to walk
   `FilterGroupNode` trees** (the `:1414` TODO): a derived/computed filter
   at any depth substitutes in place, preserving group logic. Delete the
   `:1430` flat-only throw for specs-backed columns; for legacy
   config-`computedFields` using the callback `filter` form, keep the
   throw but FIX its advice text (flattening is only valid for
   AND-equivalent trees — say "restructure so computed-field filters are
   top-level AND'd, or use filterSql").
4. Sorting: derived ids resolve through the same registered `sortSql`.

**Verify**: `cd packages/adapters/drizzle && bun test` — new sqlite
integration tests: count renders per row; `greaterThan` filter on count
narrows (top-level AND); the SAME filter nested inside an OR group works
(tree walk); sort by count orders; unknown relation → `SchemaError`;
`sum` over a numeric field. Pattern: existing sqlite relationship suites.

### Step 4: memoryAdapter aggregates over nested arrays

When a derived spec arrives: `count` → `Array.isArray(row[relation]) ?
row[relation].length : 0`; sum/avg/min/max over `row[relation][].field`
numeric values. Declare `capabilities.aggregates` in its meta. Non-array
relation value → treat as empty (0/undefined), matching the "no rows"
semantics. Filters/sort on the derived id then flow through the existing
evaluation (inject the computed value before `matchesNode`/sort compare —
follow how accessors feed filtering today).

**Verify**: core tests — memory rows with nested `posts` arrays: count
renders, filters (including inside an OR tree), sorts; capability check
from Step 2 now passes for memory.

### Step 5: UI pass-through + dogfood

1. `use-table-data.ts`: attach specs from its columns to fetch params (same
   spot filters are built). No new UI components — a count column is a
   number column: existing number filter input and sort header just work.
2. Dogfood: `user-columns.tsx` adds
   `t.count('posts').displayName('Posts')` (visible by default —
   add to `defaultVisibleColumns`); `fetch-users.ts` includes it in the
   fetched columns list.

**Verify**: `cd apps/marketing && bun test` (extend
`user-columns.test.ts`: the derived column exists, is
filterable+sortable, has `derived.kind === 'aggregate'`); manual: dev
server on `/` — Posts column shows counts; number filter "> 5" narrows;
header sort orders by count; combining with an existing filter (e.g.
status) still paginates correctly with a correct `total`.

### Step 6: Docs + changesets + ledger

- `columns/index.mdx`: "Derived columns" section — `t.count` /
  `t.aggregate`, the one-liner acceptance example, and the honest-defaults
  note for `t.computed` (client-only, no filter/sort by default).
- `filtering.mdx`: derived columns filter with number operators,
  tree-supported.
- `adapters/custom.mdx`: `FetchDataParams.derived`, `SchemaError`
  expectations, `capabilities.aggregates`, and the security note (specs
  are declarative; validate identifiers against your schema).
- `adapters/drizzle.mdx`: subquery strategy + an indexing tip (index the
  FK column, e.g. `posts.user_id`).
- `better-table.mdx`: nothing new needed beyond the columns link — verify.
- Changesets: `@better-tables/core` minor (spec types, builders,
  honest `'custom'` defaults — note the default FLIP as breaking-in-window),
  `@better-tables/adapters-drizzle` minor (lowering + tree walk + error-text
  fix).
- Update this plan's row; move plan 051 item 5's "computed-TREE deferred"
  note to resolved-for-specs (README reconcile note).

**Verify**: docs greps for `t.count(` ≥ 2 pages; `bunx biome check .changeset/` clean.

## Test plan

- Core: builder/spec unit tests; honest-default tests; instance
  attach + capability-check tests; memory aggregate tests (count/sum, tree
  filter, sort). Patterns: `packages/core/tests/builders/`,
  `packages/core/tests/adapters/memory-adapter.test.ts`.
- Drizzle: the Step 3 integration matrix (render/filter/tree-filter/sort/
  SchemaError/sum) on sqlite. Pattern: existing relationship suites in
  `packages/adapters/drizzle/tests/`.
- Marketing: extended column-contract test + manual browser scenario
  (record in the PR).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `t.count('posts')` on the homepage users table renders counts, filters (`greaterThan`), and sorts via real SQL (drizzle sqlite integration tests pass)
- [ ] A derived-column filter nested inside an OR `FilterGroupNode` returns union semantics (test passes)
- [ ] `t.computed` columns default to `filterable: false, sortable: false` (core test)
- [ ] `memoryAdapter` evaluates count/sum over nested arrays (core tests)
- [ ] The `:1430` error text no longer recommends unconditional flattening (`grep -n "flatten the tree" packages/adapters/drizzle/src` → no match)
- [ ] `bun run typecheck` exit 0; core/drizzle/ui/marketing suites pass
- [ ] Both changesets exist; docs sections exist; `plans/README.md` updated

## STOP conditions

Stop and report back (do not improvise) if:

- The relationship metadata cannot answer "which FK links `posts` back to
  `users`" for the demo schema (i.e. reverse/one-to-many resolution is
  missing from the relationship map) — report what's available instead of
  guessing join keys.
- Correlated-subquery filtering breaks pagination `total` correctness or
  requires switching to GROUP BY/HAVING — that changes row-multiplicity
  semantics the adapter has hardening around (plan 003's count-inflation
  work); report with the failing query.
- The tree-walk substitution requires restructuring the group-translation
  code beyond substitution (i.e. you're rewriting plan 017's translator) —
  report.
- Dialect divergence: a subquery form that works on sqlite fails on
  pg/mysql paths in code review — flag it; do not fork per-dialect SQL
  without review.
- Performance: if the demo page visibly degrades (subquery per derived
  column per row is the accepted v1 cost — but if sqlite shows >2×
  fetch-time regression on the 100-row demo, report numbers).

## Maintenance notes

- Facet support (`getMinMaxValues` on a derived column → count range
  slider) is the natural fast-follow; the spec transport already carries
  what it needs.
- `distinct` and nested-relation aggregates (`t.count('posts.comments')`)
  are deferred — the spec's `relation` field is a single hop by design;
  extending to paths reuses `RelationshipPath[]` (toolkit
  `AggregateColumn` already models that shape).
- Type-level relation-name inference for `t.count` (autocomplete from
  `$types`) is a stretch the executor may attempt ONLY if it falls out of
  the existing path-builder typing; otherwise runtime validation is the
  contract — note which one shipped.
- Reviewer scrutiny: identifier construction in the subquery builder (must
  come from schema metadata, never client strings), the tree-walk's
  in-place substitution correctness, and the capability check's error
  message quality.
