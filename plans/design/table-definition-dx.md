# Design: v1 Developer Experience — Better-Auth-Style Config + Path-Typed Table Definitions

> Companion to `plans/011-table-definition-dx-design.md`. This document is the
> design deliverable; the compiling type prototype lives at
> `packages/core/src/types/experimental/table-def-v1.ts`, its acceptance
> tests at `packages/core/tests/types/table-def-v1.test.ts`, and the
> type-performance fixture at `packages/core/tests/types/table-def-perf-fixture.ts`.
>
> **Provenance note**: this plan set assumes two sibling documents —
> `plans/design/core-contract-v2.md` (plan 006) and
> `plans/005-builder-type-inference.md` (plan 005). Neither exists yet at the
> time of writing. Everywhere this document references them, it is stating
> what THIS design *requires of* them, prescriptively — not reporting
> something read from an existing file. Plan 005's shape is taken from the
> maintainer's own one-line summary of it: it threads accessor-inferred
> `TValue` through the fluent builders (`accessor<V>(fn): Builder<TData, V>`),
> adds `const`-literal checking to `.options()`, and replaces the
> `ColumnDefinition<TData, any>` erasure at the `BetterTable` boundary with a
> `defineColumns()` helper.

---

## Step 1: The config instance (Better Auth mapping)

### 1. Instance shape

**Recommendation:** Introduce `betterTables({ database, defaults?, plugins? })`
as an app-level factory, called once, returning `BetterTablesInstance<TAdapter>`
— a schema-carrying object that `defineTable` reads from. Ship it under the
overload of the SAME export name `betterTables` for one minor release,
disambiguated structurally from the current per-table shell, with the legacy
path marked `@deprecated` and emitting a one-time runtime warning; remove the
legacy overload in the following minor.

Today's `betterTables<TRecord = unknown>(config: BetterTablesConfig<TRecord>): BetterTablesInstance<TRecord>`
(`packages/core/src/factory.ts:76-123`, types in `packages/core/src/types/factory.ts:26-111`)
is a **per-table** getter/setter bag: `config.database` is one adapter for
one record type, `config.columns` is a flat `ColumnDefinition<TRecord>[]`,
and `filters`/`pagination`/`sorting`/`selection`/`virtualization` are inline
initial state. There is no schema, no `define()`, no plugin seam, and the
only type inference present is `ExtractAdapterRecord<TAdapter>`
(`factory.ts:136-141`), which reaches into `fetchData`'s return type.

The v1 shape is structurally distinguishable at the type level: the legacy
config always has `columns?: ColumnDefinition<TRecord>[]` (even if empty),
while the v1 config never has a `columns` key at all (`defaults`/`plugins`
instead). An overload keyed on that shape lets `betterTables(...)` keep
working exactly as it does today for existing per-table callers, while new
callers who omit `columns` get the v1 instance.

This "old signature deprecated-and-aliased for one minor" pattern already
exists in this codebase — see `ColumnBuilder.nullableAccessor()`
(`@deprecated Use .accessorWithDefault() instead`) and `.nullable()`
(`@deprecated Use .normalizeEmptyToNull() instead`) in
`packages/core/src/builders/column-builder.ts:144-151,301-303`. Reusing the
same convention for the factory itself keeps the migration story consistent
across the package rather than introducing a second deprecation idiom.

**Trade-off:** A same-name overload is more discoverable (the docs/README
only ever say "`betterTables`") but structurally-keyed overloads are the one
class of TypeScript overload that can silently misfire if a caller's config
object happens to satisfy both shapes (e.g., someone spreads `columns: []`
into a v1-style config by habit) — the legacy branch would win and the
caller would get a confusing per-table shell instead of an instance. The
alternative — a new export name (e.g. `createTables`) with `betterTables`
frozen at its current meaning — avoids that footgun entirely at the cost of
contradicting the target DX brief's own example, which explicitly reuses
`betterTables` for the new shape. Given the brief is explicit about the name,
this design accepts the overload risk and mitigates it with a runtime
`console.warn` on the legacy path (visible immediately in dev, not just at
compile time) plus a lint-able `@deprecated` JSDoc tag.

### 2. The adapter type protocol (load-bearing decision)

**Recommendation:** Adapters attach a type-only `$types?: T` phantom
property (`T extends AdapterTypes`, never assigned or read at runtime) whose
`tables[name].row` is the *relation-aware* row type. For Drizzle, derive it
from `ExtractTablesWithRelations<Schema>` + a hand-rolled depth-capped
wrapper around `BuildQueryResult` (recipe below, verified against the
actual installed package). For Prisma, the analogous recipe is
`Prisma.<Model>GetPayload<{ include: {...} }>` — **not verified against
source in this pass; Prisma is not an installed dependency in this repo and
no live docs lookup was available. Treat the exact API surface as unverified
and confirm it in plan 008 before relying on it.**

#### The Drizzle recipe (verified)

Verified against the actual **installed** `drizzle-orm@0.45.2` package in
`node_modules/drizzle-orm` (root `package.json` for
`packages/adapters/drizzle` pins `^0.45.1`; `bun install` resolved
`0.45.2`) — not against external documentation, per this task's constraints.
Verification method: a throwaway compile-tested harness (not part of this
repo) built a real 3-table Drizzle pg-core schema with a mutual relation and
exercised the exact type expressions below with `tsc --noEmit --strict`;
it compiled clean with zero errors.

Drizzle exports (from the root `drizzle-orm` package — `index.d.ts` does
`export * from "./relations.js"`, so these are all public, not internal):

- `ExtractTablesWithRelations<TSchema>` (`node_modules/drizzle-orm/relations.d.ts:139-147`)
  — turns your `{ users, profiles, posts, usersRelations, ... }` schema
  object type into a `TablesRelationalConfig`: a map of table name to
  `{ columns, relations, ... }`.
- `BuildQueryResult<TSchema, TTableConfig, TFullSelection>`
  (`relations.d.ts:155-161`) — the same type Drizzle's own
  `db.query.users.findMany({ with: {...} })` uses to compute its return
  type. Critically, **it is driven by an explicit `with` config you pass
  in** — there is no built-in "give me every relation to depth N" helper.
  A bare `with: { profile: true }` includes `profile`'s own columns but
  NOT `profile`'s own relations (`true` short-circuits to
  `InferModelFromColumns`, no further nesting) — depth is manual.
- `FindTableByDBName<TSchema, TTableName>` (`relations.d.ts:99-101`) — looks
  up a table's `TableRelationalConfig` by its relation's `referencedTableName`.

Because `BuildQueryResult` needs an explicit `with` object and stops
recursing the moment you write `true`, getting a depth-capped
"all-relations" row type means building that `with` object recursively
ourselves — the same depth-cap shape `Paths<T, D>` already needs (Step 2):

