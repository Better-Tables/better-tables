# Plan 006: Design core contract v2 — typed column registry + AND/OR filter groups (design/spike)

> **Executor instructions**: This is a DESIGN plan. The deliverable is a design
> document plus a compiling type prototype — NOT a migration of the codebase.
> Follow the steps, run every verification command, and honor the STOP
> conditions. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/core/src/types/`
> If the types changed since this plan was written, read the live versions of
> `adapter.ts` and `filter.ts` before designing on top of them.

## Status

- **Priority**: P1
- **Effort**: L (design + prototype; implementation is follow-up plans)
- **Risk**: LOW for the spike itself (no shipping code changes); the design it produces governs a breaking `0.6.0` core release
- **Depends on**: 005 (builder inference — the registry builds on inferred `TValue`); 011 DONE (design approved + merged; the registry derives from its `define()` — see Step 2 item 0 and read `plans/design/table-definition-dx.md` before starting)
- **Category**: direction
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

Two of the maintainer's stated goals require changing the same core contract, and they must be designed together so the ecosystem absorbs ONE breaking change, not two:

1. **AND/OR queries.** Today `FetchDataParams.filters` is a flat `FilterState[]` and every adapter combines conditions with a single `and(...)` — confirmed at `packages/adapters/drizzle/src/query-builders/base-query-builder.ts:181`: `return query.where(and(...allConditions) as SQL | SQLWrapper);`. There is no OR anywhere in the pipeline. (Note: the existing `FilterGroup` interface in `packages/core/src/types/filter.ts:244-262` is a UI grouping of filter *controls* by column — it is NOT boolean logic; don't be misled by the name.)
2. **Typed adapter contract.** The `TableAdapter` interface is stringly-typed end to end: `FetchDataParams.columns?: string[]` (`packages/core/src/types/adapter.ts:49`), `getFilterOptions(columnId: string)` (`:241`), `getFacetedValues(columnId: string)` (`:255`), `getMinMaxValues(columnId: string)` (`:269`), `FetchDataResult<TData = unknown>` (`:107`), and `BaseFilterState.columnId: string` (`types/filter.ts:140-144`). Nothing links a column id to the row type or to its filter value type.

Both changes rewrite `FilterState`/`FetchDataParams` consumers: filter-manager, URL serialization (plan 004's validator), the UI filter bar, and every adapter. Designing them jointly — with the Prisma adapter (plan 008) as a second consumer to keep the design honest — is the highest-leverage architecture work in this repo.

## Current state

Read these fully before designing (all paths relative to repo root):

- `packages/core/src/types/adapter.ts` — the whole file (~537 lines). Key: `FetchDataParams` (`:35-75`), `FetchDataResult` (`:107-133`), `TableAdapter` (`:212-381`), `AdapterMeta`/`AdapterFeatures` (`:412-472`). Note `supportedOperators: Record<ColumnType, FilterOperator[]>` (`:426`) — capability discovery exists and v2 should extend it with `supportsFilterGroups`/`maxGroupDepth`.
- `packages/core/src/types/filter.ts` — `FilterOperator` union (`:10-57`), `BaseFilterState` (`:139-151`), the eight-member `FilterState` discriminated union (`:231-239`), the UI-only `FilterGroup` (`:244-262`).
- `packages/core/src/managers/filter-manager.ts` — flat `FilterState[]` storage (`:171`), `setFilters` validation flow (`:226+`).
- `packages/core/src/utils/filter-serialization.ts` + `url-serialization.ts` — the URL wire format that must round-trip groups (plan 004 adds `isFilterStateShape` — the group validator extends it).
- `packages/adapters/drizzle/src/filter-handler.ts` — how a `FilterState` becomes a Drizzle condition today (`mapOperatorToCondition` dispatch around `:698-758`); `base-query-builder.ts:166-181` — where conditions are collected and combined with `and(...)`.
- Serialization constraint: URL state is lz-string-compressed JSON with key-shortening (`packages/core/src/utils/compression.ts`, `COMPRESSION_KEY_MAP` maps `columnId→c, type→t, operator→o, values→v, ...`). A group node adds new keys — the design must extend the key map AND version the wire format (there's a `c:` prefix convention in `filter-serialization.ts:69`).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                | exit 0              |
| Typecheck the prototype | `cd packages/core && bun run typecheck` | exit 0 |
| Type-level tests | `cd packages/core && bun test tests/types/` | pass       |

## Scope

**In scope** (the only files you should create/modify):
- `plans/design/core-contract-v2.md` (create — the design document)
- `packages/core/src/types/experimental/contract-v2.ts` (create — compiling type prototype, exported from NOTHING; no `index.ts` change)
- `packages/core/tests/types/contract-v2.test.ts` (create — type-level assertions against the prototype)

**Out of scope** (do NOT touch):
- Any existing file under `packages/core/src` other than adding the isolated `experimental/` directory.
- Any adapter or UI code. No migration in this plan.
- Publishing/changesets — nothing ships.

## Git workflow

- Branch: `core-contract-v2-design`
- Commit style: imperative sentence, e.g. "Add contract v2 design doc and type prototype"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the design document — filter groups

In `plans/design/core-contract-v2.md`, specify the recursive filter tree. Required decisions (make a recommendation for each, with one paragraph of trade-off):

1. **Node shape**: recommended starting point —

   ```typescript
   type FilterNode = FilterState | FilterGroupNode;
   interface FilterGroupNode {
     kind: 'group';            // discriminant that no FilterState has
     logic: 'and' | 'or';
     children: FilterNode[];   // non-empty
   }
   ```

   with `FetchDataParams.filters?: FilterState[] | FilterGroupNode` (flat array stays valid and means implicit AND — zero migration for existing consumers).
2. **Depth policy**: cap nesting (recommend max depth 3) — UI and SQL both degrade past that; adapters advertise `maxGroupDepth` in `AdapterMeta`.
3. **Wire format**: extend `COMPRESSION_KEY_MAP` (`kind/logic/children` → short keys not colliding with existing `c/t/o/v/n/m/d`), bump the URL prefix (`c:` → `c2:`) with fallback parsing of `c:` payloads, and extend plan 004's `isFilterStateShape` with `isFilterNodeShape`.
4. **Validation semantics**: empty group = drop; single-child group = unwrap; unknown `logic` = drop node (fail closed, consistent with plan 004).
5. **Adapter translation**: the Drizzle side is a ~30-line recursive function at the `base-query-builder.ts:166-181` seam (`and(...)`/`or(...)` on children). Sketch it in the doc. Specify behavior when an adapter does NOT support groups (`supportsFilterGroups: false`): core flattens with AND and emits a console warning, or rejects — recommend reject, silent semantic change is worse.
6. **UI reachability** (design-note level only): the filter bar builds flat filters today; groups arrive later via a "filter builder" surface — the contract must not require UI support to ship.

**Verify**: document exists; sections 1–6 present (`grep -c "^## " plans/design/core-contract-v2.md` ≥ 6).

### Step 2: Write the design document — typed column registry

Add to the same document the typed-contract design. Required content:

0. **Alignment with plan 011 (DONE — its design doc EXISTS at `plans/design/table-definition-dx.md`; read it fully first, including the "Maintainer decisions (2026-07-12)" section)**: the registry must have ONE source of truth — the column tuple collected by `defineTable()` in plan 011's approved API. Derive the registry from its `define()` shape (the compiling prototype is at `packages/core/src/types/experimental/table-def-v1.ts` — build on its types rather than paralleling them). Do not invent a second registry concept.

1. **The registry type**: derived from built columns, not hand-written:

   ```typescript
   // from a tuple of ColumnDefinition<TData, V_i> (plan 005 preserves V_i)
   type ColumnRegistry<TCols extends readonly ColumnDefinition<any, any>[]> = {
     [C in TCols[number] as C['id'] & string]: C extends ColumnDefinition<any, infer V> ? V : never
   };
   ```

   This requires `ColumnDefinition['id']` to carry its literal type — note the dependency on plan 005 and specify that `.id()` must become literal-preserving (`id<const K extends string>(id: K)`).
2. **Threading**: `TableAdapter<TData, TReg = Record<string, unknown>>` where `columns?: (keyof TReg)[]`, `getFilterOptions(columnId: keyof TReg & string)`, `getFacetedValues`/`getMinMaxValues` keyed the same way, and `FilterState<TReg>` constraining `columnId` + narrowing `values` by the registered value type. Every generic defaults so existing untyped usage compiles (`TReg = Record<string, unknown>` keeps `string` keys valid).
3. **Relationship ids**: dotted ids (`'profile.location'`) are opaque literal keys in the registry — document that the registry does NOT model the relationship graph (that stays adapter-side).
4. **Migration story**: adapters implement `TableAdapter<TData>` today and keep compiling; typed benefits are opt-in by passing column tuples through `defineColumns` (plan 005). List which call sites in ui/core need `keyof TReg` plumbed and estimate the count.
5. **Explicit non-goals**: no runtime schema validation from types; no breaking the `meta`-based capability discovery.

**Verify**: sections present; the doc names the plan-005 dependency explicitly.

### Step 3: Build the compiling prototype

Create `packages/core/src/types/experimental/contract-v2.ts` containing the actual `FilterNode`, `FilterGroupNode`, `ColumnRegistry`, `TableAdapterV2` types from the doc (types only — no runtime code beyond maybe a `isFilterGroupNode` guard). It must compile under the package's tsconfig but be imported by nothing in `src/`.

**Verify**: `cd packages/core && bun run typecheck` → exit 0; `grep -rn "experimental/contract-v2" packages/core/src --include="*.ts" | grep -v experimental/` → 0 matches (nothing imports it)

### Step 4: Type-level acceptance tests

`packages/core/tests/types/contract-v2.test.ts` (follow the conventions of existing `tests/types/*.test.ts`):

1. A nested `(status = 'active' AND (role = 'admin' OR role = 'editor'))` tree typechecks as `FilterNode`.
2. A group with `logic: 'xor'` → `@ts-expect-error`.
3. With a registry `{ name: string; age: number }`: `columnId: 'nam'` → `@ts-expect-error`; a `number`-typed filter on `'name'` → `@ts-expect-error`.
4. `TableAdapterV2<User>` with defaulted registry accepts plain strings (back-compat).

**Verify**: `cd packages/core && bun test tests/types/` → pass; typecheck exit 0

### Step 5: Open questions section

End the design doc with the questions only the maintainer can answer, each with your recommendation — note that (a) and (e) are ALREADY DECIDED by the maintainer's 2026-07-12 release-policy directive (see `plans/README.md` RELEASE POLICY): (a) DECIDED — v2 ships as the `0.6.0` breaking release; there is NO parallel `fetchDataV2` method and the old contract surface is replaced outright, not deprecated; (e) DECIDED — contract v2 ships inside plan 011's `betterTables()` instance API as one coordinated 0.6 release with one migration guide. Still open for the doc: (b) whether UI group-builder ships in the same release or later; (c) whether `search` (global search) joins the filter tree as a node or stays a separate param; (d) how plan 002's mutation routing surfaces in v2 write signatures (`createRecord(table, data)`?). Design freedom note: with back-compat waived, prefer the CLEANEST contract over the least-breaking one — e.g. `FetchDataParams.filters` may simply become `FilterNode` (keep accepting a plain `FilterState[]` as implicit-AND only because it's good ergonomics for the simple case, not for compatibility); the `c:` URL-payload READ fallback stays per the policy's one exception.

**Verify**: `grep -c "Recommendation:" plans/design/core-contract-v2.md` ≥ 4

## Test plan

Type-level tests are Step 4. No runtime tests — nothing runs.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/design/core-contract-v2.md` exists, ≥ 6 design sections + open-questions section with ≥ 4 recommendations
- [ ] `packages/core/src/types/experimental/contract-v2.ts` compiles; imported by nothing in `src/`
- [ ] `cd packages/core && bun test tests/types/` passes including 4 new assertions
- [ ] `cd packages/core && bun run typecheck` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 005 has not landed AND its absence makes the registry design speculative (specifically: `.id()` literal preservation) — you may still write the doc, but flag the dependency as unresolved instead of designing around it.
- You find an existing OR-logic implementation anywhere in the pipeline that contradicts the "AND-only" premise (search `or(` in adapters and `logic` in core) — the design must incorporate it, and this plan's premise needs re-verification.
- The registry type causes TS server performance problems (> ~2s incremental check on the prototype file) — document the limit hit and propose the fallback (interface-based registry instead of mapped-tuple inference).

## Maintenance notes

- Implementation follow-ups this design spawns (create as new plans once approved): core types + serialization; filter-manager + UI; Drizzle translation; Prisma translation (fold into plan 008 if sequenced after).
- Plan 008 (Prisma spike) must read this design doc — Prisma's `where: { AND: [...], OR: [...] }` shape is the second consumer that validates the `FilterNode` design.
- The wire-format version bump (`c2:`) interacts with plan 004's validator and CORE-06 (compression key collisions, unplanned) — whoever implements should fix the key-collision whitelist at the same time; it's the same code.
