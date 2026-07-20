# Plan 061: Prisma adapter at full Drizzle parity (supersedes 008)

> **Executor instructions**: Phased BUILD plan — each phase is a mergeable
> unit with its own verification; do not start a phase until the previous
> one's criteria pass. Run every verification command and confirm the
> expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report — do not improvise. When done (or when a
> phase lands), update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c59b9..HEAD -- packages/adapters packages/core/src/types/adapter.ts .github/workflows/test.yml tsconfig.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (phased; expect multiple PRs)
- **Risk**: MED (new package — nothing existing breaks; risk is semantic drift between adapters, mitigated by the conformance suite in Phase 1)
- **Depends on**: none hard. 057/058 (contract cleanup/search) land first if scheduled — they SHRINK what this plan must implement. The aggregates phase (Phase 7) requires plan 060's spec types; skip it cleanly if 060 hasn't landed.
- **Category**: direction
- **Planned at**: commit `27c59b9`, 2026-07-20
- **Supersedes**: plan 008 (read-path spike, ON HOLD since 2026-07-13, never executed). Its still-valid research is inlined below; 008 is retired in the ledger.
- **Maintainer decision (2026-07-20)**: the Prisma plan must be the COMPLETE
  adapter replacement for Drizzle — full contract parity, not a spike. This
  replaces the 2026-07-13 PRISMA HOLD as the standing directive; execution
  order still belongs to the maintainer via the ledger.

## Why this matters

Prisma is the largest-audience ORM in the TypeScript ecosystem and the
named first expansion target. Today `@better-tables/adapters-drizzle` is
the only database adapter, so "bring your own ORM" is marketing, not fact.
A full-parity Prisma adapter (a) opens the biggest user funnel, (b) is the
honest test of the toolkit extracted in plan 007 — its ports were shaped
against one consumer — and (c) forces a reusable **adapter conformance
suite** into existence, which every future adapter (Kysely — plan 062,
memory, Prisma) then shares. "Parity" means: everything the Drizzle
adapter actually implements, with identical observable semantics, or an
honestly-declared capability gap in `AdapterMeta`.

## Current state

Verified at `27c59b9`:

- **The parity bar** — what the Drizzle adapter really implements today:
  - `fetchData`: flat + `FilterGroupNode` tree filters, multi-sort,
    1-based pagination, dotted relation paths with JOINs, `columns`
    selection, `primaryTable`/`options.defaultPrimaryTable` resolution,
    computed-fields pipeline (`drizzle-adapter.ts:165,238-241,451-460`),
    LRU caching (`adapter-cache.ts`).
  - Facets: `getFilterOptions`, `getFacetedValues` (filter-aware with
    self-exclusion — plan 021; top-100 LIMIT — plan 040),
    `getMinMaxValues`.
  - Schema: `describeColumns` (plan 054) — name/type/nullability/enum
    options/writability (`InferredColumnSpec[]`).
  - Writes: `createRecord`/`updateRecord`/`deleteRecord` (plan 047),
    `bulkUpdate`/`bulkDelete`, `resolveCellWriteTarget` for dotted-path
    cell edits incl. related-row writes (plan 055).
  - Events: `subscribe` with insert/update/delete emission on mutations
    (`drizzle-adapter.ts:1337`, emits at `:1161/:1196/:1227/:1259/:1290`).
  - Export: `exportData` (`drizzle-adapter.ts:1304`) with CSV
    formula-escaping via `packages/adapters/drizzle/src/export-format.ts`
    (small: 3 exports — liftable).
  - `meta`: `features` flags, `supportedColumnTypes`,
    `supportedOperators`, `supportsFilterGroups: true`.
- **The contract**: `TableAdapter` in `packages/core/src/types/adapter.ts`
  (required: `fetchData:227`, `getFilterOptions:241`,
  `getFacetedValues:255`, `getMinMaxValues:269`, `meta:380`; optional:
  `describeColumns:445`, `exportData:537`, `subscribe:555`, mutations,
  `resolveCellWriteTarget`). Note plan 057 may remove dead fields and plan
  058 removes `FetchDataParams.search` — implement against whatever the
  contract is at execution time (drift check will tell you).
