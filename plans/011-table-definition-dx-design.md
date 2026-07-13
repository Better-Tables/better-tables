# Plan 011: Design the v1 developer experience — Better-Auth-style config + path-typed table definitions (design/spike)

> **Executor instructions**: This is a DESIGN plan. The deliverable is a design
> document plus a compiling type prototype and a type-performance fixture — NOT
> a migration of the codebase. Follow the steps, run every verification
> command, and honor the STOP conditions. When done, update the status row for
> this plan in `plans/README.md` — unless a reviewer dispatched you and told
> you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/core/src/factory.ts packages/core/src/types/factory.ts packages/core/src/builders/ packages/adapters/drizzle/src/relationship-manager.ts`
> If any of these changed since this plan was written, read the live versions
> before designing on top of them; on a structural mismatch with the excerpts
> below, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L (design + type prototype; implementation is follow-up plans)
- **Risk**: LOW for the spike itself; the design it produces defines the v1 public API
- **Depends on**: none hard; co-evolves with 006 (contract v2) and informs 005 (see "Interaction with other plans"); 008 consumes its config design
- **Category**: direction / dx
- **Planned at**: commit `55dfd01`, 2026-07-12 (maintainer design brief received same day)
- **Completed**: 2026-07-13 — executed, reviewer-approved, merged to main at `a82dd7a`. Perf gate: 199k instantiations / 1.03s (budget 2M / 2.5s). The design doc was subsequently refined in place with the maintainer's breaking-release decisions (see its "Maintainer decisions (2026-07-12)" section); open question (b) decided, (a)/(c)/(d)/(e) remain for the implementation plans.

## Why this matters

The maintainer's brief, paraphrased: *the way end developers set this up is critical — one config where you decide drizzle/prisma (Better-Auth-style); and the column builder needs a rethink: TypeScript should autocomplete the dot-notation possibilities; per-table setup should be easy, type-safe, and full of complex possibilities.*

Two facts make this cheaper and more powerful than it looks:

1. **The runtime is already path-based.** The Drizzle adapter's `resolveColumnPath` (`packages/adapters/drizzle/src/relationship-manager.ts:109-175`) splits every `columnId` on `.`, resolves `'profile.location'` against the schema and relationship map, and builds levenshtein "did you mean" suggestions from `availableFields` when the path is wrong. The runtime already defines exactly which strings are valid. This plan's core move is lifting that contract into the type system: a template-literal `Paths<Row>` union so autocomplete shows precisely what the runtime would accept, and a typo'd path becomes a compile error instead of a runtime `RelationshipError`.
2. **The config factory already exists as a shell.** `betterTables()` (`packages/core/src/factory.ts:76-123`) is today a getter/setter bag holding one adapter and one flat `columns` array — no `define()`, no schema awareness, no plugins, no type inference. Its docstring already imagines `prismaAdapter` (`factory.ts:67-73`). It is the natural seed for the Better-Auth-shaped instance.

The output of this plan is the API contract everything else serves: 005 provides its inference primitives, 006's typed registry falls out of `define()`, 007/008 implement its adapter protocol.

## Target DX (the bar to design against)

This is the experience to specify — adjust details in the design doc, keep the shape:

```typescript
// lib/tables.ts — ONE config file, provider decided HERE (Better Auth pattern)
import { betterTables } from '@better-tables/core';
import { drizzle } from '@better-tables/adapters-drizzle';   // swap ↓ one line for Prisma
// import { prisma } from '@better-tables/adapters-prisma';
import { db } from './db';

export const tables = betterTables({
  database: drizzle(db),               // carries the full schema TYPE into the instance
  defaults: { pageSize: 20, urlSync: true },
  plugins: [csvExport()],              // Better-Auth-style extension point
});
```

```typescript
// lib/tables/users.ts — per-table definition; client-safe (imports only the TYPE)
import { defineTable } from '@better-tables/core';
import type { tables } from '../tables';

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  //                                    'users' | 'posts' | 'profiles'  ← autocompleted from schema
  columns: [
    t.text('name'),                    //  ← autocomplete: every string-valued path
    t.text('profile.location'),        //  ← relation paths included; value type inferred
    t.option('role'),                  //  ← pg enum: options auto-derived, values stay 'admin'|'editor'
    t.number('age').range(18, 100),
    t.count('posts').label('Posts'),   //  ← aggregates as typed builder methods
    t.computed('fullName', (u) => `${u.firstName} ${u.lastName}`),
  ],
}));

