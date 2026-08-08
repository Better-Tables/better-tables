# Plan 064: `@better-tables/adapters-mssql` — SQL Server adapter (schema-introspection-driven)

> **Executor instructions**: Phased BUILD plan — each phase is a mergeable
> unit with its own verification; do not start a phase until the previous
> one's criteria pass. Run every verification command and confirm the
> expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report — do not improvise. When done (or when a
> phase lands), update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3faa4e1..HEAD -- packages/core/src/types/adapter.ts packages/adapters/toolkit/src packages/adapters/drizzle/src .github/workflows/test.yml tsconfig.json plans/061-prisma-adapter-full-parity.md`
> If any in-scope-by-reference file changed since this plan was written,
> compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: XL (new package, hand-written query layer, phased; expect
  many PRs — larger than the Prisma effort in 061 because there is no ORM
  underneath: Drizzle has no MSSQL dialect at all, so this plan builds a
  small T-SQL query/predicate layer from scratch, not just an emitter over
  an existing builder)
- **Risk**: MED (new package — nothing existing breaks unless the
  toolkit-extension option in Phase 3 is taken, which is additive and must
  be re-verified against Drizzle/Prisma)
- **Depends on**: none hard. If plan 061 Phase 1
  (`packages/adapters/conformance`) has landed by execution time, wire this
  adapter into it instead of hand-rolling parity tests (Phase 7). If not
  landed, this plan's own tests stand alone and a follow-up folds them into
  the shared suite later.
- **Category**: direction (new adapter package — first non-ORM-backed
  adapter)
- **Planned at**: commit `3faa4e1`, 2026-08-08 — originated from an
  architecture-evaluation request (can Better Tables become a
  metadata-driven MSSQL admin UI?); the reasoning is inlined in
  `plans/design/mssql-feasibility.md` if that file exists at execution
  time (create it if this plan is picked up standalone — see Maintenance
  notes).
- **Maintainer sign-off recommended** before starting Phase 0: this
  commits to a specific Node MSSQL driver (`mssql`, recommended below) and
  a CI service container running SQL Server, which is heavier than the
  existing SQLite-only default CI path.

## Why this matters

Better Tables' adapter contract (`TableAdapter` in
`packages/core/src/types/adapter.ts`) and its ORM-agnostic toolkit
(`@better-tables/adapters-toolkit`) were built to support more than
Drizzle — `packages/core/src/adapters/memory-adapter.ts` and
`http-adapter.ts` already prove the contract is satisfiable with zero DB
dependency, and plan 061 (Prisma) / 062 (Kysely) are the first two adapter
expansions using the toolkit's structural "ports". An MSSQL adapter is a
different kind of test of that design: unlike Prisma/Kysely, **Drizzle has
no MSSQL dialect at all** (confirmed: `drizzle-orm`'s dialect subfolders
are `pg-core`, `mysql-core`, `sqlite-core`, `singlestore-core`, `gel-core`
— no `mssql-core`), so this adapter cannot lean on an existing
ORM/query-builder for T-SQL generation the way the other two do. It proves
the toolkit's ports (`SchemaIntrospectionPort`, `RelationshipManagerPort`,
`PredicateEmitter`) are generic enough to sit on top of hand-written SQL,
not just another ORM's builder.

It also unlocks a real product story: **schema-driven admin/CRUD over any
existing SQL Server database**, using the "auto columns" pipeline
(`describeColumns` → `InferredColumnSpec[]` → `resolveTableColumns`,
already shipped in `packages/core/src/factory.ts:514-624` per plan 054) so
a consumer can point `<BetterTable>` at any table with zero hand-written
column definitions. This plan is the read/write/relationship substrate;
the UI-side pieces (table navigator, FK-click navigation, generic
record forms) are plan 065.

## Current state

Verified at `3faa4e1`. Nothing under `packages/adapters/mssql` exists yet
— this section documents the EXISTING seams the new package plugs into.

- **The adapter contract** — `packages/core/src/types/adapter.ts`. Required:
  `fetchData:442`, `getFilterOptions:464`, `getFacetedValues:481`,
  `getMinMaxValues:498`, `meta:636`. Optional: `getFacets:509`,
  `describeColumns:523`, `resolveCellWriteTarget:537`, `createRecord:551`,
  `updateRecord:561`, `deleteRecord:570`, `bulkUpdate:586`,
  `bulkDelete:599`, `exportData:615`, `subscribe:633`. Schema-introspection
  types: `InferredColumnSpec` (`:258-272` — `field`, `columnType`,
  `label`, `options?`, `nullable`, `primaryKey`, `foreignKey`, `writable`),
  `CellWriteTarget` (`:281-292`), `MutationOptions` (`:299-314` — `{
  table?, columnId? }`). `AdapterMeta`/`AdapterFeatures` (`:668-749`) is
  the capability-negotiation surface — declare only what's actually
  implemented (self-exclusion, facets top-N, filter groups, aggregates).
- **The toolkit** (`packages/adapters/toolkit/src/`) — genuinely
  ORM-agnostic (only a `devDependency` on `drizzle-orm` for its own
  benchmarks; runtime peer is `@better-tables/core` only):
  - `FilterRouter` + `PredicateEmitter<TColumn,TPredicate>` port
    (`filter-router.ts:65-97,184`) — operator classification/dispatch/
    validation, `computeDatePeriodRange` for relative dates. Implement
    `PredicateEmitter` for T-SQL leaves; the router does everything else
    (AND/OR tree walking, `includeNull` combination, per-type validation).
  - `DataTransformer<TTable>` (`data-transformer.ts:74-94`) — flat
    joined rows → nested objects. Takes a `RelationshipManagerPort` +
    `SchemaIntrospectionPort<TTable>`; genuinely generic over
    `Record<string, unknown>[]` rows (one caveat: a fallback path at
    `data-transformer.ts:1177-1192` reaches into `table._.columns`, a
    Drizzle-internal shape — irrelevant here since this adapter will
    always supply real `columnMetadata`, never hitting that fallback).
  - `PrimaryTableResolver<TTable>` (`primary-table-resolver.ts:66`) —
    duck-types "own, non-`_`-prefixed, object-valued property" as a
    column (`hasColumn`, module docs at `:17-21`). This assumes a table
    object exposes columns as **direct object properties** — design the
    MSSQL schema's in-memory table representation (Phase 1) as
    `{ [columnName]: ColumnMeta }` specifically so this resolver works
    unmodified; do not invent a `{ name, columns: [] }` shape.
  - `SchemaIntrospectionPort<TTable,TColumn>` (`types.ts:120-124`):
    `getColumnNames`/`getForeignKeyColumns`/`getPrimaryKeyColumns`.
  - `RelationshipManagerPort` (`types.ts:148-152`):
    `resolveColumnPath`/`getRelationshipByAlias`/`isArrayRelationship`.
  - `getPrimaryKeyInfo`/`getPrimaryKeyMap` (`utils/schema-introspection.ts:54,129`)
    — generic over any `SchemaIntrospectionPort`; **use this for mutation
    PK resolution** — do NOT copy the Drizzle adapter's mutation wart
    (`packages/adapters/drizzle/src/types/core.ts:104-106`,
    `TableWithId = AnyTableType & { id: AnyColumnType }`, hardcoding a
    column literally named `id` throughout
    `operations/returning-operations.ts` and `mysql-operations.ts`).
    This adapter should support any PK name (including composite) from
    day one via `getPrimaryKeyMap`.
  - `escapeSqlIdentifier`/`quoteIdentifier(identifier, quoteChar = '"')`
    (`utils/sql-utils.ts:35,70`) — assumes ONE character doubled on both
    sides (`"`/`` ` ``). **Does not fit MSSQL brackets** (`[name]` — an
    open/close PAIR, escaped by doubling `]` only). See Phase 3 for the
    two viable options.
  - `generateAlias`/`generatePathAlias`/`generatePathKey`
    (`utils/alias-generator.ts`), `calculateLevenshteinDistance`
    (`utils/levenshtein.ts:61`) — pure string utilities, reusable as-is.
