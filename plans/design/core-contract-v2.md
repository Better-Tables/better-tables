# Design: Core contract v2 — AND/OR filter groups + typed column registry

> Companion to `plans/006-core-contract-v2-design.md`. This document is the
> design deliverable for **Steps 1, 2, and 5** of that plan.
> *(Status update 2026-07-13: the header below is stale in two ways — the
> Steps 3–4 prototype + type tests WERE subsequently delivered (commit
> `b074f49`: `experimental/contract-v2.ts` + `tests/types/contract-v2.test.ts`,
> 11 assertions passing), and the "unresolved dependency" on literal-preserving
> ids is RESOLVED by plan 014 (merged `11c2ac2`). Implementation follow-ups 1–2
> at the bottom of this doc are therefore DONE; follow-up 3 is plan 015.)*
> It is design-only: nothing here changes shipping code.
>
> This design derives from — and must stay a type FUNCTION of — plan 011's
> approved `define()` API (`plans/design/table-definition-dx.md`, prototype at
> `packages/core/src/types/experimental/table-def-v1.ts`). One source of truth.
>
> **Release policy (decided, `plans/README.md`)**: 0.6 is ONE coordinated
> breaking release. No deprecation cycles, no compat overloads, no parallel
> `fetchDataV2`. Prefer the CLEANEST contract, not the least-breaking one. The
> sole compatibility exception is URL wire-format READ compatibility (accepting
> old `c:` payloads).

---

## Status and scope

- **Covers**: Step 1 (filter groups), Step 2 (typed column registry), Step 5
  (open questions). Steps 3–4 (prototype + type tests) are a follow-up task.
- **Governs**: a breaking `0.6.0` core release; every adapter and the UI filter
  layer are downstream consumers.
- **Verified against** (2026-07-13, on branch `core-contract-v2-design`, HEAD
  `93154d6`): `types/filter.ts`, `types/adapter.ts`, `types/column.ts`,
  `builders/column-builder.ts`, `utils/{compression,filter-serialization,type-guards}.ts`,
  `adapters/drizzle/src/{filter-handler.ts,query-builders/base-query-builder.ts}`,
  and plan 011's `experimental/table-def-v1.ts`.

### Two unresolved dependencies called out up front