```typescript
import type {
  ExtractTablesWithRelations, BuildQueryResult,
  TableRelationalConfig, TablesRelationalConfig, FindTableByDBName,
} from 'drizzle-orm';

type Prev = [never, 0, 1, 2, 3];

type DeepWith<
  TConfig extends TableRelationalConfig,
  TSchema extends TablesRelationalConfig,
  D extends number,
> = [D] extends [never]
  ? {}
  : { [K in keyof TConfig['relations']]?:
        TConfig['relations'][K] extends { referencedTableName: infer RT extends string }
          ? FindTableByDBName<TSchema, RT> extends infer RC extends TableRelationalConfig
            ? { with: DeepWith<RC, TSchema, Prev[D]> }
            : true
          : true };

type RelationAwareRow<
  TSchema extends Record<string, unknown>,
  TTableName extends string,
  D extends number = 3,
> = ExtractTablesWithRelations<TSchema> extends infer TRel extends TablesRelationalConfig
  ? TTableName extends keyof TRel
    ? BuildQueryResult<TRel, TRel[TTableName], { with: DeepWith<TRel[TTableName], TRel, D> }>
    : never
  : never;
```

A Drizzle adapter factory (the `drizzleAdapter(db)` in
`packages/adapters/drizzle/src/factory.ts:89-160`, which already extracts
`ExtractSchemaFromDB<TDB>` — `packages/adapters/drizzle/src/types.ts:1101-1115`
— for the flat, non-relational schema) would additionally compute
`ExtractTablesWithRelations<FullSchemaIncludingRelations>` and populate
`$types.tables[name].row` with `RelationAwareRow<Schema, name>` per table.
This is new work for the Drizzle adapter (a follow-up plan, not this one),
but the type recipe itself is proven to compile.

**Verified caveat — relation nullability is NOT "could this row be
missing," it's "is the local join column `.notNull()`".** Drizzle computes
a `One` relation's nullability as
`config.fields.reduce((res, f) => res && f.notNull, true)` (`node_modules/drizzle-orm/relations.js`,
`createOne`), then `BuildRelationResult` adds `| null` to the result type
only when that computed value is exactly `false`
(`relations.d.ts:149-151`). Concretely: a `profile: one(profiles, { fields:
[users.id], references: [profiles.userId] })` relation — declared using the
PRIMARY KEY as the local field, a common pattern for "the FK lives on the
other table" — types as **non-nullable** in Drizzle's own inference, even
though a matching profile row may not exist, because `users.id` is always
`.notNull()`. A relation declared with a genuinely nullable local FK (e.g.
`author: one(users, { fields: [posts.authorId], references: [users.id] })`
where `posts.authorId` has no `.notNull()`) correctly types as nullable.
This is a pre-existing Drizzle behavior, not something this design's
`Paths`/`PathValue` needs to work around — but it means a `t.text(...)`
path through a "PK-keyed" one-relation may claim non-null when the runtime
can, in fact, produce a missing row. Document this prominently wherever the
Drizzle `$types` recipe ships; it is a footgun inherited from the ORM, not
introduced by this design.

**Trade-off:** the depth-capped `DeepWith` wrapper duplicates the same
depth-cap concept `Paths<T, D>` implements natively for plain object types
— two depth-capped recursive types doing conceptually the same job for two
different purposes (one produces a `with` CONFIG object to feed to
`BuildQueryResult`; the other produces a PATH STRING union). They cannot be
unified into one type because `BuildQueryResult` needs the `with` shape,
not a path union. The alternative — write a fully custom
`RelationAwareRow` that doesn't go through `BuildQueryResult`/`with` at all
and instead walks `TableRelationalConfig['relations']` directly, similar to
how `BuildRelationResult` itself works internally — would remove the
duplication but means re-deriving nullability logic (the `Equal<TRel['isNullable'],
false>` check) by hand instead of reusing Drizzle's own tested
implementation. This design prefers reusing `BuildQueryResult` (less code to
maintain, inherits Drizzle's own semantics including the nullability
caveat above verbatim) over a from-scratch walker.

### 3. `define` ergonomics

**Recommendation:** Support BOTH forms. The method form —
`tables.define('users', (t) => ({...}))` — for single-file/SPA apps where
importing the instance's runtime is fine everywhere. The curried, type-only
form — `defineTable<typeof tables>()('users', (t) => ({...}))` — for the
RSC split (decision 4), because it needs `import type { tables }`, not
`import { tables }`, and a method call always needs a real value to call
the method ON.

The curry itself (`defineTable<typeof tables>()`, not
`defineTable<typeof tables>('users', ...)`) exists because TypeScript has no
partial type-argument inference: if `defineTable` took `(tableName, factory)`
with two type parameters (`TInstance` and the inferred `TName`), supplying
`TInstance` explicitly would force supplying `TName` explicitly too, defeating
the autocomplete this whole design exists for. The zero-arg call
`defineTable<typeof tables>()` fixes `TInstance` and returns a new function
value whose own call infers `TName` from the string literal you pass — this
"currying to split explicit and inferred type parameters" is the standard
TS workaround (used throughout, e.g. Zustand's `create<T>()(...)`, which this
repo already depends on — `packages/core/package.json` lists `zustand` as a
dependency).

Table name resolves to `keyof Schema & string`, autocompleted — verified in
the prototype (`TableNamesOf<TInstance>` in
`packages/core/src/types/experimental/table-def-v1.ts`) and exercised in
`packages/core/tests/types/table-def-v1.test.ts` (`defineTableV1<typeof
tables>()('widgets', ...)` is a compile error when `'widgets'` isn't a
schema key).

**Trade-off:** having two entry points (`tables.define(...)` and
`defineTable<typeof tables>()`) is two APIs to document and keep behaviorally
identical — every change to column-def semantics has to be tested against
both. The alternative (curried form only, always) is simpler to maintain but
forces the RSC-motivated ceremony onto apps that never split client/server
boundaries at all (the majority of small apps), which contradicts the
brief's "per-table setup should be easy."

### 4. RSC / server-client boundary

**Recommendation:** the file-layout split shown in the target DX section of
the plan is correct as written; formalize it as the canonical pattern:

```
lib/
  db.ts            # drizzle(...) — the actual driver connection
  tables.ts        # SERVER-ONLY: `export const tables = betterTables({ database: drizzle(db), ... })`
  tables/
    users.ts       # SHARED: `import type { tables } from '../tables'` (type-only!)
                    #         `export const usersTable = defineTable<typeof tables>()('users', (t) => ({...}))`
    posts.ts       # same pattern, one file per table
  tables-handler.ts # SERVER-ONLY: route handler / server action built FROM
                     # `tables` (sketch only — actual implementation is a
                     # follow-up plan; shape TBD, likely
                     # `tables.handler()` returning a Next.js route handler
                     # or a server-action factory that both call the same
                     # underlying fetch/mutate logic against `tables.adapter`)
```