- **Toolkit** (`packages/adapters/toolkit/src/index.ts`): `FilterRouter` +
  `PredicateEmitter` (+ `computeDatePeriodRange`, `FilterRouterError`),
  `DataTransformer`, `PrimaryTableResolver`, `SchemaIntrospectionPort` /
  `RelationshipManagerPort`, alias + PK + SQL-identifier utils,
  `calculateLevenshteinDistance`, `SchemaError`. The Drizzle adapter is
  the reference composition; `memoryAdapter`
  (`packages/core/src/adapters/memory-adapter.ts`) is a second, simpler
  contract consumer.
- **Structural difference to design around** (from 008's research, still
  valid): Drizzle builds SQL (joins + aliases, flat rows re-nested by
  `DataTransformer`); Prisma builds a **query object**
  (`where`/`orderBy`/`skip`/`take`/`include`/`select`) and returns
  already-nested objects. Expect: a `PrismaPredicateEmitter` emitting
  Prisma `where` fragments (text ops with `mode: 'insensitive'` where the
  provider supports it — SQLite's `contains` is already case-insensitive
  and REJECTS `mode`; normalize in the emitter); dotted paths become
  nested objects (`'profile.location'` → `where: { profile: { location: … } }`,
  `include: { profile: true }`, `orderBy: { profile: { location: 'asc' } }`);
  NO alias-generator / NO `DataTransformer` on the read path. `total` via
  `count({ where })` — Prisma counts parents naturally, so the plan-003
  join-inflation bug class doesn't apply (assert it anyway in tests).
  Case-insensitivity parity with Drizzle's text ops must be ASSERTED, not
  assumed. Use Context7/Prisma docs for current API syntax — do not rely
  on memorized shapes.
- **Schema introspection**: Prisma exposes runtime DMMF
  (`Prisma.dmmf.datamodel` — models, fields, types, relations, enums) —
  the raw material for `describeColumns`, relation resolution, and
  `resolveCellWriteTarget`, replacing Drizzle's schema-object walking.
- **Repo mechanics**:
  - Package scaffold: mirror `packages/adapters/drizzle/package.json`
    (name `@better-tables/adapters-prisma`, tsdown, exports map,
    `publishConfig.access: public`; peers: `@better-tables/core:
    workspace:*` + `@prisma/client` with a tested version range; devDeps:
    `prisma` CLI + `@prisma/client`).
  - Root `tsconfig.json:24-27` paths — add
    `"@better-tables/adapters-prisma": ["./packages/adapters/prisma/src"]`
    (note the existing drizzle mapping uses the OLD name
    `@better-tables/drizzle` — leave it; add the new one under the real
    package name).
  - CI: `.github/workflows/test.yml:321-322` — `test-adapters` job (“Test
    Adapter Packages”); it needs a `bunx prisma generate` (and test-schema
    push) step before running prisma tests.
  - Tests: SQLite via `tests/schema.prisma` (`provider = "sqlite"`), temp
    file DB, `bunx prisma generate` + `bunx prisma db push` in setup — no
    external services. If client generation fails under Bun, see STOP.
  - Changesets: new-package `minor` entries; Prisma package README
    required (npm-facing — model on
    `packages/adapters/drizzle/README.md`).
- **Known Prisma capability gap to handle honestly** (matters for Phase
  7): Prisma supports ORDER BY relation count
  (`orderBy: { posts: { _count: 'desc' } }`) and SELECTing counts
  (`_count`), but has NO native WHERE-by-relation-count. So derived
  aggregates on Prisma can render + sort but not filter without raw SQL.
  Plan 060's `AdapterMeta.capabilities.aggregates` may need per-operation
  granularity (`{ render, sort, filter }`) — 060's design step has a note
  to consider this; coordinate.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (root) | exit 0 |
