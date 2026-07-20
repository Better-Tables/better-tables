# Plan 062: Kysely adapter — the SQL-native second adapter on the conformance suite

> **Executor instructions**: BUILD plan. Requires plan 061's Phase 1
> (conformance suite) and Phase 6 (toolkit export-format lift) to have
> landed — verify via the drift check before starting. Run every
> verification command and confirm the expected result before moving on.
> If anything in the "STOP conditions" section occurs, stop and report —
> do not improvise. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- packages/adapters plans/061-prisma-adapter-full-parity.md`
> Confirm `packages/adapters/conformance/` exists and the toolkit exports
> the lifted export-format util. If either is missing, STOP — execute 061
> Phases 1+6 first (or report to the maintainer to reorder).

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (new package; the novel surface is runtime schema introspection and a required relationships config)
- **Depends on**: 061 Phases 1 + 6 (conformance suite; shared export-format). Aggregates phase gated on plan 060 like 061's Phase 7 — but note Kysely reaches FULL aggregate parity (render+sort+filter), unlike Prisma.
- **Category**: direction
- **Planned at**: commit `27c59b9`, 2026-07-20
- **Maintainer decision (2026-07-20)**: build a Kysely adapter as the next
  adapter after Prisma.

## Why this matters

Kysely is the type-safe SQL builder the "I don't want an ORM" segment
standardized on, and it is the most toolkit-native adapter possible: it
speaks SQL expressions directly, so `FilterRouter`/`PredicateEmitter`,
alias generation, and `DataTransformer` (flat JOINed rows → nested
objects) are exercised exactly as the Drizzle adapter exercises them —
where Prisma (plan 061) bypasses the transformer/alias machinery entirely.
Between the three, the toolkit's claim of ORM-agnosticism is finally
tested from both directions: object-query ORMs (Prisma) and SQL builders
(Kysely). Kysely also has no schema/relations runtime metadata of its own,
which forces this plan to prove the adapter story for "bring your own
relationship map" — the same shape future raw-SQL adapters need.

## Current state

Verified at `27c59b9` (plus the 061 prerequisites the drift check
confirms):

- **What Kysely gives you** (verify against current docs via Context7 —
  do not trust memorized API):
  - Query building: `db.selectFrom('users').leftJoin(…).where(eb => …)`
    with an expression builder — a direct fit for a `PredicateEmitter`
    that returns Kysely expression fragments.
  - Runtime introspection: `db.introspection.getTables()`
    (`DatabaseIntrospector`) → per-table `TableMetadata` with columns
    (name, dataType, isNullable, hasDefaultValue) — the raw material for
    `describeColumns`. Data-type strings are DIALECT-SPECIFIC → a mapping
    table per dialect (start: sqlite + postgres + mysql keyword maps).
  - NO relations concept — relationship paths (`profile.location`) require
    a user-supplied relationship map.
- **The toolkit pieces this adapter composes** (all landed;
  `packages/adapters/toolkit/src/index.ts`): `FilterRouter` +
  `PredicateEmitter` + `computeDatePeriodRange`; `DataTransformer` (flat →
  nested; the Kysely read path USES it, selecting joined columns under
  path aliases exactly like Drizzle); `PrimaryTableResolver` +
  `RelationshipMapLike`; `generateAlias`/`generatePathAlias`/
  `generatePathKey`; `getPrimaryKeyInfo`/`getPrimaryKeyMap`;
  `escapeSqlIdentifier`/`quoteIdentifier`; `SchemaError` +
  `calculateLevenshteinDistance`.
- **The relationships config precedent**: the Drizzle factory already
  accepts a manual `relationships` map keyed by dotted path with
  `{ from, to, foreignKey, localKey, cardinality, isArray?, nullable?, joinType? }`
  (`packages/adapters/drizzle/src/factory.ts:48,165-167`; field semantics
  per `RelationshipPath` in `packages/adapters/toolkit/src/types.ts:16-40`;
  worked examples in
  `packages/adapters/drizzle/docs/ADVANCED_USAGE.md` MySQL/SQLite
  sections). The Kysely factory REQUIRES this map for any relationship
  feature (there is nothing to auto-detect from); own-table usage works
  with zero config.
- **The parity instrument**: `packages/adapters/conformance` (created by
  061 Phase 1) — memory, drizzle, prisma run it; Kysely joins them. The
  suite is capability-parameterized; Kysely should declare near-full
  capabilities (see phases).
- **Conventions**: package scaffold mirrors
  `packages/adapters/drizzle/package.json` (name
  `@better-tables/adapters-kysely`, tsdown, exports map, publishConfig
  public; peers: `@better-tables/core: workspace:*` + `kysely` with a
  tested range; test devDep `better-sqlite3` — already in the workspace
  catalog). Root `tsconfig.json:24-27` gains
  `"@better-tables/adapters-kysely": ["./packages/adapters/kysely/src"]`.
  CI: the `test-adapters` job (`.github/workflows/test.yml:321-322`) picks
  the package up by path — no generate step needed (unlike Prisma).
  Docs live under `apps/marketing/content/docs/adapters/` +
  `packages/` matrix; changesets per package.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Package tests | `cd packages/adapters/kysely && bun test` | all pass (SQLite in-memory via better-sqlite3 dialect) |
| Conformance | `cd packages/adapters/conformance && bun test` | all adapters green |
| Typecheck | `bun run typecheck` | exit 0 |
| Build | `bun run build` | exit 0 |

## Scope

**In scope**:
- `packages/adapters/kysely/**` (create everything: src, tests, README)
- `packages/adapters/conformance/**` — ONLY wiring the Kysely factory into
  the existing suite
- Root `tsconfig.json` (path mapping)
- Docs: `apps/marketing/content/docs/adapters/kysely.mdx` (create) +
  `adapters/meta.json` + `adapters/index.mdx` card +
  `packages/adapters-kysely.mdx` + `packages/index.mdx` +
  `packages/meta.json` + `wiki.md` + `CLAUDE.md` package map
- `.changeset/*.md`; `plans/README.md`

**Out of scope** (do NOT touch):
- `packages/core/**`, `packages/adapters/toolkit/**` (if a port doesn't
  fit, STOP — after Prisma, a third misfit means the seam needs a
  deliberate redesign, not another local workaround)
- `packages/adapters/drizzle/**`, `packages/adapters/prisma/**`
- FK auto-detection from `information_schema` — v1 is explicit
  relationships config only; record auto-detection as a follow-up
- Dialect-specific drivers beyond the sqlite test rig (pg/mysql type maps
  ship as code, but integration tests against live pg/mysql follow the
  drizzle pattern: env-gated suites, added only if cheap)

## Git workflow

- Branch: `kysely-adapter`; commits `Plan 062 Step N: …`.

## Steps

### Step 1: Scaffold + `KyselyPredicateEmitter`

Package scaffold per Current state. Test rig: `kysely` +
`better-sqlite3` dialect over an in-memory DB, canonical
users/profile/posts schema + deterministic seed (mirror the conformance
fixtures). Implement the emitter returning Kysely expression fragments for
the FULL operator registry (`packages/core/src/types/filter-operators.ts`),
including relative date operators via `computeDatePeriodRange` and
LOWER()-based case-insensitive text ops (assert parity with Drizzle's
semantics — the conformance suite checks it).

**Verify**: emitter unit tests per operator family pass;
`bun run typecheck` exit 0.

### Step 2: Read path — `fetchData` with JOINs and the transformer

Compose exactly like the Drizzle reference: resolve primary table
(`PrimaryTableResolver` + `options.defaultPrimaryTable` parity); for
dotted paths, LEFT JOIN via the relationships config using
`generatePathAlias` aliases; select joined columns under path keys; route
filters (`FilterRouter`, flat + `FilterGroupNode` recursion into
`eb.and/eb.or`); multi-sort incl. joined columns; paginate
(`limit/offset`, 1-based math); `total` via a parallel count query that
counts DISTINCT primary rows (the plan-003 join-inflation class — the
conformance suite asserts it); re-nest rows with `DataTransformer`.

**Verify**: Kysely wired into the conformance suite with
`{ read: true }` — fetch/tree/dotted-path/total blocks green.

### Step 3: Facets trio

`getFilterOptions` (SELECT DISTINCT), `getFacetedValues`
(GROUP BY + count, self-exclusion of the target column's own filter,
top-100 cap), `getMinMaxValues` (MIN/MAX) — plans 021/040 semantics.

**Verify**: conformance facet blocks green.

### Step 4: `describeColumns` via runtime introspection

`db.introspection.getTables()` on first call, cached; map dialect
`dataType` strings → `ColumnType` via per-dialect keyword tables (sqlite,
postgres, mysql; unknown types → `custom` with a dev note); nullability
from metadata; `writable` = not-PK (PK detection via `getPrimaryKeyInfo`
against the relationships/PK config, falling back to `id` convention);
enum options: postgres enums surface through introspection metadata where
available — map when present, otherwise omit (facet fallback covers
dropdowns). Declare the capability honestly.

**Verify**: conformance schema block green on sqlite; unit tests for the
pg/mysql type maps (pure functions, no live DB).

### Step 5: Typed factory + writes + events + export

- `kyselyAdapter(db, options)` — `TDatabase` inference from
  `Kysely<TDatabase>` gives typed table/column names; `options` requires
  `relationships` for any dotted-path use (clear `SchemaError` naming the
  missing path otherwise) and accepts `defaultPrimaryTable`.
  Attempt the `$types` catalog so `defineTable<typeof tables>()` path
  builders autocomplete own-table columns from `TDatabase` (relation paths
  type against the relationships config keys); record blocker if the
  type-level story falls short — same evidence rule as 061 Phase 5.
- Writes: insert/update/delete + bulk via Kysely builders; PK targeting via
  `getPrimaryKeyMap`; `resolveCellWriteTarget` from the relationships
  config (single-cardinality only); local `subscribe` emission on all
  mutation sites (drizzle parity).
- `exportData` reusing the toolkit-lifted export-format.

**Verify**: conformance write/export/event blocks green; compile-only
factory test (zero manual generics beyond `Kysely<DB>`'s own).

### Step 6 (gated on plan 060): Derived aggregates — full parity

Lower `DerivedColumnSpec` to correlated subqueries with the expression
builder (`(SELECT count(*) FROM posts WHERE posts.user_id = users.id)`)
for SELECT, WHERE (filter!), and ORDER BY — Kysely supports all three, so
declare FULL aggregate capability (contrast with Prisma's sort-only; if
060 adopted per-op capability granularity, declare all true).

**Verify**: conformance aggregate blocks fully green (no skips).

### Step 7: Docs + CI sanity + changesets + ledger

Docs pages per Scope — `adapters/kysely.mdx` modeled on
`adapters/drizzle.mdx`, with a prominent "Relationships are explicit
config" section reusing the `RelationshipPath` field semantics and one
worked map example; packages matrix + wiki + CLAUDE.md rows; changeset
(`@better-tables/adapters-kysely` minor — first release); push branch and
confirm the `test-adapters` CI job runs the new package; update
`plans/README.md`.

**Verify**: `bun run build` + root typecheck green; docs link greps
resolve (`grep -rn "adapters/kysely" apps/marketing/content/docs/ | wc -l` ≥ 3).

## Test plan

- The conformance suite is the spine (identical spec across memory /
  drizzle / prisma / kysely).
- Kysely-only: emitter units; dialect type-map units; relationships-config
  error paths (missing path → SchemaError with suggestion); introspection
  caching; aggregate subquery SQL snapshots.
- Patterns: `packages/adapters/drizzle/tests/` sqlite suites and the
  conformance fixtures from 061.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Kysely runs the conformance suite green with near-full declared capabilities (any skip is an honestly-declared, ledger-recorded gap)
- [ ] Dotted-path filter/sort/facets work through the explicit relationships config; missing-config errors are actionable
- [ ] `describeColumns` works from runtime introspection on sqlite; pg/mysql type maps unit-tested
- [ ] Writes + `resolveCellWriteTarget` + events + export green
- [ ] (If 060 landed) aggregates render/filter/sort all green — no capability skips
- [ ] `bun run build` + `bun run typecheck` + all suites green; CI adapter job includes the package
- [ ] Docs pages exist and are linked; changeset exists; `plans/README.md` updated

## STOP conditions

Stop and report back (do not improvise) if:

- A toolkit port cannot express a Kysely need — after Drizzle and Prisma,
  a third-consumer misfit means the seam needs deliberate redesign; report
  the exact mismatch, do not fork or locally reimplement.
- `db.introspection` cannot provide enough for `describeColumns` on
  sqlite (the test dialect) — report what's available; do not silently
  drop the capability.
- The typed factory needs hidden `any` — explicit-generic escape hatch +
  flag, never hidden `any`.
- Conformance reveals a semantic mismatch you'd need to change the SUITE
  to pass — the suite is the spec; report instead of loosening it.

## Maintenance notes

- FK auto-detection (postgres `information_schema` → relationships map
  seeding) is the natural DX follow-up; the explicit-config contract stays
  the source of truth either way.
- A future raw-`sql`/`postgres.js` adapter should start from this package,
  not from Drizzle — Kysely is the closest structural template for
  SQL-native adapters.
- Reviewer scrutiny: identifier handling in JOIN/alias construction (must
  flow through the toolkit quoting utils), count-query distinctness, and
  that `supportedOperators`/capabilities match implementation exactly.