The failure this prevents: `lib/tables.ts` transitively imports the
database driver (e.g. `pg`, `better-sqlite3`). If a client component does
`import { tables } from '../lib/tables'` (a VALUE import, not `import type`),
the bundler has no choice but to include the driver in the client bundle —
at best dead weight, at worst a hard build failure (native Node bindings like
`better-sqlite3` cannot run in a browser bundle at all) or a leaked
connection string. `lib/tables/users.ts` only ever does `import type {
tables }`, which TypeScript's `isolatedModules`-safe type-only imports
(already the project convention — `verbatimModuleSyntax`-adjacent patterns
appear throughout `packages/core/src/types/*.ts`, which are all type-only
files) erase completely at compile time; the generated JS for
`lib/tables/users.ts` has zero references to `lib/tables.ts`'s runtime
export, so it's safe to import from a client component.

Degenerate single-file mode (non-RSC apps, e.g. Vite SPA): put everything
in one file — `betterTables(...)` and every `defineTable(...)` call
together — since there's no server/client bundle split to protect. The two
patterns (single-file vs. split) produce IDENTICAL runtime objects; the
split is purely a bundling concern, never a behavioral one.

**Trade-off:** documenting a multi-file convention this specific risks
looking prescriptive for apps that don't use RSC at all (most current
users of this library, per the README's plain-React examples). This design
accepts that risk because getting the split wrong is a silent, painful
failure (bundled DB drivers, leaked secrets) rather than a compile error —
worth over-documenting once rather than under-documenting and debugging it
per-user later.

### 5. Plugins

**Recommendation:** an array on the config (`plugins: [csvExport()]`),
Better-Auth parity, with a minimal interface:

```typescript
interface TableDefPlugin {
  name: string;
  // Capability contributions: e.g. { aggregates: ['count','sum'] } merged
  // into AdapterMeta (ties to plan 006's capability extension).
  capabilities?: Record<string, unknown>;
  // Lifecycle hooks into the fetch path — sketch only, exact signature
  // deferred to whichever plan implements the query pipeline hook points.
  hooks?: {
    beforeFetch?: (params: unknown) => unknown | Promise<unknown>;
    afterFetch?: (result: unknown) => unknown | Promise<unknown>;
  };
}
```

Two concrete, repo-grounded motivating examples:

1. **CSV export.** Already exists as an adapter capability today —
   `exportData` on the Drizzle adapter (referenced in
   `packages/adapters/drizzle/src/drizzle-adapter.ts`; not read in full for
   this design pass, but its existence as an adapter method, not a
   plugin, is the point). A `csvExport()` plugin would be a THIN wrapper
   that calls the already-existing adapter method and exposes it as
   `tables.plugins.csvExport.download()` or similar — the plugin layer's
   job here is packaging/discoverability, not new capability.
2. **Saved filter presets.** Listed on the README's roadmap (not yet
   implemented anywhere in `packages/core` as of this scan). A
   `savedFilters()` plugin would own persistence (where presets are stored)
   and expose `tables.plugins.savedFilters.list()/.save()/.apply()`,
   operating on the `FilterState[]` shape already defined in
   `packages/core/src/types/filter.ts`.

**Trade-off:** this is explicitly a sketch, not a committed interface —
plugins are not this design's critical path (per the plan). The risk of
sketching too little now is that the FIRST real plugin implementation ends
up redesigning the interface anyway; the risk of sketching too much is
over-committing to hook points before there's a second real plugin to
validate them against. This design accepts "reserve the shape, defer the
details" as the right amount of commitment for a v1 design doc.

### 6. `$infer` surface

**Recommendation:** four members, modeled after Better Auth's own
`$Infer`/`$ERROR_CODES` convention (a stable, type-only property namespace
on the returned object):