type UserRow = typeof usersTable.$infer.Row;   // Better-Auth-style $infer
```

Properties to preserve in the design: typing `t.number('` autocompletes **only numeric paths**; `t.text('profile.loc')` is a red squiggle with the valid paths in the hover; no `.id()`/`.accessor()`/`.displayName()` required (path is the id, accessor is derived, label defaults from the path's last segment); everything today's fluent API can express remains expressible.

## Current state

Verified at commit `55dfd01` — read these before writing the doc:

- `packages/core/src/factory.ts:76-123` — the existing `betterTables<TRecord>(config)`: stores `config.database` + `config.columns` behind getters/setters, plus `getConfig`/`updateConfig`. Single-record-type, per-table, no schema. `ExtractAdapterRecord` helper at `:136-141` infers `TData` from `fetchData`'s return — the only inference present.
- `packages/core/src/types/factory.ts` — `BetterTablesConfig`/`BetterTablesInstance` shapes the shell implements.
- `packages/adapters/drizzle/src/factory.ts:89-92` — the type-level extraction precedent to generalize: `drizzleAdapter<TDB>(db)` → `DrizzleAdapter<ExtractSchemaFromDB<TDB>, ExtractDriverFromDB<TDB>>`.
- `packages/adapters/drizzle/src/relationship-manager.ts:109-175` — `resolveColumnPath` (runtime path semantics: 1 segment = direct field or relationship alias; dotted = relation traversal; errors carry `availableFields`/`availableRelationships` + levenshtein suggestion).
- `packages/core/src/builders/column-builder.ts:106` (`.id(id: string)`), `:137-140` (`.accessor()`), and the six typed subclasses — the fluent API that stays as the low-level layer (see plan 005; the path API compiles down to the same `ColumnDefinition` output).
- `packages/core/src/builders/column-factory.ts:106` — `createColumnBuilder<TData>()`, the current per-type entry point; `:250-258` `createColumnBuilders({...})` (a multi-table map factory — evidence the "many tables, one setup" need already surfaced).
- README promises that this design must finally make true: "Define your columns once… end-to-end type safety" (`README.md:10`), the `posts.count` aggregate example (`README.md:132`), the relationship magic (`README.md:41-57`).
- Prior design docs from this plan set (read them; they constrain you): `plans/design/core-contract-v2.md` (plan 006 — typed registry + FilterNode; may not exist yet if 006 hasn't run) and `plans/005-builder-type-inference.md` (inference primitives).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                | exit 0              |
| Typecheck prototype | `cd packages/core && bun run typecheck` | exit 0        |
| Type-level tests | `cd packages/core && bun test tests/types/` | pass        |
| Type-perf gate | `cd packages/core && bunx tsc --noEmit --extendedDiagnostics tests/types/table-def-perf-fixture.ts 2>&1 | grep -E "Check time|Instantiations"` | see Step 5 budget |

## Scope

**In scope** (the only files you should create/modify):
- `plans/design/table-definition-dx.md` (create — the design document)
- `packages/core/src/types/experimental/table-def-v1.ts` (create — compiling type prototype; exported from nothing)
- `packages/core/tests/types/table-def-v1.test.ts` (create — type-level assertions)
- `packages/core/tests/types/table-def-perf-fixture.ts` (create — the 30-table stress fixture)

**Out of scope** (do NOT touch):
- Any existing file under `packages/core/src` (the `experimental/` addition aside), any adapter, any UI code. No migration, no runtime implementation.
- Publishing/changesets.

## Git workflow

- Branch: `table-definition-dx-design`
- Commit style: imperative sentence, e.g. "Add table definition DX design doc and path-type prototype"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Design doc — the config instance (Better Auth mapping)

In `plans/design/table-definition-dx.md`, specify the app-level instance. Required decisions, each with a recommendation and one paragraph of trade-off:

1. **Instance shape**: `betterTables({ database, defaults?, plugins? })` returning `BetterTablesInstance<TAdapter>` — an app-level object created once, from which per-table definitions derive. Contrast with today's per-table shell (`factory.ts:76-123`) and specify the migration (the old signature keeps working via an overload OR is versioned away in 0.6 — recommend: deprecate-and-alias for one minor).
2. **The adapter type protocol** — the load-bearing decision. Each adapter factory's return type carries a type-level schema catalog, e.g.:

   ```typescript
   interface AdapterTypes {
     tables: Record<string, { row: unknown /* relation-aware */; }>;
   }
   interface SchemaAwareAdapter<T extends AdapterTypes = AdapterTypes> extends TableAdapter {
     $types?: T;          // type-only phantom; never a runtime value
   }
   ```

   Specify how Drizzle provides `row` *including relations* (from `ExtractSchemaFromDB` + relations definitions — investigate what drizzle-orm exposes for relation-aware model inference in the pinned version and document the exact type recipe) and how Prisma would (`Prisma.UserGetPayload<{ include: … }>` with depth-1 includes — verify current API via Context7/docs, do not trust memory). Adapters without schema types (REST, memory) fall back to `Record<string, { row: unknown }>` — `defineTable` then requires an explicit row generic (tier-2 DX, still path-typed).
3. **`define` ergonomics**: the curried `defineTable<typeof tables>()('users', (t) => ...)` pattern (curry needed because TS lacks partial type-argument inference — state this) vs. a method `tables.define('users', ...)`. Recommend supporting BOTH: the method for single-file/SPA apps, the curried type-only form for the RSC split (next decision). Table name is `keyof Schema & string`, autocompleted.
4. **RSC / server-client boundary**: the config file imports the db → server-only. Column defs contain functions (accessors, renderers) → must live in client-importable modules WITHOUT importing the instance's runtime. Recommended pattern (spell it out in the doc with a file-layout diagram): `lib/tables.ts` (server: instance), `lib/tables/users.ts` (shared: `defineTable<typeof tables>()` — `import type` only), data bridge = a route handler / server action created from the instance (`tables.handler()` sketch; actual implementation deferred). Include the degenerate single-file mode for non-RSC apps. Name the failure this prevents: importing `tables` into a client component bundles the database driver.
5. **Plugins**: array on the config (Better Auth parity). Define the minimal plugin interface sketch (name + capability contributions + hooks into fetch lifecycle) and TWO concrete motivating examples grounded in this repo: CSV export (exists as adapter method today, `drizzle-adapter.ts` exportData) and saved filter presets (README roadmap item). Keep it a sketch — plugins are not this design's critical path; the point is the config shape reserves the seam.
6. **`$infer` surface**: `tables.$infer.Tables`, `usersTable.$infer.Row`, `usersTable.$infer.ColumnId`, `usersTable.$infer.FilterState` (ties into 006's registry). List each with its derivation.

**Verify**: doc exists; decisions 1–6 present with a `Recommendation:` line each (`grep -c "Recommendation:" plans/design/table-definition-dx.md` ≥ 6 so far).

### Step 2: Design doc — the path-typed column builder

Add the column-builder redesign. Required content:

1. **Path semantics = runtime semantics.** One table mapping each `resolveColumnPath` runtime behavior (direct field / relation alias / dotted traversal / array relation) to its type-level counterpart. The type system must not accept what the runtime rejects, and vice versa. Array relations flatten in paths (`posts.title`, matching the runtime's join semantics — "any related post's title"), not `posts[0].title`.
2. **The type machinery** (goes into the prototype in Step 3 — sketch it in the doc):

   ```typescript
   type Primitive = string | number | boolean | bigint | Date | null | undefined;
   type Prev = [never, 0, 1, 2, 3];                      // depth decrement
   type Paths<T, D extends number = 3> = [D] extends [never] ? never
     : T extends Primitive ? never
     : T extends readonly (infer E)[] ? Paths<E, Prev[D]>
     : { [K in keyof T & string]:
           NonNullable<T[K]> extends Primitive ? K
           : K | `${K}.${Paths<NonNullable<T[K]>, Prev[D]>}` }[keyof T & string];

   type PathValue<T, P extends string> = ...;             // resolve a path to its value type
   type PathsOfType<T, V, D extends number = 3> = ...;    // Paths filtered to PathValue extends V
   ```

   Document: depth cap **3** (and why: relation types can be mutually recursive — user→posts→author→posts…), `NonNullable` unwrapping (optional relations must still contribute paths), nullability propagation into `PathValue` (a path through an optional relation yields `string | null` — filters/renderers must see that).
3. **Builder API on top**: `t.text(path: PathsOfType<Row, string | null>)`, `t.number(...)`, `t.date(...)`, `t.boolean(...)`, `t.option(...)`, `t.multiOption(...)` — each returns the SAME fluent builder plan 005 types (path pre-fills `id`, `accessor` = generated optional-chained getter, `displayName` = title-cased last segment), so `.label()`, `.range()`, `.sortable()`, `.cellRenderer()` keep chaining and `build()` is implicit at `define()` collection time (decide: implicit build vs explicit — recommend implicit; the array literal is the collection point).
4. **Computed columns**: `t.computed(id: string, accessor: (row) => V)` — free-form id (not a path; document that computed ids must not collide with paths — compile-level exclusion `Exclude<string, Paths<Row>>` is not expressible, so it's a runtime uniqueness check), value-typed by inference, then `.asText()/.asNumber()`-style refinement OR type-directed dispatch from `V` (recommend dispatch from `V` with explicit override).
5. **Aggregates — the "complex possibilities"**: `t.count('posts')` (paths to array relations only), `t.sum('orders.amount') / t.min / t.max / t.avg` (numeric paths under an array relation). These formalize what the query builders already half-support (`buildAggregateQuery`, aggregate validation in `base-query-builder.ts:598-631`) and what the README advertises as `posts.count` (`README.md:132`). Specify: type-level = `ArrayRelationPaths<Row>` and `NumericPathsUnder<Row, Rel>`; runtime = the aggregate lands in `ColumnDefinition.meta` (check `column-meta.ts` for the existing meta pattern) so the core type stays adapter-agnostic; adapters advertise aggregate support via `AdapterMeta` (tie into 006's capability extension).
6. **Enum auto-options**: `t.option('role')` with zero config when the underlying value type is a literal union — options derived at the type level (`{ value: V; label: Capitalize<V> }[]` default) and at runtime from adapter schema metadata where available (Drizzle `pgEnum` columns expose `enumValues` as a literal tuple — verify the exact property in the pinned drizzle-orm and document it; Prisma exposes enums via DMMF/generated types). `.options([...])` remains for labels/colors/icons and is checked against the union (plan 005 step 2's `const` inference does this checking).
7. **JSON columns**: recommend `t.json('metadata').path('theme')` builder-level refinement rather than string-DSL paths (`metadata->>theme`) — keeps `Paths<Row>` simple; the JSONB runtime support already exists in the drizzle filter-handler. One paragraph.
8. **Escape hatches**: everything above must degrade gracefully — explicit row generic when no schema-aware adapter, `t.custom()` passthrough to the plan-005 fluent builder, and raw `ColumnDefinition` literals stay accepted by `define()`.

**Verify**: sections 1–8 present; total `Recommendation:` count in the doc ≥ 12.

### Step 3: The compiling type prototype

Create `packages/core/src/types/experimental/table-def-v1.ts` implementing (types only, plus inert function signatures): `Paths`, `PathValue`, `PathsOfType`, `ArrayRelationPaths`, a minimal `SchemaAwareAdapter`, `betterTablesV1()` and `defineTableV1()` signatures, and a mock `t` builder interface with `text/number/option/count/computed`. Imported by nothing in `src/`.

**Verify**: `cd packages/core && bun run typecheck` → exit 0; `grep -rn "experimental/table-def-v1" packages/core/src --include="*.ts" | grep -v experimental/` → 0 matches

### Step 4: Type-level acceptance tests

`packages/core/tests/types/table-def-v1.test.ts` (follow existing `tests/types/*.test.ts` conventions). Fixture types: `User { id; firstName; age; role: 'admin'|'editor'; profile?: Profile|null; posts: Post[] }`, `Profile { location: string|null; website?: string }`, `Post { title: string; views: number; author: User }` (note: deliberately mutually recursive). Assert:

1. `Paths<User>` includes `'profile.location'`, `'posts.title'`, `'role'`; recursion terminates (depth cap) — the type compiles and `'posts.author.posts.title'` is (or isn't) present exactly per the depth-3 rule; pin the expectation.
2. `PathsOfType<User, number>` includes `'age'` and `'posts.views'` but NOT `'firstName'` → `@ts-expect-error` on `t.number('firstName')`.
3. `PathValue<User, 'profile.location'>` is `string | null` (nullability propagates — also because `profile` is optional).
4. `t.option('role')` yields a column whose value type is `'admin' | 'editor'` (not `string`); `.options([{ value: 'bogus', … }])` → `@ts-expect-error`.
5. `t.count('posts')` accepted; `t.count('profile')` (non-array relation) → `@ts-expect-error`.
6. `defineTable` with a non-schema table name → `@ts-expect-error`; with a REST-style adapter (no `$types`), explicit-generic form compiles.

**Verify**: `cd packages/core && bun test tests/types/` → pass; typecheck exit 0

### Step 5: Type-performance fixture and budget

Create `tests/types/table-def-perf-fixture.ts`: a synthetic 30-table schema (5–15 columns each, ~15 relations, at least one mutual recursion) driving 10 `defineTableV1` calls with ~8 columns each. Measure with `bunx tsc --noEmit --extendedDiagnostics` on the fixture. **Budget: check time ≤ 2.5s and instantiations ≤ 2,000,000 on the fixture in isolation** (generous but bounded — the point is a tripwire, not a benchmark). Record the numbers in the design doc. If over budget, iterate (shallower depth default, interface-based memoization, coarser `PathsOfType`) and document what was traded.

**Verify**: the grep'd `Check time`/`Instantiations` lines are in the doc with values under budget.

### Step 6: Migration + interaction section, and open questions

Close the doc with:

- **Interaction with other plans**: 005 (its accessor/options inference and `defineColumns` are the primitives `t.*` builders reuse; its step-3 phantom-type `build()` gating becomes unnecessary for the path API — a path builder is born complete — note that 005 step 3 should be skipped if this design is approved, and that `plans/005-builder-type-inference.md` + `plans/README.md` say so); 006 (the `ColumnRegistry` should be DERIVED from `define()`'s column tuple — one source of truth; filter groups arrive through the same instance); 007/008 (the adapter `$types` protocol is what the toolkit's `SchemaPort` exposes type-level; the Prisma factory must satisfy it).
- **Migration story**: old API → new API table (per feature: instance creation, column defs, UI wiring `<BetterTable table={usersTable}>` vs `columns=`), what's deprecated when, and the "both APIs emit the same `ColumnDefinition`" invariant that makes incremental migration possible.
- **Open questions for the maintainer** (each with a recommendation): (a) package placement — path types in core vs a new `@better-tables/typekit`; (b) ship the instance API in 0.6 with contract v2 or after; (c) default depth cap 3 vs 2; (d) whether `t.option` auto-labels use `Capitalize` or a humanize runtime helper; (e) the data-bridge shape for RSC (route handler vs server actions vs both).

**Verify**: `grep -c "Recommendation:" plans/design/table-definition-dx.md` ≥ 17 total; migration table present.

## Test plan

Type-level tests are Step 4; the perf fixture is Step 5. No runtime tests — nothing runs.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/design/table-definition-dx.md` exists: config sections (1–6), builder sections (1–8), interaction/migration section, ≥ 5 open questions with recommendations
- [ ] `packages/core/src/types/experimental/table-def-v1.ts` compiles; imported by nothing in `src/`
- [ ] `cd packages/core && bun test tests/types/` passes including the 6 new assertion groups
- [ ] Perf numbers recorded in the doc and within budget (or the documented trade that got them there)
- [ ] `cd packages/core && bun run typecheck` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `Paths` over the drizzle-inferred relation-aware row type (decision 2 of Step 1) hits `Type instantiation is excessively deep` even at depth 2 — the fallback design (adapter supplies a PRE-FLATTENED path map: `$types.tables[name].paths: Record<string, ValueType>` computed per-adapter instead of generic recursion) must be evaluated and the doc rewritten around whichever survives; report before rewriting.
- The perf fixture exceeds budget after two documented iteration attempts.
- You find that drizzle-orm's pinned version cannot express relation-aware row types at the type level at all — the schema-catalog protocol then needs a codegen answer (CLI-generated types, Better-Auth-CLI-style); report with evidence, don't design codegen unilaterally.
- Plan 006's design doc exists and its `ColumnRegistry` shape fundamentally conflicts with deriving the registry from `define()` — reconcile in a written note and flag both docs, don't fork the concepts silently.

## Maintenance notes

- Implementation follow-ups this design spawns (new plans once approved): core `betterTables` instance + `defineTable` runtime; path-getter codegen-free accessor derivation; adapter `$types` in drizzle (and prisma via plan 008's successor); UI `<BetterTable table={...}>` prop; CLI scaffolding of `lib/tables.ts` (plan 009's init flow should eventually write this file).
- The `Paths` depth cap and perf budget are permanent maintenance surfaces: every new adapter's `$types` recipe must be run against the perf fixture before release.
- Reviewers of the eventual implementation: the invariant to protect is "path API and fluent API emit identical `ColumnDefinition` objects" — divergence there forks the ecosystem.