- **Drizzle adapter as the reference implementation to mirror behavior
  (not code) against** — `packages/adapters/drizzle/src/`:
  relationship-path semantics (dotted ids, e.g. `'customer.company'`,
  depth cap 3) live in `relationship-manager.ts` /
  `relationship-detector.ts`; facet self-exclusion + top-100 cap (plans
  021/040) in `drizzle-adapter.ts`'s facet methods; two-phase fan-out
  pagination for one-to-many joins in
  `query-builders/base-query-builder.ts:105-207,880-983`; mutation
  RETURNING-vs-select-then-mutate split in `operations/`
  (`returning-operations.ts` for Postgres/SQLite, `mysql-operations.ts`
  for MySQL's no-RETURNING case — **MySQL's pattern is the one to mirror**
  for MSSQL if you don't want to lean on `OUTPUT` everywhere, though
  `OUTPUT INSERTED.*`/`OUTPUT DELETED.*` is directly available and usually
  preferable).
- **CI adapter test job** — `.github/workflows/test.yml`'s `test-adapters`
  job (`needs: build-core`, `defaults.run.working-directory:
  packages/adapters/drizzle`, a `mysql:8.0` `services:` container for the
  MySQL integration suite). A new `test-adapters-mssql` job (or an
  additional service block, if colocating) needs the same shape pointed
  at `packages/adapters/mssql`, with a
  `mcr.microsoft.com/mssql/server:2022-latest` service container (works on
  `ubuntu-latest`; needs `ACCEPT_EULA=Y` + `MSSQL_SA_PASSWORD` env, and a
  wait/health-check step since the container's SQL engine takes a few
  seconds after "started" to accept connections).