| Member | Derivation |
|---|---|
| `tables.$infer.Tables` | `keyof SchemaOf<TAdapter>['tables']` — every table name the adapter knows about. |
| `usersTable.$infer.Row` | The relation-aware row type for that one table (`RowOf<TInstance, TName>` in the prototype). |
| `usersTable.$infer.ColumnId` | `Paths<Row> \| string` — every valid path PLUS free-form computed-column ids (which can't be statically enumerated; see Step 2 section 4). |
| `usersTable.$infer.FilterState` | Reserved for plan 006's typed filter registry — derived from the column tuple the same way `ColumnRegistry` should be (Step 6). Modeled as `unknown` in the prototype; plan 006 owns its real shape. |

Verified present in the prototype as `TableDefInferV1<TName, TRow>`
(`table-def-v1.ts`), though `FilterState` is intentionally left as a
placeholder there per the note above.

**Trade-off:** exposing `$infer` on BOTH the app-level instance and each
per-table definition (rather than just one or the other) is two things to
keep in sync, but matches the actual two levels users need to extract types
at (`type AllTableNames = typeof tables.$infer.Tables` vs. `type UserRow =
typeof usersTable.$infer.Row`) — collapsing to one level would force
awkward `Tables['users']['Row']`-style indexing instead of the flatter,
Better-Auth-familiar `usersTable.$infer.Row`.

---

## Step 2: The path-typed column builder redesign

### 1. Path semantics = runtime semantics

The runtime contract is `RelationshipManager.resolveColumnPath(columnId,
primaryTable)` in
`packages/adapters/drizzle/src/relationship-manager.ts:109-285`. Every
behavior it implements has a direct type-level counterpart; the table below
is the contract both sides must honor (verified by reading the full method,
not by any external doc):

| Runtime behavior (`resolveColumnPath`) | Where | Type-level counterpart |
|---|---|---|
| 1 segment, matches a field on the primary table | `:126-140` | `Paths<T>`'s primitive-valued key branch: `K` alone. |
| 1 segment, matches a relationship alias (`primaryTable.alias` in the relationship map), NOT a field | `:143-154` | `Paths<T>`'s non-primitive key branch, the bare `K` alternative (before any `.`). |
| 1 segment, matches neither — throws `RelationshipError` with levenshtein suggestion from `availableFields`/`availableRelationships` | `:156-173` | Not a member of the `Paths<T>` union at all — a typo is a compile error (red squiggle) instead of a runtime throw. The levenshtein suggestion has no type-level equivalent; TS's own "did you mean" quickfix on union-membership errors is the closest analog and already fires today (verified: `tsc`'s error output for an invalid path literal names the nearest valid member, see the worked example in the perf fixture verification below). |
| 2 segments, first part is a relationship alias — checked FIRST even if it also matches a column name | `:188-205` | `Paths<T>`'s recursive branch: `` K | `${K}.${Paths<NonNullable<T[K]>, Prev[D]>}` ``, where `K`'s resolved value is a relation object, not primitive — matching "relationship wins over column" is automatic because a field that's ALSO a relation name only appears in `Paths<T>` via its actual TS type (relations and JSON-accessor columns can't collide in a single TS property the way `authors` can be both a DB column name and a relationship alias at the SQL level — this is a place where the type system is stricter/simpler than the runtime, not a gap: if `T['authors']` is typed as `Author[]`, the runtime's own "column vs relation" ambiguity doesn't exist in the TS row shape to begin with). |
| 2 segments, first part is a column (not a relationship) — JSON/JSONB accessor | `:207-225` | Deliberately NOT modeled in `Paths<T>` (see Step 2 section 7) — would conflate with relation dot-paths, since both use the identical `field.subfield` syntax and the runtime disambiguates only via a schema lookup that has no natural TS-type equivalent (a JSONB column's TS type is typically `unknown`/a loose interface, not something `Paths` can safely recurse into without adapter-supplied metadata). Handled by a separate `t.json(path).path(key)` builder-level API instead. |
| 3+ segments, multi-level relationship traversal | `:238-277` | `Paths<T>`'s recursion, naturally, up to the depth cap `D`. |
| Array relationship (`isArrayRelationship` true) | `:362-367` | `Paths<T>`'s array-unwrap branch: `T extends readonly (infer E)[] ? Paths<E, Prev[D]> : ...` — flattens exactly like the runtime (`getRequiredJoins`/`buildQueryContext` join on the array relation and apply the rest of the path against ANY matching row, never `posts[0]`). `ArrayRelationPaths<T>` additionally identifies which path SEGMENTS name an array relation directly (for `t.count()` — see section 5). |
| Malformed input: empty segment, leading/trailing dot, consecutive dots | `:889-917` (`validateColumnIdInput`) | No type-level equivalent needed — `Paths<T>` only ever GENERATES well-formed dotted strings from real property keys, so malformed strings are simply never members of the union. The runtime validation stays necessary for adapters/paths that don't originate from a type-checked `t.*()` call (raw `ColumnDefinition` literals, dynamic columnIds from user input, etc. — see Step 2 section 8). |

**Recommendation:** treat the table above as an enforced contract, not just
documentation — add a follow-up-plan test that runs REAL path strings
through both `RelationshipManager.resolveColumnPath` (at runtime, in the
Drizzle adapter's own test suite) and a `Paths<T>`-based type assertion
(compile-time) against the SAME fixture schema, so the two can't silently
drift apart as either side evolves. Nothing in this design plan builds that
cross-check (it requires a runtime schema instance, out of scope for a
type-only prototype); it is named here so the implementation follow-up
plan doesn't have to rediscover the need.

The one asymmetry worth naming explicitly: the type system is **strictly
more conservative** than the runtime in one case. If a schema's relation
graph is deeper than the depth cap (Step 2 section 2), the runtime will
happily resolve a 5-segment path the type system won't offer in
autocomplete or accept as a literal. This is intentional (see the depth-cap
rationale below) and is called out again in the Migration story
(Step 6) and Open Questions (c).

### 2. The type machinery

Implemented and verified in
`packages/core/src/types/experimental/table-def-v1.ts`; this section
documents the design intent behind each piece (full source is the artifact
of record — this is not a re-statement of the code, but the reasoning a
future reader of that file needs that comments alone don't carry):

```typescript
type Primitive = string | number | boolean | bigint | Date | null | undefined;
type Prev = [never, 0, 1, 2, 3];
type Paths<T, D extends number = 3> = [D] extends [never] ? never
  : T extends Primitive ? never
  : T extends readonly (infer E)[] ? Paths<E, Prev[D]>
  : { [K in keyof T & string]:
        NonNullable<T[K]> extends Primitive ? K
        : K | `${K}.${Paths<NonNullable<T[K]>, Prev[D]>}` }[keyof T & string];

type PathValue<T, P extends string> = ...;      // resolves a path to its value type
type PathsOfType<T, V, D extends number = 3> = ...;  // Paths filtered to PathValue extends V
type ArrayRelationPaths<T, D extends number = 3> = ...; // Paths whose value is itself an array
```

**Depth cap = 3, and why.** Relation types can be mutually recursive —
`user -> posts -> author -> posts -> ...` — so an uncapped recursive
conditional type does not terminate (TypeScript would report "Type
instantiation is excessively deep or possibly infinite"). `Prev` is a
decrement lookup (`Prev[3] = 2`, ..., `Prev[0] = never`); hitting `never`
is the base case. Depth 3 means: the primary table's own fields (depth 1),
fields reached through ONE relation hop (depth 2, e.g. `profile.location`),
and fields reached through TWO relation hops (depth 3, e.g.
`posts.author.role`) are all offered; a THIRD hop
(`posts.author.posts.title`, verified absent from `Paths<User>` in
`table-def-v1.test.ts`) is not. This was empirically verified, not assumed
— see the worked trace in that test file's comments and the perf numbers
below, which show plenty of headroom to consider raising it later (Open
question (c)).

**`NonNullable` unwrapping.** Every recursive step first strips `null`/
`undefined` from the relation's own type before recursing into it — an
OPTIONAL relation (`profile?: Profile | null`) must still contribute its
own nested paths (`profile.location` must be offered even though `profile`
itself might not exist), matching the runtime's behavior: a LEFT JOIN
against a nullable relation still lets you filter/select the joined
columns, it just means some rows have nulls there.

**Nullability propagation into `PathValue`.** A path through an optional or
nullable relation must have that reflected in the LEAF value type — a
renderer or filter operating on `profile.location`'s value needs to know it
might be `null`, not just that `Profile.location` itself is nullable.
`PathValue<User, 'profile.location'>` resolves to `string | null` — the
`null` comes from BOTH sources (`profile` being optional AND `location`
being nullable), collapsed into one `| null` rather than compounding into
`| null | undefined`. `undefined` is deliberately folded into `null`
throughout: a missing relation is represented the way a LEFT JOIN
represents it (a null row), not as `undefined` — this keeps `PathValue`
directly usable as a column's value type without a renderer ever having to
handle three states (`value`, `null`, `undefined`) where the runtime only
ever produces two.

### 3. Builder API on top

`t.text(path)`, `t.number(path)`, `t.date(path)`, `t.boolean(path)`,
`t.option(path)`, `t.multiOption(path)` each constrain `path` to
`PathsOfType<Row, V>` for their respective `V` (verified: `t.number('firstName')`
where `firstName: string` is a compile error in
`table-def-v1.test.ts`, `'t.number() -- path autocomplete restricted to
numeric paths'` describe block). Each returns the SAME fluent builder
plan 005 types — `.label()` (see naming note below), `.sortable()`,
`.filterable()`, `.cellRenderer()` all keep chaining exactly as
`ColumnBuilder` does today (`packages/core/src/builders/column-builder.ts:106-412`).
The path pre-fills what today requires three separate calls:

| Today (`packages/core/src/builders/column-builder.ts`) | Path-typed v1 |
|---|---|
| `.id('profile.location')` (`:106-109`) | Derived from the path string itself. |
| `.accessor(u => u.profile?.location)` (`:137-140`) | Generated: an optional-chained getter walking the path's segments. |
| `.displayName('Location')` (`:114-117`) | Defaults to the path's last segment, title-cased (`location` -> `Location`); `.label()` overrides it. |

**Naming note (feeds Open Question (d)):** the target DX brief's example
uses `.label('Posts')`, but today's `ColumnBuilder` has `.displayName()`,
not `.label()` — there is no existing `.label()` on `ColumnBuilder` (verified:
`grep -n "label(" packages/core/src/builders/*.ts` only matches
`ActionBuilder`, a different class entirely). This design treats `.label()`
as an ADDITIONAL alias on the path-typed builders (shorter, matches the
brief), not a rename of `.displayName()` — the low-level fluent builder
keeps `.displayName()` for backward compatibility.

`build()` is implicit at `define()`'s column-array collection time: the
target DX's `columns: [t.text('name'), ...]` never calls `.build()`.
**Recommendation:** implicit build. The array literal passed to `columns`
IS the collection point — `defineTable`'s runtime implementation calls
`.build()` (or equivalent) on every array element when constructing the
final table definition, the same way `Array.prototype.map` would. The
alternative (explicit `.build()` on every entry, matching today's fluent
API exactly) is more consistent with the existing builder pattern but
directly contradicts the target DX brief, which shows zero `.build()`
calls in the example. Consistency with the brief wins here since it's the
literal bar this design is scored against.

### 4. Computed columns

`t.computed(id: string, accessor: (row) => V)` — the id is free-form, NOT a
path (there is no row property to derive it from). **Recommendation:**
value-typed by inference with type-directed dispatch from `V` — verified in
the prototype as `ComputedBuilderFor<TData, V>`, a conditional type that
returns a `NumberPathColumnBuilder` when `V extends number`, else the
generic `PathColumnBuilder<TData, V>` — rather than requiring an explicit
`.asText()`/`.asNumber()` call. Explicit override remains possible by
annotating `V` at the call site (`t.computed<'label', string>(...)`) when
the inferred dispatch guesses wrong (e.g. a template literal type someone
wants treated as a plain option value).

**Computed-id collision with real paths is a runtime check, not a compile
one.** The plan's own framing is worth stating precisely here because it's
easy to assume TypeScript can enforce it and then be surprised it can't:
`Exclude<string, Paths<Row>>` is NOT expressible in TypeScript (`Exclude`
only removes members from a UNION of literal types; `string` is not a
union of its infinite literal members, so `Exclude<string, 'a'|'b'>` is
just `string`, unchanged). There is no way to say "any string except these
specific ones" as a type when the "any string" side is the general
`string` type. `defineTable`'s runtime implementation must therefore check
computed-column ids against the resolved path set at CALL TIME and throw
(mirroring `validateColumns`'s existing duplicate-id check in
`packages/core/src/builders/column-factory.ts:288-327`) — this is a place
where the design deliberately accepts a runtime check the type system
cannot replace.

### 5. Aggregates — the "complex possibilities"

`t.count('posts')` (paths to array relations only — `ArrayRelationPaths<Row>`),
`t.sum('orders.amount')` / `.min()` / `.max()` / `.avg()` (numeric paths
reached THROUGH an array relation — `NumericPathsUnder<Row, Rel>`, verified
in the prototype). These formalize what the query builders already
half-support: `buildAggregateQuery(columnId, aggregateFunction,
primaryTable)` (abstract method,
`packages/adapters/drizzle/src/query-builders/base-query-builder.ts:121-125`)
already takes a plain dotted `columnId` string resolved the SAME way as any
other column (through `RelationshipManager`), and
`validateAggregateFunction`/`validateAggregateColumnCompatibility`
(`:594-624`) already validate the function-to-column-type pairing at
runtime. The README already advertises the OUTCOME (`posts.count` as a
column, `README.md:132`) but today it's hand-computed client-side
(`cb.number().id('posts.count').accessor(u => u.posts?.length || 0)`) —
not a real pushed-down aggregate query. `t.count('posts')` closes that gap
by making it a real aggregate, typed.

Type-level: `ArrayRelationPaths<Row>` (paths whose `PathValue` is an array)
and `NumericPathsUnder<Row, Rel>` (numeric paths whose string prefix
matches a given array-relation path). Runtime: the aggregate function and
target column land in `ColumnDefinition.meta` (verified pattern exists —
`packages/core/src/types/column-meta.ts:209-263`, `ColumnMeta` already has
an open `[key: string]: unknown` extension slot alongside typed sections
like `numberFormat`/`currencyFormat`), keeping the CORE `ColumnDefinition`
type adapter-agnostic — an adapter that can't push down aggregates simply
ignores the meta key and the column falls back to client-side computation
(today's behavior), rather than the core type needing an
adapter-conditional shape. Adapters advertise aggregate support via
`AdapterMeta` (ties into plan 006's capability extension — not read from an
existing file, since 006 doesn't exist yet; this is what THIS design
requires of it).

**Recommendation:** land the aggregate function/target in
`ColumnDefinition.meta` rather than widening the core `ColumnDefinition`
type with aggregate-specific fields. The `meta`-key approach means an
adapter that never implements pushed-down aggregates (REST, in-memory)
doesn't need to know the aggregate vocabulary exists at all — it just sees
an opaque meta bag and falls back to client-side computation, exactly like
an unrecognized `ColumnMeta` extension property today. Widening the core
type instead would force every adapter to at least acknowledge aggregate
fields even when it can't act on them.

**Open item, not resolved here:** `ArrayRelationPaths<Row, D>` is, by
construction, recursive up to the SAME depth cap as `Paths` — so it type-checks
`t.count('posts.author.posts')` (an array relation reached through
TWO hops) just as readily as `t.count('posts')` (one hop). Whether the
RUNTIME can actually execute a semantically correct aggregate for a
multi-hop path is genuinely unverified: `buildAggregateQuery` takes the
same generic `columnId: TColumnId` shape as any other column, so nothing in
its signature obviously forbids it, but "count of the posts written by each
post's author" is a meaningfully different SQL shape (a correlated
subquery, not a simple GROUP BY on one join) than "count of this user's
posts." This design deliberately allows the type to express it
(forward-compatible, matches "full of complex possibilities") while
flagging that the adapter-level semantic correctness of multi-hop
aggregates needs verification by whoever implements plan 007/008 — it is
NOT verified here.

### 6. Enum auto-options

`t.option('role')` with zero config when the path's resolved value is a
literal union. Type level: options default to
`{ value: V; label: Capitalize<V> }[]` for `V` a string literal union (ties
to Open Question (d) on whether `Capitalize` or a runtime humanize helper
is the right default — `Capitalize<'multi_word_value'>` only capitalizes
the first character, it doesn't insert spaces, so it's a poor default for
snake_case enum values specifically). Runtime, where the adapter exposes
it: for Drizzle, **verified** — `pgEnum('role', ['admin', 'editor'])`
(`node_modules/drizzle-orm/pg-core/columns/enum.d.ts:82`) returns a
`PgEnum<Writable<T>>` where `T` is inferred as the literal tuple
`['admin', 'editor']` from positional tuple-contextual inference (no
`as const` needed — verified by compiling `pgEnum('role', ['admin',
'editor']).enumValues` and confirming its type is the literal tuple, not
`string[]`); the resulting column's `.enumValues: T['enumValues']`
(`enum.d.ts:76`) is that same literal tuple, so `.enumValues[number]` gives
the exact `'admin' | 'editor'` union. For Prisma, enums are exposed via the
generated client's DMMF/enum types — **not verified against source in this
pass** (Prisma is not installed; see the note at the top of this document).

**Recommendation:** derive options from adapter schema metadata WHEN
AVAILABLE (Drizzle's `enumValues`, verified above) and fall back to the
type-only default (Open Question (d)) only when the adapter can't supply
runtime metadata (REST/memory adapters, or a Drizzle column whose type is a
plain string literal union not backed by a real `pgEnum`). Preferring the
adapter-supplied source of truth means the runtime option list and the
compile-time literal union can never drift apart for schema-aware
adapters — a Drizzle enum migration that adds a value updates both
automatically, whereas a purely type-level default would require the
consuming app's TypeScript types to be regenerated/re-inferred separately
from the actual database migration.

`.options([...])` remains available for labels/colors/icons, but its role
changes in a way worth highlighting as a genuine simplification, not just a
port: TODAY, `OptionColumnBuilder.options()`
(`packages/core/src/builders/option-column-builder.ts:63-90`) takes
`FilterOption[]` with `value: string` — untyped, because the CURRENT
`.option()` builder doesn't know the value's literal union ahead of time,
it has to (eventually, per plan 005) INFER `TValue` from this very array,
which is why plan 005 needs a `const`-literal inference trick at all. In
the path-typed design, `.option(path)` already knows `TValue` from
`PathValue<Row, path>` before `.options()` is ever called — so `.options()`
becomes a plain CHECK (does each `value` belong to the already-known
union?), not an inference source. Verified in the prototype: `t.option('role').options([{
value: 'bogus', label: 'Bogus' }])` is a compile error
(`table-def-v1.test.ts`, `'rejects an option value outside the literal
union'`) with no `const` modifier needed anywhere in the call.

### 7. JSON columns

**Recommendation:** `t.json('metadata').path('theme')` builder-level
refinement, NOT a string-DSL path like `metadata.theme` folded into
`Paths<Row>`. The runtime already supports one-level JSONB accessors via
the identical dot syntax (`survey.title` where `survey` is a column,
disambiguated from a relationship by schema lookup order — verified,
`relationship-manager.ts:188-225`: relationship checked FIRST, falls back
to "is `firstPart` an actual column" only if no relationship matches) and
`filter-handler.ts` builds the `->>'key'` SQL extraction
(`packages/adapters/drizzle/src/filter-handler.ts:118-129,274-300`,
verified: `SAFE_JSONB_FIELD_NAME_PATTERN`, `buildJsonbExtraction`,
`isJsonbAccessor`). Folding this into `Paths<Row>` would require `Paths` to
recurse into a JSONB column's TS type (typically `unknown` or a loose,
adapter-supplied interface) with no schema-level guarantee about what keys
actually exist — unlike a relation, where the related TABLE's real
TypeScript type bounds what's safe to offer. A builder-level `.path(key)`
keeps `Paths<Row>` simple (JSONB columns are just `Primitive`-ish leaves
from `Paths`'s point of view — `unknown`/`Record<string,unknown>` — so they
terminate recursion normally) while still letting `key` be typed against
whatever shape the column's generic parameter declares
(`t.json<{theme: string}>('metadata').path('theme')`).

### 8. Escape hatches

Everything above degrades gracefully:

- **No schema-aware adapter** (REST, in-memory): `defineTableRowV1<TRow>()`
  in the prototype — an explicit row generic replaces schema-derived
  inference; table name becomes an unconstrained `string` (no catalog to
  check it against), but columns remain fully path-typed against the
  supplied `TRow`. Verified compiling in `table-def-v1.test.ts`, `'the
  tier-2 explicit-row form compiles for a schema-less (REST-style)
  adapter'`.
- **`t.custom()`**: passthrough to the plan-005 fluent builder for anything
  the path vocabulary can't express — verified present as
  `PathColumnFactory.custom<TValue>()` in the prototype.
- **Raw `ColumnDefinition` literals**: `define()`'s `columns` array accepts
  a plain object shaped like today's `ColumnDefinition` alongside path
  builders in the SAME array — verified as
  `RawColumnDefinitionLike<TData>` unioned into `TableDefResultV1['columns']`
  in the prototype. This is the concrete mechanism behind the "both APIs
  emit the same `ColumnDefinition`" invariant in the Migration story
  (Step 6): an app can mix hand-written `ColumnDefinition` objects and
  `t.*()` path builders in one array during an incremental migration.

**Recommendation:** keep all three escape hatches permanently, not as
migration-window-only scaffolding. Even a fully path-typed codebase will
periodically need `t.custom()` (a column whose renderer logic doesn't map
cleanly to a single path) or a raw `ColumnDefinition` literal (generated
programmatically, e.g. by a future CLI or admin-panel builder that isn't
itself hand-written TypeScript). Treating these as permanent, first-class
parts of the API — not a deprecated bridge — avoids a future breaking
change to remove them once the "migration" is nominally complete.

---

## Step 3–4: Prototype and acceptance tests (summary; see source for detail)

The type machinery above is implemented in full at
`packages/core/src/types/experimental/table-def-v1.ts` and exercised by 16
acceptance-test cases in `packages/core/tests/types/table-def-v1.test.ts`,
covering: `Paths<User>` membership (`profile.location`, `posts.title`,
`role`) and the depth-3 cutoff (`posts.author.posts` present,
`posts.author.posts.title` absent — pinned via `@ts-expect-error` and
independently confirmed with an isolated compile check outside this
repo); `PathsOfType<User, number>` membership and rejection
(`t.number('firstName')` is a compile error); `PathValue<User,
'profile.location'>` resolving to exactly `string | null`; `t.option('role')`
inferring `'admin' | 'editor'` and rejecting an out-of-union `.options()`
entry; `t.count('posts')` accepted and `t.count('profile')` (a to-one
relation) rejected; and `defineTableV1` rejecting an unknown table name
while the tier-2 `defineTableRowV1` escape hatch compiles for a
schema-less row type.

Both `cd packages/core && bun test tests/types/` (105 pass, 0 fail,
including the 16 new cases) and a full-package `tsc --noEmit` diffed
against the pre-existing baseline (see Notes below) confirm the new files
introduce zero type errors.

---

## Step 5: Type-performance budget

Fixture: `packages/core/tests/types/table-def-perf-fixture.ts` — 30
synthetic tables (7-15 fields each, landing within the 5-15 target range),
~15 relations including a deliberate 2-table mutual recursion
(`Table1 <-> Table2`) AND a longer 15-node cycle (`Table3 -> Table4 -> ...
-> Table15 -> Table1`), and 10 `defineTableV1` calls with 8 columns each
exercising `t.text`/`t.number`/`t.boolean`/`t.date`/`t.option`/`t.computed`/
`t.count`/cross-relation `t.text('relX.name')` paths.

Measured with the exact command specified in the plan:

```
cd packages/core && bunx tsc --noEmit --extendedDiagnostics tests/types/table-def-perf-fixture.ts \
  2>&1 | grep -E "Check time|Instantiations"
```

**Result:**

```
Instantiations:             199114
Check time:                  1.00s
```

**Budget: check time ≤ 2.5s, instantiations ≤ 2,000,000. Both cleared on
the first attempt** — no iteration was needed (check time at 40% of
budget, instantiations at ~10% of budget). No trade-offs (shallower depth,
memoization, coarser `PathsOfType`) were necessary.

Sanity cross-check: running the same fixture as part of the full
`packages/core` project (`tsc --noEmit -p tsconfig.json`, which shares
type-checking work across all project files rather than checking the
fixture in cold isolation) reports **Instantiations: 104,685, Check time:
0.59s** for the ENTIRE project including this fixture — lower than the
isolated run, consistent with cross-file instantiation caching, and
reinforcing that the isolated number above is a conservative (not
optimistic) reading.

**Implication for Open Question (c):** there is enough headroom (~10x on
instantiations) that dropping the default depth cap from 3 to 2 purely for
performance is unnecessary at this schema scale. The cap should stay a
per-`defineTable`-call override (`Paths<Row, 2>`), not a global default
change, unless a future adapter's schema is dramatically larger than this
30-table fixture (see Maintenance notes in the source plan: every new
adapter's `$types` recipe should be re-run against this fixture before
release).

---

## Step 6: Interaction with other plans, migration, and open questions

### Interaction with other plans

- **Plan 005 (builder type inference).** Its accessor/options inference
  (`accessor<V>(fn): Builder<TData, V>`) and `defineColumns()` helper are
  the PRIMITIVES the `t.*()` builders in this design reuse at the
  implementation level — a path builder still needs a real
  `ColumnBuilder<TData, TValue>` underneath once the path resolves to an
  accessor function; plan 005 is what makes that underlying builder
  properly value-typed instead of erased to `any`. Its step 3 "phantom-type
  `build()` gating" (requiring `.id()`/`.accessor()` before `.build()` is
  callable, presumably via a branded/phantom marker type) becomes
  UNNECESSARY under the path API specifically: a path builder is "born
  complete" — the path pre-fills id AND generates the accessor in one
  step (Step 2 section 3 above), so there's no intermediate
  "incompletely-configured" state to gate against. **This design's
  conclusion: plan 005 step 3 should be skipped if this design is
  approved.** `plans/005-builder-type-inference.md` and `plans/README.md`
  should say so explicitly once plan 005 exists as a written document —
  this note is the record of that decision pending plan 005 actually being
  authored.
- **Plan 006 (contract v2 / typed registry).** The `ColumnRegistry` this
  design assumes should be DERIVED from `define()`'s column tuple — one
  source of truth, not two things to keep in sync. Concretely: whatever
  `ColumnRegistry<Columns>` plan 006 designs should be a type FUNCTION of
  `TableDefinitionV1['columns']`, not a separately-authored parallel
  structure. `usersTable.$infer.FilterState` (Step 1 decision 6) is the
  seam where plan 006's registry surfaces on a table definition. No
  conflict to reconcile here since plan 006's doc doesn't exist yet in this
  worktree (the STOP condition in the source plan for "006 conflicts with
  this design" was checked and does not apply) — this is a forward
  requirement THIS design places on 006, not a reconciliation of existing
  content.
- **Plans 007/008 (adapter implementations).** The `$types` protocol
  (`SchemaAwareAdapter<T>`, Step 1 decision 2) is what the "toolkit"'s
  `SchemaPort` (mentioned in the source plan's maintenance notes, not
  otherwise detailed here) exposes at the type level. The Prisma factory
  plan 008 builds must satisfy the SAME `SchemaAwareAdapter<T>` interface
  this design defines — its `row` recipe is flagged above as unverified
  and is explicitly plan 008's job to confirm against real Prisma source
  or current docs (this task had neither installed nor network-available).

### Migration story

| Feature | Old API | New API | Both emit... |
|---|---|---|---|
| Instance creation | `betterTables<TRecord>({ database, columns, filters?, pagination?, ... })` — per-table, `factory.ts:76-123` | `betterTables({ database, defaults?, plugins? })` — app-level, once | N/A (instance shape genuinely changes) |
| Column definitions | `createColumnBuilder<TData>().text().id('name').displayName('Name').accessor(u => u.name).build()` — `column-factory.ts:106-116` | `t.text('name')` — id/accessor/displayName derived from the path | The same `ColumnDefinition<TData, TValue>` object (`types/column.ts:27-87`) |
| Relation columns | `.id('profile.location').accessor(u => u.profile?.location)` — hand-written accessor, stringly-typed id, no autocomplete | `t.text('profile.location')` — autocompleted, typo is a compile error | Same `ColumnDefinition`, generated accessor is functionally identical to the hand-written one |
| Aggregate columns | `.id('posts.count').accessor(u => u.posts?.length \|\| 0)` — client-computed, README.md:132 | `t.count('posts')` — pushed-down aggregate via adapter meta (Step 2 section 5) | Same `ColumnDefinition` shape; VALUE computation differs (client vs. adapter) — this is the one row in this table where the two APIs do NOT produce behaviorally identical output, and that difference should be called out in end-user migration docs, not just this table |
| Multi-table setup | `createColumnBuilders({ users: {} as User, posts: {} as Post })` — `column-factory.ts:250-260`, a map of untyped placeholder values | `defineTable<typeof tables>()('users', ...)` / `('posts', ...)` — one instance, schema-derived, no placeholder values needed | N/A (the multi-table NEED already existed — `createColumnBuilders` is evidence of it per the source plan — this design formalizes it) |
| UI wiring | `<BetterTable columns={columns} data={data} features={{...}} />` — `README.md:101-114` | `<BetterTable table={usersTable} data={data} />` (sketch; actual prop implementation is a follow-up plan, not built here) | Both ultimately read `ColumnDefinition[]` under the hood |

**What's deprecated when:** the legacy `betterTables()` overload and the
existing fluent `createColumnBuilder`/`createColumnBuilders` stay fully
functional and undeprecated in code (no runtime warning) for the 0.6
release that ships this design's runtime implementation — they are a
DIFFERENT, still-valid layer (Step 2 section 8's raw-`ColumnDefinition`
escape hatch depends on the fluent builders continuing to exist and produce
`ColumnDefinition` objects). Only the OLD `betterTables()` call SHAPE
(instance-shell-per-table, decision 1) gets the `@deprecated`-and-warn
treatment, and only once the new instance shape ships. This mirrors the
existing repo convention exactly (`nullableAccessor`/`nullable` deprecated
in place, not removed, `column-builder.ts:144-151,301-303`).

**The invariant that makes incremental migration possible:** path
builders and the low-level fluent builders emit the IDENTICAL
`ColumnDefinition<TData, TValue>` shape (`types/column.ts:27-87`) — verified
structurally in the prototype (`RawColumnDefinitionLike<TData>` is a
projection of that same interface, unioned into the same `columns` array
type as the path builders). An app can have SOME columns still written with
`cb.text().id(...).accessor(...).build()` and SOME written as `t.text(path)`
in the same `columns` array, table by table, forever if needed — there is
no flag day.

### Open questions for the maintainer

**(a) Package placement: path types in `@better-tables/core` vs. a new
`@better-tables/typekit`.**
**Recommendation:** keep in `core`, under `src/types/` (promoted out of
`experimental/` once approved), NOT a new package. The path types have no
runtime code and zero dependencies beyond TypeScript itself — the
"separate package" argument (usually: independent versioning, smaller
install footprint, reuse outside this library) doesn't apply here, since
anyone using path types is, by definition, using `@better-tables/core`'s
`defineTable`. A new package adds a publish/version-sync burden (two
packages that must always ship compatible versions together) for no
isolation benefit. Revisit only if a genuinely external consumer (e.g. a
future codegen CLI that needs `Paths<T>` without pulling in the rest of
`core`) materializes.

**(b) Ship the instance API in 0.6 with contract v2, or after.**
**Recommendation:** together, in 0.6. `usersTable.$infer.FilterState`
(Step 1 decision 6) and the "`ColumnRegistry` derived from `define()`"
requirement (Interaction section above) mean the instance API and contract
v2's typed registry are not independently useful — shipping the instance
API alone would mean `$infer.FilterState` stays `unknown` (a broken
promise in the `$infer` surface), and shipping contract v2 alone leaves
its `ColumnRegistry` with no natural place to derive FROM. Sequencing them
across releases means one of the two ships in a visibly half-finished
state.

**(c) Default depth cap 3 vs. 2.**
**Recommendation:** keep 3 as the global default. The Step 5 perf numbers
show ~10x headroom on the instantiation budget and ~2.5x on check time at a
30-table, ~15-relation synthetic schema — there's no performance case for
2 today. Expose `D` as a per-call override (`Paths<Row, 2>`) for any future
schema that turns out to need it, and re-measure against the perf fixture
(scaled up if needed) before ever lowering the global default.

**(d) `t.option` auto-label: `Capitalize` vs. a humanize runtime helper.**
**Recommendation:** a runtime humanize helper, not `Capitalize<S>`.
`Capitalize<'multi_word_value'>` only uppercases the first character,
producing `'Multi_word_value'` — wrong for the common snake_case/kebab-case
enum-value convention (Postgres enum values are frequently
`snake_case` by SQL naming convention). A small runtime `humanize(value:
string): string` (split on `_`/`-`, capitalize each word, join with a
space) gives correct default labels (`'multi_word_value'` ->
`'Multi Word Value'`) at the cost of needing a real (tiny) runtime
function instead of a pure type-level default. `.options([...])` remains
available to override any default that's still wrong for a given enum.

**(e) Data-bridge shape for RSC: route handler vs. server actions vs.
both.**
**Recommendation:** both, from day one, both generated from the same
underlying instance method (sketched as `tables.handler()` in Step 1
decision 4) so there is exactly one implementation of the fetch/mutate
logic regardless of which Next.js convention a given app prefers. Route
handlers suit apps that want a stable REST-ish endpoint (e.g. for
client-side `fetch` from a separate deployment); server actions suit
apps fully inside the Next.js App Router mutation model. Building only one
now and adding the other later risks the second one being bolted on
inconsistently once real usage patterns diverge; building both against one
shared core avoids that from the start. This is a sketch-level
recommendation only — the actual implementation is out of scope for this
design (per the source plan's Maintenance notes: "core `betterTables`
instance + `defineTable` runtime" is a named follow-up plan).

---

## Notes on verification gaps in this pass

Recorded here for the record, not folded into the recommendations above
(none of them change a recommendation, but a future reader should know
they exist):

- **The `packages/core` baseline currently fails `bun run typecheck`
  independent of this design's changes.** Two pre-existing issues, verified
  via an A/B diff (typecheck output byte-identical with and without the
  files this design adds): `packages/core/tests/builders/action-builder.test.ts`
  (13 occurrences of `error TS2445: Property 'config' is protected...`)
  and `packages/core/tests/types/column.test.ts:110` (`error TS2349: ...
  ExpectFunction<...> has no call signatures`). Both files are OUTSIDE this
  plan's in-scope file list and were not modified. Circumstantial evidence
  points at a TypeScript version drift (`package.json` pins
  `"typescript": "^5.8.3"`; the resolved/installed version in this worktree
  is `5.9.3`) making `expectTypeOf`'s call-signature typing and/or
  protected-member-access checking stricter than when these two files were
  last touched (`git log`: both last modified in commits from
  2025-12-22/23, well before the recent dependency-bump merge commits at
  the top of this repo's history). This is flagged, not fixed — fixing it
  would require touching files outside this plan's scope.
- **Prisma's relation-aware payload recipe is unverified.** Prisma is not
  an installed dependency anywhere in this repo, and this task had no
  network documentation tool available. Every Prisma-specific claim above
  is marked inline and should be treated as "best understanding, pending
  plan 008 verification against the actual Prisma client API" — not as
  verified fact the way the Drizzle recipe is.