| Generate client | `cd packages/adapters/prisma && bunx prisma generate --schema tests/schema.prisma` | exit 0 |
| Push test DB | `bunx prisma db push --schema tests/schema.prisma` | exit 0 |
| Package tests | `cd packages/adapters/prisma && bun test` | all pass |
| Conformance (all adapters) | `cd packages/adapters/conformance && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Build | `bun run build` | exit 0 |

## Scope

**In scope**:
- `packages/adapters/prisma/**` (create everything)
- `packages/adapters/conformance/**` (create — Phase 1's shared suite; private package)
- `packages/adapters/toolkit/src/**` — ONLY the export-format lift (Phase 6) and any port-interface adjustment that Phase 2 proves necessary (each such change needs its own changeset + drizzle re-verification)
- `packages/adapters/drizzle/**` — ONLY re-pointing to lifted toolkit modules + wiring the conformance suite (no behavior changes)
- Root `tsconfig.json` (path mapping), `.github/workflows/test.yml`
  (prisma generate step in `test-adapters`)
- Docs: `apps/marketing/content/docs/adapters/prisma.mdx` (create) +
  `adapters/meta.json` + `adapters/index.mdx` card +
  `packages/adapters-prisma.mdx` + `packages/index.mdx` + `packages/meta.json` + `wiki.md`
- `.changeset/*.md`; `plans/README.md`; `CLAUDE.md` package map

**Out of scope** (do NOT touch):
- Core contract changes — if a port doesn't fit, adjust the TOOLKIT seam
  (with drizzle re-verified), never `packages/core/src/types/adapter.ts`.
- Prisma-side migrations tooling, multi-schema, driver adapters preview
  features — plain `PrismaClient` only.
- `subscribe` beyond local mutation emission (parity, not realtime infra).
- UI changes of any kind.

## Git workflow

- Branch per phase off the current mainline (`prisma-adapter-phase-N`) or
  one branch with phase commits — operator's choice; commits
  `Plan 061 Phase N: …`.

## Steps

### Phase 1: Adapter conformance suite (the parity instrument)

Create private package `packages/adapters/conformance` exporting
`runAdapterConformanceSuite(name, makeAdapter, options)` for bun:test:
a factory returning `{ adapter, seed }` over the canonical two-table+
relations shape this repo tests everywhere (users 1-1 profile, users 1-N
posts — mirror the drizzle sqlite suites and `tests/schema.prisma` below).
The suite encodes OBSERVED Drizzle behavior as the spec, parameterized by
declared capabilities (skip blocks the adapter's `meta` doesn't declare):

- fetch: pagination math (`total`/`totalPages`/`hasNext`), every operator
  family per column type, flat AND + OR/nested trees, dotted-path filter/
  sort, `columns` selection, cross-1-N `total` correctness (plan-003
  class), case-insensitive text `contains`.
- facets: `getFilterOptions` distinct+labels, `getFacetedValues`
  self-exclusion + top-100 cap, `getMinMaxValues`.
- schema: `describeColumns` field/type/nullability/enum-options/writability.
- writes (when declared): create/update/delete round-trips, bulk variants,
  `resolveCellWriteTarget` own-table + related-row, mutation events via
  `subscribe`.
- export (when declared): CSV shape + formula-escaping.

Wire it to **memoryAdapter and Drizzle first** — both must pass before any
Prisma code exists (that proves the suite, and any drizzle failure is a
pre-existing bug to report, not to fix here).

**Verify**: `cd packages/adapters/conformance && bun test` → memory +
drizzle green. Record skipped-capability counts per adapter in the test
output.

### Phase 2: Scaffold + `PrismaPredicateEmitter`

Package scaffold per Current state; `tests/schema.prisma` (SQLite) with
the canonical schema + deterministic seed helpers. Implement the emitter
against the toolkit `PredicateEmitter` seam, covering the FULL operator
registry (`packages/core/src/types/filter-operators.ts`): text family
(insensitivity normalization per provider), number, date (absolute +
relative via `computeDatePeriodRange`), option (`is/isNot/isAnyOf/isNoneOf`
→ equals/not/in/notIn), multiOption (Prisma list/array ops where the
provider supports them — SQLite lacks scalar lists: declare per-provider
in `supportedOperators` instead of faking), boolean, `isNull/isNotNull`,
json (`contains/equals/isEmpty/isNotEmpty` best-effort per provider —
declare honestly).

**Verify**: emitter unit tests per family (`tests/predicate-emitter.test.ts`)
→ pass; `bun run typecheck` exit 0.

### Phase 3: Read path — `fetchData` + tree translation

Compose: `PrimaryTableResolver` over the DMMF model map (record fit/
friction); dotted ids → nested `where`/`include`/`orderBy`; `FilterRouter`
+ emitter for leaves; recursive `FilterGroupNode` → `AND:[…]/OR:[…]`
(`NOT` where trees produce it); `skip`/`take` pagination; `total` via
`count({ where })`; assemble `FetchDataResult`. No DataTransformer (rows
arrive nested) — assert relation objects land under the same keys the
Drizzle+transformer path produces (`row.profile.location`).

**Verify**: hook Prisma into the Phase 1 conformance suite with
capabilities `{ read: true }` — fetch + tree + dotted-path + total blocks
green.

### Phase 4: Facets trio

`getFilterOptions` (distinct values), `getFacetedValues` (`groupBy` +
`_count`, WITH self-exclusion of the target column's own filter and the
top-100 cap — match plans 021/040 semantics exactly), `getMinMaxValues`
(`aggregate` `_min/_max`).

**Verify**: conformance facet blocks green for Prisma.

### Phase 5: Schema + typed factory

`describeColumns` from DMMF (fields → `InferredColumnSpec`: type mapping
table, nullability, enum values as options, `writable` from
id/updatedAt/relation rules); `prismaAdapter(client, options?)` typed
factory — model map from the client type (`keyof` minus `$`-members), zero
manual generics at the call site, `options.defaultPrimaryTable` parity,
unknown-table `SchemaError` with levenshtein suggestions. Attempt the
`$types` schema-catalog protocol (per-model relation-aware row types via
`Prisma.<Model>GetPayload` depth-1) so `defineTable<Tables>()` path
builders autocomplete — if the generated types can't satisfy it without
codegen, deliver the runtime factory and record the exact type-level
blocker in the findings section of the PR (this was 008's riskiest
question; answer it with evidence).

**Verify**: conformance schema block green; a compile-only test proves
`betterTables({ database: prismaAdapter(new PrismaClient()) })` +
`defineTable<typeof tables>()('user', t => [t.text('name'),
t.text('profile.location')])` typechecks (or the recorded blocker).

### Phase 6: Writes, events, export

Mutations + bulk + `resolveCellWriteTarget` (DMMF relation metadata:
dotted id → `{ table, field, relatedIdPath, single, writable }`; 1-N paths
never single); local `subscribe` emission on all five mutation sites
(drizzle parity). Export: FIRST lift `export-format.ts` out of drizzle
into the toolkit (3 exports; drizzle re-imports; its tests stay green —
separate commit + changesets for toolkit/drizzle), THEN implement
`exportData` on Prisma reusing it, including the plan-050 row-cap decision
if 050 has landed (drift check).

**Verify**: conformance write/export blocks green for Prisma; drizzle
suite still green after the lift (`cd packages/adapters/drizzle && bun test`).

### Phase 7 (gated on plan 060): Derived aggregates

Lower `DerivedColumnSpec` per Prisma's real abilities: render via
`_count`/aggregate selection; sort via `orderBy: { relation: { _count } }`;
FILTER is not natively expressible — declare the capability honestly
(coordinate with 060's capability shape; if 060 adopted per-op granularity,
declare `{ render: true, sort: true, filter: false }`; if not, declare no
aggregate capability and file the gap in the ledger). Do NOT reach for
`$queryRaw` composition in v1.

**Verify**: conformance aggregate blocks (from 060) green or cleanly
skipped per declared capabilities; a test asserts the filter-capability
error path gives an actionable message.

### Phase 8: Docs, CI, publish surface, ledger

Docs pages listed in Scope (model `adapters/prisma.mdx` on
`adapters/drizzle.mdx`: factory options, provider notes, capability table
incl. the aggregate-filter gap and multiOption-per-provider notes); CI
generate step in `test-adapters`; package README; changesets
(`@better-tables/adapters-prisma` minor — first release; toolkit/drizzle
patches from Phase 6); `CLAUDE.md` package map row; `wiki.md`;
`plans/README.md` rows (this plan + retire 008).

**Verify**: `bun run build` + root typecheck green; CI config change
exercised by pushing the branch (adapter job runs prisma generate); docs
links resolve (`grep -rn "adapters/prisma" apps/marketing/content/docs/ | wc -l` ≥ 3).

## Test plan

- The conformance suite IS the test plan's spine (Phase 1) — memory,
  drizzle, prisma all run it; capability-skips are printed, not silent.
- Prisma-only additions: emitter unit tests; provider-quirk tests
  (SQLite insensitive-`contains` normalization, multiOption declared-out);
  DMMF describeColumns snapshots; `$types` compile test; capability-error
  test (Phase 7).
- Patterns: `packages/adapters/drizzle/tests/` sqlite suites;
  `packages/core/tests/adapters/memory-adapter.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/adapters/conformance` exists; memory + drizzle + prisma all run it green (prisma's skips limited to honestly-declared gaps)
- [ ] Prisma passes: tree filters, dotted-path filter/sort, self-excluding facets, describeColumns, all writes + `resolveCellWriteTarget`, mutation events, exportData
- [ ] `meta.supportedOperators`/`features`/capabilities match implemented reality (a conformance meta-honesty check asserts this)
- [ ] `bun run build` + `bun run typecheck` + all package suites green; CI adapter job generates the client and passes
- [ ] Docs pages exist and are linked (adapters nav + packages matrix + wiki.md + CLAUDE.md)
- [ ] Changesets exist; `plans/README.md` updated (this row DONE-or-phase-status; 008 marked SUPERSEDED)

## STOP conditions

Stop and report back (do not improvise) if:

- Drizzle or memory FAIL the Phase 1 conformance suite — that's a
  pre-existing semantic bug or a wrong spec encoding; report before
  building Prisma against it.
- A toolkit port cannot express a Prisma need without modification —
  propose the minimal seam change, get it reviewed, land it with drizzle
  re-verified BEFORE continuing (do not fork a private copy of the port).
- `@prisma/client` generation is unworkable under Bun in this repo — try
  the documented workaround once, then report (decides the test rig).
- The zero-generics factory requires hidden `any` — ship the explicit-
  generic escape hatch and flag it; never hidden `any`.
- Case-insensitivity or null-ordering semantics cannot be made to match
  Drizzle on some provider — report the matrix; silent semantic drift
  between adapters is the worst failure mode.

## Maintenance notes

- The conformance suite is now the contract's executable spec: every
  future adapter (Kysely — plan 062 — depends on Phases 1+6 here) starts
  by running it; contract changes must update it first.
- The Prisma aggregate-filter gap should be revisited whenever Prisma
  ships relation-count filtering; the capability declaration makes that a
  one-line flip plus tests.
- Reviewer scrutiny per phase: emitter semantics vs drizzle (Phase 2),
  nested-vs-flat row shape parity (Phase 3), self-exclusion correctness
  (Phase 4), DMMF writability rules (Phase 5/6), and that no phase touched
  core types.