- **Root workspace/tsconfig wiring** — `package.json:6-11` workspaces glob
  already covers `packages/adapters/*` (no change needed there);
  `tsconfig.json:24-27` needs a new path entry
  `"@better-tables/adapters-mssql": ["./packages/adapters/mssql/src"]`
  (note the existing drizzle entry is under the OLD name
  `@better-tables/drizzle` — leave it, add the new one under the real
  package name, matching plan 061's note for Prisma).
- **Release mechanics — IMPORTANT, differs from what plan 061/035 say**:
  this repo migrated off changesets to **semantic-release** (commits
  `6ff577a`/`09a05c6`/`dbbfbb7`, merged in `b80778a`, before this plan was
  written). There is no `.changeset/` step anymore. Versioning is driven
  purely by Conventional Commit messages on `main`
  (`scripts/release/run.sh` runs `semantic-release` once per publishable
  package directory, monorepo-scoped via `semantic-release-monorepo`). A
  brand-new package's first commit that adds `packages/adapters/mssql/**`
  with real source should use `feat:` (or `feat(adapters-mssql):`) to
  trigger its first `0.1.0` publish once merged to `main` — do NOT create
  changeset files; see `CLAUDE.md`'s Releases section for the full model.
- **Type-mapping domain knowledge** (not sourced from this repo — from
  SQL Server's own catalog semantics, verify against a real instance in
  Phase 1): `bit`→boolean; `tinyint/smallint/int/bigint/decimal/numeric/
  float/real/money/smallmoney`→number; `char/varchar/nchar/nvarchar/text/
  ntext`→text; `date/datetime/datetime2/smalldatetime/datetimeoffset/time`
  →date; `uniqueidentifier`→text; `xml`→text (v1; JSON parity deferred,
  see Scope); no native array/JSON column type in MSSQL the way Postgres
  has — multiOption support must come from a modeled convention (e.g.
  comma-separated `varchar` or a junction table), not a native type;
  declare it unsupported in v1 rather than fake it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Local SQL Server (dev) | `docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<Strong!Passw0rd>" -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest` | container healthy after ~15s |
| Package tests | `cd packages/adapters/mssql && bun test` | all pass (skipped gracefully without `.env.local`, per the existing drizzle MySQL/Postgres convention in `CLAUDE.md`) |
| Typecheck | `bun run typecheck` (root) | exit 0 |
| Build | `bun run build --filter=@better-tables/adapters-mssql` | exit 0 |
| Conformance (if 061 landed) | `cd packages/adapters/conformance && bun test` | memory + drizzle + mssql green |

## Scope

**In scope**:
- `packages/adapters/mssql/**` (create everything)
- `packages/adapters/toolkit/src/utils/sql-utils.ts` — ONLY if Phase 3
  chooses the toolkit-extension option for bracket-pair identifier
  quoting (additive overload; re-verify drizzle unaffected)
- Root `tsconfig.json` (path mapping), `.github/workflows/test.yml` (new
  MSSQL service + test job)
- Docs: `apps/marketing/content/docs/adapters/mssql.mdx` (create) +
  `adapters/meta.json` + `adapters/index.mdx` card +
  `packages/adapters-mssql.mdx` + `packages/index.mdx` +
  `packages/meta.json` + `wiki.md`
- `CLAUDE.md` package map (add the new row once the package is real)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Core contract changes — if a toolkit port doesn't fit, adjust the
  TOOLKIT seam (with drizzle re-verified), never
  `packages/core/src/types/adapter.ts`.
- Native array/multiOption support, JSON column parity (`OPENJSON`/
  `JSON_VALUE`) — declare honestly via `AdapterMeta`, revisit later.
- Realtime/CDC-backed `subscribe` — implement only the local
  mutation-emission pattern the Drizzle adapter uses (parity, not new
  infra); MSSQL Change Tracking/CDC integration is a separate, much
  larger effort.
- Azure SQL Database–specific features (elastic pools, geo-replication
  awareness) — target on-prem/Azure SQL as a plain SQL Server endpoint,
  nothing edition-specific.
- UI changes of any kind (that's plan 065).
- Prisma/Kysely adapter files (061/062) — do not touch, even for
  reference; read-only comparison is fine.

## Git workflow

- Branch per phase off the current mainline (`mssql-adapter-phase-N`) or
  one branch with phase commits — operator's choice; commits
  `Plan 064 Phase N: …`. First phase that creates real package source
  should use a Conventional Commit type of `feat(adapters-mssql): …` (not
  `chore`/`docs`) once merged, per the semantic-release note above — this
  is what actually publishes `0.1.0`.

## Steps

### Phase 0: Package scaffold + local dev/test rig

Mirror `packages/adapters/drizzle/package.json` (name
`@better-tables/adapters-mssql`, tsdown build, exports map,
`publishConfig.access: public`, `sideEffects: false`); peer deps:
`@better-tables/core: workspace:*`, `mssql` (the Microsoft/tediousjs
promise-based driver — recommended over raw `tedious` for its built-in
connection pooling and parameterized `Request.input()` API) with a tested
version range; dependency on `@better-tables/adapters-toolkit:
workspace:*`. `tests/.env.example` (mirroring
`packages/adapters/drizzle/.env.example`) documenting `MSSQL_HOST`/
`MSSQL_PORT`/`MSSQL_USER`/`MSSQL_PASSWORD`/`MSSQL_DATABASE`; tests skip
cleanly when `.env.local` is absent (same convention `CLAUDE.md`
documents for the Drizzle MySQL/Postgres suites). Update
`CLAUDE.md`'s "Test locations" table with the new skip-without-env row
once tests exist.

**Verify**: `cd packages/adapters/mssql && bun install && bun run
typecheck` → exit 0 (empty package compiles).

### Phase 1: Schema introspection (`SchemaIntrospectionPort` + `describeColumns`)

Write `MssqlSchemaClient`: on construction (or first use), query SQL
Server's catalog views once and cache the result (with a
`refreshSchema()` escape hatch for long-lived processes — unlike Drizzle's
adapter, which re-reads a static JS object every time, this is a genuine
live-DB read, so document the caching/staleness tradeoff explicitly):

- Tables/columns: `sys.tables` joined to `sys.columns` and `sys.types`
  (or `INFORMATION_SCHEMA.COLUMNS` — prefer `sys.*` for identity/computed
  flags `INFORMATION_SCHEMA` doesn't expose).
- Nullability: `sys.columns.is_nullable`.
- Identity/autoincrement: `sys.identity_columns` (mark non-writable on
  insert, matching how Drizzle treats serial/autoincrement columns).
- Computed columns: `sys.computed_columns` (mark `writable: false`
  unconditionally — matches `InferredColumnSpec.writable` semantics).
- Primary keys: `sys.key_constraints` (`type = 'PK'`) joined to
  `sys.index_columns`/`sys.columns`.
- Default values: `sys.default_constraints` (informational; not currently
  part of `InferredColumnSpec`, but useful for the Phase 4/065 create-form
  work — store it internally even if unused yet).
- Build the in-memory table representation as `{ [schemaKey]:
  { [columnName]: ColumnMeta } }` — a plain object of plain objects,
  specifically so `PrimaryTableResolver`'s `hasColumn` duck-type (Current
  state) works unmodified.
- Implement `describeColumns(table?)` → `InferredColumnSpec[]` using the
  type-mapping table from Current state; implement the
  `SchemaIntrospectionPort` methods (`getColumnNames`/
  `getForeignKeyColumns`/`getPrimaryKeyColumns`) against the same cached
  structure, and pass them into `getPrimaryKeyMap` for mutation PK
  resolution (Phase 5).

**Verify**: adapter-local test against the Docker container: seed 2-3
tables with a PK, an identity column, a computed column, and a nullable
column; assert `describeColumns()` reports each flag correctly.

### Phase 2: Relationship discovery (`RelationshipManagerPort`)

Query `sys.foreign_keys` + `sys.foreign_key_columns` (joined back to
`sys.tables`/`sys.columns` for names) to build a `RelationshipMap`
(toolkit's `RelationshipPath` shape: `from`/`to`/`foreignKey`/`localKey`/
`cardinality`/`nullable?`/`joinType?`). Implement `MssqlRelationshipManager`
satisfying `RelationshipManagerPort` (`resolveColumnPath`/
`getRelationshipByAlias`/`isArrayRelationship` — the last always returns
`false` here, since MSSQL has no array-FK concept; this is an honest,
permanent difference from the Postgres-only Drizzle feature, not a gap to
fill later). Mirror Drizzle's dotted-path semantics (depth cap 3,
one-to-many paths flagged non-single) so column ids like
`'customer.company'` behave identically across adapters — this is a
BEHAVIORAL contract (`packages/core/src/types/paths.ts`'s header notes it
mirrors `relationship-manager.ts#resolveColumnPath`'s runtime semantics),
not a code-sharing one.

**Verify**: seed two FK-linked tables (one-to-many); assert
`resolveColumnPath('customer.company', 'orders')` resolves to the right
table/field, and a reverse relationship is discoverable too (mirroring
Drizzle's auto-generated reverse entries,
`relationship-detector.ts:785-789` — same UX, independent implementation).

### Phase 3: Read path — query/predicate layer + `fetchData`

This is the phase with no ORM to lean on. Build a small internal SQL
fragment assembler (NOT a general query builder — just enough for this
adapter's own needs) that composes parameterized T-SQL via the `mssql`
package's `Request.input(name, type, value)` API (named parameters,
`@p0`, `@p1`, ...; never string-interpolate values).

- **Identifier quoting decision** (resolve before writing SQL strings):
  Option A — extend toolkit's `quoteIdentifier` with an additive overload
  accepting `{ open: string; close: string }` alongside the existing
  single-char signature (backward compatible; re-verify drizzle's
  existing calls are unaffected since they keep using the single-char
  form). Option B — implement a local `quoteMssqlIdentifier(name) =>
  \`[${name.replace(/]/g, ']]')}]\`` inside this package, touching nothing
  shared. **Recommended: Option B first** (lowest blast radius; only one
  consumer needs bracket-pair quoting today) — revisit Option A only if a
  second adapter needs the same shape later.
- Implement `MssqlPredicateEmitter` against the toolkit's
  `PredicateEmitter<TColumn,TPredicate>` port: the full operator registry
  from `packages/core/src/types/filter-operators.ts` (text/number/date/
  boolean/option/multiOption-as-unsupported/json-as-unsupported/
  isNull/isNotNull), composed with `FilterRouter` for
  classification/tree-walking (mirror `packages/adapters/drizzle/src/
  filter-handler.ts`'s "thin composition of two halves" shape).
- SELECT/JOIN assembly: `PrimaryTableResolver` for implicit primary-table
  detection; manual `LEFT JOIN`/`INNER JOIN` construction from resolved
  relationship paths (mirror `base-query-builder.ts:316-338`'s shape, not
  its Drizzle-builder calls) using `generateAlias`/`generatePathAlias`.
  `DataTransformer` for flat-row → nested-object re-assembly (works
  unmodified — genuinely ORM-agnostic per toolkit research).
- Sorting: plain `ORDER BY [col] ASC|DESC` per resolved column.
- Pagination: `ORDER BY ... OFFSET @skip ROWS FETCH NEXT @take ROWS
  ONLY`. **T-SQL requires an `ORDER BY` for `OFFSET`/`FETCH`** — when the
  caller supplies no sort, default to `ORDER BY` the primary key
  ascending (this is both a T-SQL syntax requirement AND good hygiene —
  matches the deterministic-tiebreaker principle the Drizzle adapter
  already applies for fan-out pagination). `total` via a separate
  `COUNT(DISTINCT <pk>)` query under joins (mirror the plan-003
  join-inflation guard at `base-query-builder.ts:465-489`) or plain
  `COUNT(*)` with no joins.
- Fan-out pagination for one-to-many joins (Drizzle's two-phase
  "distinct-PKs-page, then re-fetch full rows" algorithm,
  `base-query-builder.ts:105-207,880-983`): mirror the ALGORITHM, not the
  Drizzle-builder calls — this is pure relational SQL (`GROUP BY` +
  aggregate `ORDER BY` tiebreakers + `WHERE pk IN (...)`) and transfers
  directly.
- Assemble `FetchDataResult` (`data`/`total`/`pagination`/`meta`).

**Verify**: adapter-local tests mirroring the Drizzle SQLite suite's
shape (`packages/adapters/drizzle/tests/`): pagination math (`total`/
`totalPages`/`hasNext`/`hasPrev`), every implemented operator family,
flat AND + nested `FilterGroupNode` trees, dotted-path filter/sort,
`columns` selection, cross-1-N `total` correctness (plan-003 class),
case-insensitive text matching (SQL Server's default collation is
case-insensitive for `varchar`/`nvarchar` comparisons — verify this
against a real instance rather than assuming, and document the
collation dependency).

### Phase 4: Facets trio + `getFacets`

`getFilterOptions`/`getFacetedValues`/`getMinMaxValues`, matching plans
021 (filter-aware self-exclusion — mandatory per
`packages/core/src/types/adapter.ts:172-183`'s doc contract) and 040
(top-100 default cap, `FacetQueryParams.limit`) EXACTLY — these are
observable-behavior contracts other adapters already satisfy; any
deviation is a bug, not a design choice. Implement `getFacets` for
batched reads (optional — Core falls back to the singular methods if
omitted, per `adapter.ts:500-509`, but batching saves round-trips and is
cheap to add here since the per-column logic already exists).

**Verify**: self-exclusion test (facet on a filtered column ignores its
own filter leaf); cap test (101+ distinct values → 100 returned, ordered
by count desc); `limit: null` disables the cap.

### Phase 5: Mutations + `resolveCellWriteTarget`

`createRecord`/`updateRecord`/`deleteRecord` via `OUTPUT INSERTED.*` /
`OUTPUT DELETED.*` (direct T-SQL equivalent of Postgres/SQLite's
`RETURNING`, same shape as `operations/returning-operations.ts`); resolve
the target row generically via `getPrimaryKeyMap` (Current state) — **do
not** hardcode a column named `id`. `bulkUpdate`/`bulkDelete` (loop or a
single parameterized `WHERE pk IN (...)` statement — prefer the latter
for delete/update-with-same-values, fall back to per-row for
per-row-different-values updates). `resolveCellWriteTarget` using the
Phase 2 relationship map (own-table flat columns vs. related-table dotted
paths, `single: false` for one-to-many — never cell-editable, matching
plan 055's rule). `AdapterMeta.features.create/update/delete/
bulkOperations` gated on whether a mutation table/PK can actually be
resolved (mirror `drizzle-adapter.ts:1262-1269`'s `canResolveMutationTable`
pattern).

**Verify**: create → read-back round trip; update by non-`id`-named PK
(e.g. seed a table whose PK column is literally called `customer_no`) —
this is the concrete regression test proving the "no hardcoded `id`"
requirement; delete; bulk variants; `resolveCellWriteTarget` for both an
own-table column and a dotted relationship-path column.

### Phase 6: Export + local mutation events + capability honesty

`exportData` (CSV/JSON — reuse the Drizzle adapter's
`export-format.ts` shape/behavior, including formula-escaping; lift it
into the toolkit first if plan 061 Phase 6 already did so, otherwise
duplicate the small (3-export) module rather than importing across
adapter packages). `subscribe` as LOCAL mutation-emission only (emit a
`DataEvent` on each of the five mutation call sites, matching Drizzle's
parity pattern — no MSSQL Change Tracking/CDC integration, per Scope).
Finalize `AdapterMeta`: `supportedColumnTypes` excludes `multiOption`
and `json` (Scope — declare honestly, don't fake), `supportedOperators`
per implemented type only, `supportsFilterGroups: true` with
`maxGroupDepth: 3`, no `capabilities.aggregates` (derived/plan-060
aggregates are out of scope for v1 — file as a follow-up if wanted).

**Verify**: export round trip (CSV shape, header row, formula-escaping
on a value starting with `=`); subscribe fires exactly once per mutation
call with the correct event shape; a meta-honesty check (mirroring plan
061's) asserts `supportedColumnTypes`/`supportedOperators` match what
Phase 3/4 actually implemented — no over-declaring.

### Phase 7: CI, docs, publish surface, ledger

CI: new `test-adapters-mssql` job (or an added service block on the
existing `test-adapters` job if colocating,
`.github/workflows/test.yml`) with the `mcr.microsoft.com/mssql/server`
service container + a startup health-check step (the container reports
"started" before the engine accepts connections — add a retry loop, e.g.
`until sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q "SELECT 1"; do sleep 2; done`
capped at a reasonable timeout). Package README (model on
`packages/adapters/drizzle/README.md`); docs pages per Scope; `CLAUDE.md`
package map row (mark **published to npm**, matching the other adapter
packages — do this only once real, tested source exists, not before);
`plans/README.md` status row. First real-source commit uses
`feat(adapters-mssql): …` (see Git workflow) so the `packages/adapters/
mssql` release actually fires on merge to `main`.

**Verify**: `bun run build` + root `bun run typecheck` green; the CI job
runs green on a pushed branch (confirms the service container works in
GH Actions, not just locally); docs links resolve (`grep -rn
"adapters/mssql" apps/marketing/content/docs/ | wc -l` ≥ 3).

## Test plan

- Structural pattern: `packages/adapters/drizzle/tests/` SQLite suites
  (no external service) plus its MySQL/Postgres `.env.local`-gated
  integration suites (this adapter's tests are ALWAYS `.env.local`-gated
  — there is no in-process MSSQL equivalent to SQLite for a zero-setup
  suite).
- If plan 061 Phase 1 has landed, run this adapter through
  `packages/adapters/conformance` instead of/in addition to hand-rolled
  tests — that suite encodes the same observed-Drizzle-behavior spec this
  plan's Phases 3-6 verification steps describe manually.
- The Phase 5 "non-`id`-named PK" test is the one regression test this
  plan cares about MOST — it's the concrete proof this adapter doesn't
  inherit Drizzle's known mutation wart.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/adapters/mssql` package builds, typechecks, and its tests
  pass against a real SQL Server instance (local Docker or CI service)
- [ ] `describeColumns` reports PK/FK/identity/computed/nullable/writable
  correctly for a seeded schema exercising all five
- [ ] Mutations work against a table whose PK is NOT named `id`
  (Phase 5's regression test)
- [ ] Facet self-exclusion + top-100 cap match Drizzle's observed
  behavior exactly (same semantics, independently verified, not copied
  blind)
- [ ] `AdapterMeta` declares only implemented capabilities — no
  `multiOption`/`json`/aggregates claimed
- [ ] CI job with the SQL Server service container passes on a pushed
  branch
- [ ] Docs pages exist and are linked; `CLAUDE.md` package map updated
- [ ] `plans/README.md` status row updated
- [ ] No changeset files created (semantic-release only); first
  real-source commit uses a `feat(adapters-mssql):` Conventional Commit

## STOP conditions

Stop and report back (do not improvise) if:

- The `mssql` npm package's parameterized-query API can't express a
  needed predicate shape safely (never fall back to string
  interpolation to work around it — report the gap instead).
- SQL Server's default collation on the test instance turns out to be
  case-SENSITIVE, breaking the "matches Drizzle's case-insensitive text
  ops" assumption in Phase 3 — this changes the emitter design (would
  need explicit `COLLATE` clauses); report the finding before continuing.
- A toolkit port cannot express an MSSQL need without modification —
  propose the minimal seam change (Phase 3's identifier-quoting decision
  is the known candidate), get it reviewed, land it with drizzle
  re-verified BEFORE continuing. Do not fork a private copy of a toolkit
  file.
- The GitHub Actions SQL Server service container is unworkable (startup
  time, licensing, or runner resource limits) — report before spending
  further effort on CI; a self-hosted-runner or "integration tests are
  local-only, CI skips" fallback (matching how Postgres/MySQL Drizzle
  integration tests already degrade) is an acceptable outcome to propose.
- You find yourself wanting to fake `multiOption`/native-array support
  via a hidden convention (e.g. silently treating a `varchar` as
  comma-separated) — declare the capability gap instead; silent semantic
  invention is worse than an honest "unsupported."

## Maintenance notes

- If this plan is picked up as a standalone effort (not immediately
  following the architecture-evaluation conversation that produced it),
  write a short `plans/design/mssql-feasibility.md` capturing the
  Current-state research above before starting Phase 0 — the "why this
  is safe to build without touching Core" reasoning is load-bearing for
  reviewers who weren't in that conversation.
- The identifier-quoting decision (Phase 3) is the one place this plan
  might touch shared toolkit code. If a THIRD adapter later needs
  bracket-pair-style quoting, revisit Option A (toolkit extension)
  instead of letting each adapter reimplement it.
- `multiOption`/JSON parity and derived aggregates are known, intentional
  v1 gaps — track them in `plans/README.md`'s deferred section rather
  than silently forgetting them.
- Plan 065 (metadata-driven admin UI) consumes this adapter's
  `describeColumns`/`resolveCellWriteTarget`/mutation surface directly —
  coordinate before changing this adapter's `InferredColumnSpec` mapping
  choices once 065 is underway.