1. **Literal-preserving column ids are NOT implemented.** `.id()` is still
   `id(id: string): this` (`packages/core/src/builders/column-builder.ts:106`)
   and `ColumnDefinition['id']` is still `string`
   (`packages/core/src/types/column.ts:29`). Plan 005 landed accessor/options
   inference and `defineColumns`, but **not** literal ids. The typed registry in
   Step 2 is keyed by `C['id']` and therefore CANNOT be built as specified until
   this lands. It is designed here, but flagged as an unresolved follow-up — see
   the dedicated section [Unresolved dependency: literal-preserving column ids](#unresolved-dependency-literal-preserving-column-ids).
2. **`FilterGroup` name collision.** `packages/core/src/types/filter.ts:250-268`
   already defines a `FilterGroup` interface. It is **UI control grouping** —
   grouping filter *controls* by column for display (`id`, `label`, `columns`,
   `defaultCollapsed`). It is **NOT boolean logic**. This design uses the name
   **`FilterGroupNode`** for the boolean AND/OR node and leaves `FilterGroup`
   untouched. Do not conflate them.

---

## Verified context (read this before implementing)

**The AND-only premise holds.** Cross-filter combination is a single
`and(...)` at `packages/adapters/drizzle/src/query-builders/base-query-builder.ts:181`:

```typescript
return query.where(and(...allConditions) as SQL | SQLWrapper);
```

There is no cross-filter OR anywhere in the pipeline. The `or()` calls that
DO exist in `packages/adapters/drizzle/src/filter-handler.ts` are all **within a
single filter's condition**, never between filters:

| Site | What it ORs |
|---|---|
| `:753` | `includeNull ? or(...conditions) : and(...conditions)` — a filter's value conditions OR its null check |
| `:855` | `or(isNull(column), eq(column, ''))` — the `isEmpty` operator |
| `:911` | `or(lt(col, a), gt(col, b))` — the `notBetween` operator |
| `:987` | multi-option `includesAny`-style expansion |
| `:1592`, `:1932` | `combineBatchConditions(..., or, ...)` — batching a large `IN (...)` list to dodge Drizzle's parameter-binding limit |

None of these is a boolean group over multiple filters. The design below is the
first cross-filter OR in the codebase; the STOP condition ("an existing OR
implementation contradicts the AND-only premise") does **not** fire.

**Existing serialization contract** (what the wire format must extend, not
replace):

- `COMPRESSION_KEY_MAP` (`utils/compression.ts:24-32`) shortens
  `columnId→c, type→t, operator→o, values→v, includeNull→n, meta→m, direction→d`.
- `renameKeys` (`utils/compression.ts:56-72`) recurses into **all** nested
  objects and arrays — including user `meta`/`values` — which is CORE-06 (a key
  named `c`/`t`/… inside user data gets mangled on restore).
- Payloads are prefixed `c:` (`compression.ts:107`); read path checks
  `startsWith('c:')` (`compression.ts:132`, `filter-serialization.ts:70`).
- Plan 004's boundary guard `isFilterStateShape` (`utils/type-guards.ts:49-80`)
  validates untrusted decompressed entries; `deserializeFiltersFromURL`
  (`filter-serialization.ts:64-113`) drops invalid entries with a **value-free**
  `console.warn` (fail closed).

---

## Step 1 — Filter groups: the recursive AND/OR tree

### 1.1 Node shape

**Recommendation:** a two-member union discriminated by a field that no
`FilterState` carries.

```typescript
type FilterNode = FilterState | FilterGroupNode;

interface FilterGroupNode {
  kind: 'group';           // discriminant — no FilterState has `kind`
  logic: 'and' | 'or';
  children: FilterNode[];  // non-empty after validation (see 1.4)
}
```

`FilterState` is discriminated by `type` (its eight members: `text`, `number`,
`date`, `boolean`, `option`, `multiOption`, `json`, `custom` — verified
`types/filter.ts:237-245`); none of them has a top-level `kind` field
(`meta` may contain arbitrary keys, but that is one level down, not on the
node). So `kind: 'group'` is a clean, collision-free discriminant, and
`isFilterGroupNode(n)` is just `n.kind === 'group'`.

**`FetchDataParams.filters`** (today `filters?: FilterState[]`,
`types/adapter.ts:43`) becomes:

```typescript
filters?: FilterState[] | FilterGroupNode;
```

A plain `FilterState[]` means **implicit AND** — this is kept for ergonomics
(the overwhelmingly common "a few ANDed filters" case stays a flat array), not
for backward compatibility. A `FilterGroupNode` at the top is how a caller
expresses OR or nesting. Internally, core canonicalizes a bare array to
`{ kind: 'group', logic: 'and', children: [...] }` before dispatch so adapters
only ever have to handle one shape.

**Trade-off:** with back-compat waived we *could* make it `filters?: FilterNode`
and force even the simple case into a group node — that is the "purest" single
shape. Rejected: a bare top-level `FilterState` (single filter, no array) reads
oddly and a top-level array is genuinely the ergonomic default the DX brief
wants. Accepting the `FilterState[] | FilterGroupNode` union costs one
canonicalization step but keeps the 90% case a flat array. This is an ergonomic
union, deliberately NOT a compatibility union.

### 1.2 Depth policy

**Recommendation:** cap nesting at **max depth 3**; adapters advertise their own
limit as `maxGroupDepth` on `AdapterMeta`.

```typescript
interface AdapterMeta {
  // ...existing fields (name, version, features, supportedColumnTypes, supportedOperators)
  supportsFilterGroups?: boolean;   // default false when absent
  maxGroupDepth?: number;           // default 3 when groups are supported
}
```

Depth 3 means: top-level group (depth 1) → a nested group (depth 2) → one more
nested group (depth 3). This deliberately mirrors plan 011's `Paths<T>` depth
cap of 3 (`experimental/table-def-v1.ts:61`) — one "3" to reason about across
the whole contract. Both UI (a builder more than ~3 deep is unusable) and SQL
(deeply parenthesized `WHERE` trees are hard to index and to read in logs)
degrade past that.

**Trade-off:** a hard cap can reject a legitimately deep programmatic query.
Mitigation: the cap is advertised (`maxGroupDepth`), so a caller can detect it,
and it is a per-adapter number rather than a global constant — an adapter that
can handle deeper trees may raise it. Making it unbounded instead risks
pathological payloads (a URL-supplied 50-deep tree) becoming a DoS vector on the
validator and the query planner; the cap is a fail-closed safety valve, not just
a UX choice.

### 1.3 Wire format

**Recommendation:** extend the key map, version the prefix, and add a recursive
shape guard — all additive.

1. **Extend `COMPRESSION_KEY_MAP`** with keys that do not collide with the
   existing `c/t/o/v/n/m/d`:

   ```typescript
   kind:     'k',
   logic:    'l',
   children: 'h',   // 'g' would read as "group"; 'h' avoids any future `group→g`
   ```

   `logic`'s VALUES (`'and'`/`'or'`) are not renamed (only keys are), so no value
   map is needed.

2. **Bump the URL prefix `c:` → `c2:`.** A `c2:` payload is a `FilterNode`
   (group-aware). On READ, try `c2:` first, then **fall back to parsing `c:`** —
   an old `c:` payload is a flat `FilterState[]`, which is exactly the
   implicit-AND case, so it round-trips into the new model for free. This `c:`
   READ fallback is the one compatibility exception the release policy keeps
   (shared/bookmarked URLs in the wild are not API consumers). WRITE always
   emits `c2:`.

3. **Extend plan 004's guard with `isFilterNodeShape`** (recursive):

   ```typescript
   function isFilterNodeShape(value: unknown, depth = 1, maxDepth = 3): value is FilterNode {
     if (isGroupNodeShape(value)) { /* kind === 'group' */
       if (depth > maxDepth) return false;                 // fail closed on over-deep
       if (value.logic !== 'and' && value.logic !== 'or') return false;
       if (!Array.isArray(value.children) || value.children.length === 0) return false;
       return value.children.every((c) => isFilterNodeShape(c, depth + 1, maxDepth));
     }
     return isFilterStateShape(value); // reuse the existing leaf guard verbatim
   }
   ```

   The leaf case delegates to the existing `isFilterStateShape`
   (`type-guards.ts:49`) unchanged — one leaf contract, reused.

**CORE-06 interaction (must fix in the same change):** `renameKeys`
(`compression.ts:56-72`) recurses into user data. Adding `k`/`l`/`h` to the map
WIDENS the collision surface: a user `meta` key literally named `kind`, `logic`,
or `children`, or a value object containing those keys, would be silently
mangled on restore. The wire-format version bump is precisely the moment to fix
CORE-06 — scope key-renaming to STRUCTURAL keys only (do not descend into the
`meta`/`values` subtrees, or apply the map by position rather than by blind
recursion). Whoever implements `c2:` owns CORE-06; it is the same code path and
splitting them re-introduces the bug.

### 1.4 Validation semantics

**Recommendation:** fail closed, consistent with plan 004 — normalize on the way
in, drop what can't be trusted, never throw on untrusted input.

| Condition | Action |
|---|---|
| Empty group (`children` length 0, or 0 after dropping invalid children) | **Drop** the group node |
| Single-child group | **Unwrap** — replace the group with its sole child (canonicalization; `and`/`or` of one thing is that thing) |
| Unknown `logic` (not `'and'`/`'or'`) | **Drop** the node |
| Unknown/absent `kind` on a non-leaf that also fails `isFilterStateShape` | **Drop** the node |
| Depth beyond `maxDepth` | **Drop** the over-deep subtree (not the whole payload) |
| Invalid leaf (`isFilterStateShape` false) | **Drop** the leaf (existing behavior) |

Warnings stay **value-free** (log the `columnId` or the reason, never the
`values`) — the exact convention `deserializeFiltersFromURL` already uses
(`filter-serialization.ts:99-102`). Normalization runs bottom-up so that
dropping an invalid leaf can cascade into "now-empty group → drop" naturally in
one pass.

**Trade-off:** dropping an over-deep subtree silently changes the result set
(fewer conditions → more rows). The alternative — reject the entire payload —
is safer against silent semantic drift but throws away a whole valid filter for
one bad branch, which for a URL-hydrated table means a jarring "all filters
gone" on load. Fail-closed-per-node with a warning is the same trade plan 004
already made for flat filters; this design stays consistent rather than
inventing a second policy.

### 1.5 Adapter translation

**Recommendation:** a ~30-line recursive walk at the existing
`base-query-builder.ts:155-182` seam. Drizzle already imports both `and` and
`or` (`filter-handler.ts:56` imports `or`), so this adds no dependency.

```typescript
// New: recursively translate a FilterNode into a single SQL condition.
private buildNodeCondition(
  node: FilterNode,
  primaryTable: string
): SQL | SQLWrapper | undefined {
  if (isFilterGroupNode(node)) {
    const parts = node.children
      .map((child) => this.buildNodeCondition(child, primaryTable))
      .filter((c): c is SQL | SQLWrapper => c !== undefined);
    if (parts.length === 0) return undefined;       // empty group → no condition
    if (parts.length === 1) return parts[0];        // unwrap singletons
    return node.logic === 'or' ? or(...parts) : and(...parts);
  }
  // Leaf: reuse today's single-filter → condition path (handleCrossTableFilters
  // already resolves one FilterState to a condition; factor its per-filter core
  // out as handleSingleFilter(node, primaryTable)).
  return this.filterHandler.handleSingleFilter(node, primaryTable);
}

// applyFilters (replacing the flat collect-then-and at :161-181):
applyFilters(query, filters, primaryTable, additionalConditions) {
  const root: FilterNode = Array.isArray(filters)
    ? { kind: 'group', logic: 'and', children: filters }  // implicit-AND canonicalization
    : filters;
  const conditions = [
    this.buildNodeCondition(root, primaryTable),
    ...(additionalConditions ?? []),
  ].filter((c): c is SQL | SQLWrapper => c !== undefined);
  if (conditions.length === 0) return query;
  return query.where(and(...conditions) as SQL | SQLWrapper);
}
```

The only new refactor is exposing a `handleSingleFilter` seam from today's
`handleCrossTableFilters` (which currently loops and returns a `conditions[]`
array); the per-filter body already exists.

**Unsupported adapters (`supportsFilterGroups: false`): REJECT, do not silently
flatten.** If a payload contains a group with `logic: 'or'` (or any nesting) and
the target adapter can't handle groups, core throws a typed error BEFORE
dispatch. Silently flattening OR into AND returns a *wrong* (narrower) result
set with no signal — a correctness bug that looks like working software. A
loud error is strictly better. Nuance worth encoding: a tree whose every node is
`logic: 'and'` is semantically identical to a flat `FilterState[]`, so it MAY be
safely flattened for a legacy adapter; only non-AND logic (or the presence of
nesting a legacy adapter can't represent) forces the reject. Core can make this
call from `AdapterMeta` capability flags without asking the adapter.

**Trade-off:** rejecting is a runtime failure the caller must handle, versus
flatten-and-warn which "keeps working." But a warning in a server log is not a
contract; a caller that built an OR query and got AND results back has been
lied to. Reject-by-default with an explicit capability flag makes the
limitation part of the type/contract surface rather than a footgun.

### 1.6 UI reachability

**Recommendation (design note):** the contract ships in 0.6 WITHOUT a UI
group-builder. The filter bar stays flat — it emits a `FilterState[]` (implicit
AND), exactly as today. Groups are reachable first via the programmatic API and
via `c2:` URLs. A visual "filter builder" surface (nested AND/OR groups in the
UI) is a later, separate plan. The contract must not require UI support to
ship, and it doesn't: a flat array is a valid `FilterNode` input, so the
existing UI is forward-compatible with zero changes.

**Trade-off:** shipping the query capability before the UI to author it means
the feature is "there but not clickable" for pure-UI users at 0.6. Accepted:
API/URL consumers (the audience for OR queries first) get it immediately, and
gating the whole breaking release on a net-new UI builder would delay the
contract that plans 007/008 depend on. See Open question (b).

---

## Step 2 — Typed column registry

### 2.0 Alignment with plan 011 (one source of truth)

The registry is **derived from** plan 011's `define()` column tuple, never
authored in parallel. Concretely, `ColumnRegistry<Columns>` must be a pure type
FUNCTION of the `columns` a `defineTable()` call collects
(`TableDefResultV1['columns']` / `TableDefinitionV1['columns']` in
`experimental/table-def-v1.ts:355-394`). Plan 011 already reserved the seam:
`usersTable.$infer.FilterState` (`table-def-v1.ts:387`) is currently `unknown`
"reserved for plan 006" — **this design fills it in.** No second registry
concept is introduced.

**Blocking wrinkle in the current prototype (flag for the Step 3 prototype):**
plan 011's stored column tuple is typed as
`Array<PathColumnBuilder<TRow, unknown> | RawColumnDefinitionLike<TRow>>`
(`table-def-v1.ts:356`) — it **erases each column's id literal and value type**.
For the registry to key by id and narrow by value, `define()` must collect
columns as a **readonly tuple with per-element types preserved** (variadic tuple
capture, `<const Cols extends readonly ...[]>`), and each builder type must
carry both its id literal and its value type. For path builders the id literal
is the path string `P` (already known to `t.text('profile.location')` as a type
parameter — it's just discarded by the current `PathColumnBuilder<TRow, TValue>`
return, which drops `P`). Threading `P` back through the builder is the concrete
prototype task. This depends on — and is blocked by — literal-preserving ids
(see Step 2.1 and the Unresolved-dependency section).

### 2.1 The registry type

**Recommendation:** derive it from the built column tuple, exactly the shape
plan 006 sketched:

```typescript
type ColumnRegistry<TCols extends readonly ColumnDefinition<any, any>[]> = {
  [C in TCols[number] as C['id'] & string]:
    C extends ColumnDefinition<any, infer V> ? V : never;
};
```

This ONLY works if `ColumnDefinition['id']` carries its **literal** type. Today
it does not: `id: string` (`types/column.ts:29`) collapses every key to the
single index `string`, so `ColumnRegistry` would degenerate to
`{ [x: string]: ... }`. The required change:

```typescript
// column-builder.ts:106 today:  id(id: string): this;
// contract v2 needs:
id<const K extends string>(id: K): ColumnBuilder<TData, TValue, K>;
// and ColumnDefinition gains a third param carrying the id literal:
interface ColumnDefinition<TData = unknown, TValue = unknown, TId extends string = string> {
  id: TId;
  // ...rest unchanged
}
```

This is **UNRESOLVED** (plan 005 did not do it). See the dedicated section
below. Path builders (011) need the analogous fix: return a builder that carries
the path `P` as its id literal instead of discarding it.

### 2.2 Threading `TReg` through the adapter contract

**Recommendation:** add a second generic to every stringly-typed surface, each
defaulting so untyped usage compiles unchanged.

```typescript
interface TableAdapter<TData = unknown, TReg = Record<string, unknown>> {
  fetchData(params: FetchDataParams<TReg>): Promise<FetchDataResult<TData>>;
  getFilterOptions(columnId: keyof TReg & string): Promise<FilterOption[]>;
  getFacetedValues(columnId: keyof TReg & string): Promise<Map<string, number>>;
  getMinMaxValues(columnId: keyof TReg & string): Promise<[number, number]>;
  // ...write methods unchanged (see Open question (d) for their v2 shape)
  meta: AdapterMeta;
}

interface FetchDataParams<TReg = Record<string, unknown>> {
  // ...pagination, sorting, search, primaryTable, params unchanged
  columns?: (keyof TReg & string)[];
  filters?: FilterState<TReg>[] | FilterGroupNode<TReg>;
}
```

`FilterState<TReg>` narrows both `columnId` and `values`:

```typescript
// Sketch — the leaf constrains columnId to a registered key AND ties the
// value-array element type to that key's registered value type. Because
// FilterState is a `type`-discriminated union, the narrowing is applied per
// member; the prototype (Step 3) proves the exact mapped form.
type FilterState<TReg = Record<string, unknown>> = {
  [K in keyof TReg & string]: BaseFilterState & {
    columnId: K;
    // values element type derived from TReg[K] (string[] for text, number[] for
    // number, etc.), consistent with the existing per-`type` value shapes.
  };
}[keyof TReg & string];
```

With the default `TReg = Record<string, unknown>`, `keyof TReg & string` is
`string`, so `columnId: string` and `values: unknown[]` — i.e. **exactly
today's behavior**. Every existing `TableAdapter<User>` keeps compiling; the
narrowing is purely additive and opt-in.

**Recommendation on where `TReg` originates:** `TReg = ColumnRegistry<Columns>`
computed from a table definition's column tuple, surfaced as
`usersTable.$infer.FilterState`. The UI/hook layer reads it from the table
definition prop; adapters receive it via the instance wiring — the app author
never writes `TReg` by hand.

### 2.3 Relationship ids are opaque keys

Dotted ids like `'profile.location'` are **opaque literal keys** in the
registry: `{ 'profile.location': string | null; ... }`. The registry does NOT
model the relationship graph, join semantics, or nullability propagation —
that stays adapter-side in `RelationshipManager` (plan 011 Step 2.1 documents
the runtime contract). `keyof TReg` simply includes the dotted literal; the dot
is not special to the registry. This keeps the registry a flat
`Record<idLiteral, valueType>` and avoids duplicating relationship knowledge on
both sides of the contract.

### 2.4 Migration story (grounded estimate)

Adapters implementing `TableAdapter<TData>` today keep compiling because `TReg`
defaults to `Record<string, unknown>`. Typed benefits are opt-in: pass a column
tuple through `define()` / `defineColumns` and the narrowed `TReg` flows to the
UI and adapter calls. Migration is therefore two-phase and incremental:

- **Phase A — signature-only (no behavior change):** add the `TReg` generic +
  defaults to `TableAdapter`, `FetchDataParams`, and `FilterState`. Grounded
  blast radius: `TableAdapter` is referenced in **10 files**, `FetchDataParams`
  in **4 files**, `FilterState` in **48 files**. Because every generic defaults,
  most of those 48 compile untouched — only the ~4 declaration sites
  (`types/adapter.ts`, `types/filter.ts`, filter-manager, each adapter's
  `implements`) actually change.
- **Phase B — opt into narrowing (per table):** thread `keyof TReg` where a
  real column id flows. Grounded count: `columnId` appears **~243 times across
  ~27 files** (176/16 in core, 67/11 in UI); the three keyed adapter methods
  have **~34 call/def sites**. Realistically ~20–30 files need `TReg` plumbed to
  get end-to-end narrowing, but they can be migrated one table/one call-path at
  a time since the defaulted generic keeps everything else green.

Net: **~4 files change to introduce the capability; ~20–30 files change to
fully exploit it**, and none is forced in a single commit.

### 2.5 Explicit non-goals

- **No runtime schema validation derived from types.** Types erase; the runtime
  boundary guards (`isFilterStateShape`, the new `isFilterNodeShape`) remain the
  source of runtime safety. The registry narrows author-side code, it does not
  validate untrusted input.
- **No replacement of `meta`-based capability discovery.** `AdapterMeta`
  (`supportedOperators`, `supportedColumnTypes`, and the new
  `supportsFilterGroups`/`maxGroupDepth`) stays the runtime capability channel.
  The type registry and the meta capabilities are complementary: types for
  author ergonomics, meta for runtime feature negotiation.

---

## Unresolved dependency: literal-preserving column ids — RESOLVED

*(2026-07-13: plan 014 delivered exactly the required change below — merged at
`11c2ac2`; `ColumnRegistry` over real built columns now resolves literal keys,
verified by a type test asserting against this doc's own prototype. The section
is preserved as the historical rationale.)*

The registry in Step 2 is keyed by `C['id'] & string`. That requires column ids
to be **literal-preserving**, which they are NOT today:

- `packages/core/src/builders/column-builder.ts:106` — `id(id: string): this;`
  (widens every id to `string`).
- `packages/core/src/types/column.ts:29` — `id: string;` on `ColumnDefinition`.

Plan 005 (DONE) delivered accessor/options value inference and `defineColumns`,
but **did not** make ids literal. Until this is fixed, `ColumnRegistry<Columns>`
collapses to `{ [x: string]: unknown }` and none of Step 2's narrowing works.

**Required change (follow-up plan, not this task):**

```typescript
// Fluent builder:
id<const K extends string>(id: K): ColumnBuilder<TData, TValue, K>;

// ColumnDefinition gains an id-literal parameter (defaulted for compat):
interface ColumnDefinition<TData = unknown, TValue = unknown, TId extends string = string> {
  id: TId;
  // ...unchanged
}
```

Path builders (plan 011) need the parallel fix: `t.text('profile.location')`
already has the path literal `P` as a type parameter but the current
`PathColumnBuilder<TRow, TValue>` return type discards it — it must instead
carry `P` as the column's id literal so the tuple → registry derivation can read
it. **This is the single blocking item between this design and a compiling
Step 3 prototype.** The prototype should either (a) prototype against a
locally-patched literal-id builder, or (b) prototype the registry over a
hand-written tuple of `ColumnDefinition<TData, V, IdLiteral>` to prove the
`ColumnRegistry` mapped type in isolation, and leave the builder-threading to
the implementation plan.

---

## Step 5 — Open questions

Two are already decided by the maintainer's 2026-07-12 release-policy directive;
the rest carry a recommendation.

**(a) Ship v2 as a parallel `fetchDataV2` or replace the contract?**
**DECIDED** — replace outright. 0.6 is one coordinated breaking release; there
is no parallel `fetchDataV2` and no deprecation of the old surface. The
deliverable owed to users is a migration guide (a separate follow-up plan), not
a compat layer.

**(e) Does contract v2 ship inside plan 011's `betterTables()` instance API?**
**DECIDED** — yes, together, as one coordinated 0.6 release with one migration
guide. `usersTable.$infer.FilterState` (011's reserved seam) and the
"registry derived from `define()`" requirement mean the instance API and the
typed registry are not independently useful; shipping either alone leaves the
other visibly half-finished.

**(b) Does the UI group-builder ship in the same release or later?**
**Recommendation:** later — a fast-follow, not part of 0.6. Ship the query
contract (programmatic + `c2:` URL groups) in 0.6 with the filter bar staying
flat (Step 1.6). Rationale: the first consumers of OR queries are API/URL
callers and plans 007/008; gating the whole breaking release on a net-new
nested-group UI would delay the contract those plans depend on, for a surface
the initial audience doesn't need. The flat bar is forward-compatible (it emits
a valid implicit-AND `FilterNode`), so no rework is thrown away when the builder
lands. Revisit if a design partner needs visual OR authoring at launch.

**(c) Does `search` (global search) join the filter tree as a node, or stay a
separate param?**
**Recommendation:** keep `search` a **separate top-level param** (as it is
today, `FetchDataParams.search`), NOT a `FilterNode`. Global search is
cross-column, adapter-defined semantics (an `ILIKE` fan-out across many
searchable columns) — it has no single `columnId`, so it doesn't fit the
registry-keyed leaf shape, and forcing it into the tree would either need a
special "search leaf" variant (polluting the clean two-member union) or a fake
columnId. Keeping it separate also means the typed registry stays purely about
real columns. Trade-off: a caller who wants "(search matches) OR (status =
active)" can't express that composition — accepted, because that is a rare need
and can be added later as an explicit `SearchNode` union member without breaking
the base shape. Revisit only if scoped/boolean search demand appears.

**(d) How does plan 002's mutation routing surface in v2 write signatures?**
**Recommendation:** make the target table **explicit** in write signatures,
keyed off plan 011's schema, instead of the current implicit "first schema
table" default that plan 002 is fixing. Sketch:

```typescript
// v2 write surface on the instance (schema-aware, table is a checked key):
createRecord<TName extends TableNamesOf<Instance>>(
  table: TName,
  data: Partial<RowOf<Instance, TName>>
): Promise<RowOf<Instance, TName>>;
updateRecord<TName extends TableNamesOf<Instance>>(
  table: TName, id: string, data: Partial<RowOf<Instance, TName>>
): Promise<RowOf<Instance, TName>>;
deleteRecord<TName extends TableNamesOf<Instance>>(table: TName, id: string): Promise<void>;
```

Rationale: plan 002's bug is that mutations silently target the first schema
table; a typed, explicit `table` parameter makes the target a compile-time
decision and removes the heuristic entirely. This aligns writes with the same
`TableNamesOf`/`RowOf` machinery plan 011 already defines for reads, so there is
one schema model across read and write. Trade-off: it widens the adapter write
interface (today's `createRecord?(data)` takes no table) — acceptable under the
breaking release, and the low-level per-adapter method can keep a single-table
form internally while the instance-level API is the table-keyed one. The exact
adapter-vs-instance split is an implementation detail for the plan-002 / write
follow-up; this design only fixes the *shape* (explicit, typed table target).

---

## Implementation follow-ups

This design is doc-only. It spawns these follow-up plans (to be created once the
design is approved):

1. **Literal-preserving ids** — the blocking dependency above
   (`.id()` + `ColumnDefinition['id']` + path-builder id threading). Prereq for
   the Step 3 prototype's registry.
2. **Prototype + type tests (Steps 3–4 of plan 006)** — build
   `experimental/contract-v2.ts` (`FilterNode`, `FilterGroupNode`,
   `isFilterGroupNode`, `ColumnRegistry`, `TableAdapter<TData, TReg>`) and
   `tests/types/contract-v2.test.ts` (nested AND/OR typechecks; `logic: 'xor'`
   → `@ts-expect-error`; wrong-key and wrong-value-type filters →
   `@ts-expect-error`; defaulted registry accepts plain strings).
3. **Core types + serialization** — land `FilterNode` in `types/`, the `c2:`
   wire format, `isFilterNodeShape`, and the CORE-06 fix together.
4. **filter-manager + UI** — store `FilterNode`, canonicalize flat arrays, keep
   the filter bar flat (Step 1.6).
5. **Drizzle translation** — the recursive `buildNodeCondition` at the
   `base-query-builder.ts:155-182` seam + `supportsFilterGroups`/`maxGroupDepth`
   on the adapter meta.
6. **Prisma translation** — plan 008's second consumer; Prisma's
   `where: { AND: [...], OR: [...] }` validates the `FilterNode` shape.
7. **Migration guide** — one guide covering the 011 instance API + this
   contract, per the release policy.
