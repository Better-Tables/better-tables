# Plan 008: Prisma adapter spike — prove the toolkit seams with a second ORM (design/spike)

> **ON HOLD (maintainer directive, 2026-07-13)**: no Prisma IMPLEMENTATION until
> everything else in the plan set is done. Abstracting/redesigning the Drizzle
> side to be provider-ready (plan 007's toolkit, the `PredicateEmitter`/
> `SchemaPort` seams, plan 017's group translation) proceeds as planned — this
> plan is the last item on the board, not cancelled. Do not dispatch until the
> maintainer lifts the hold in `plans/README.md`.

> **Executor instructions**: This is a SPIKE plan. The deliverable is a working
> proof-of-concept package plus a findings document — NOT a production-ready
> adapter. Follow the steps, run every verification command, and honor the
> STOP conditions. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/adapters/`
> Plans 002/003/007 are expected to have landed here. Read
> `packages/adapters/toolkit/src/` (created by plan 007) before starting; if it
> does not exist, STOP — this spike depends on it.

## Status

- **Priority**: P2
- **Effort**: L (spike-scoped: read path only)
- **Risk**: LOW (new isolated package; nothing existing changes)
- **Depends on**: 007 (hard), 006 (read the design doc for filter-group awareness), 005 (typed factory conventions)
- **Category**: direction
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

Multi-provider support is the maintainer's stated expansion goal, and Prisma is the named first target. A second real ORM is also the only honest test of plan 007's abstractions — interfaces extracted against one consumer always fit that consumer. This spike builds a read-only Prisma adapter (fetch + filter + sort + paginate + count on a two-table relational schema) to (a) give users a `prismaAdapter(client)` to try, and (b) produce a precise gap list for the production version.

## Current state

- The only adapter is Drizzle. Its public factory is the DX bar to match — `packages/adapters/drizzle/src/factory.ts:89-92`:

  ```typescript
  export function drizzleAdapter<TDB>(
    db: TDB,
    factoryOptions?: DrizzleAdapterFactoryOptions<ExtractSchemaFromDB<TDB>, ExtractDriverFromDB<TDB>>
  ): DrizzleAdapter<ExtractSchemaFromDB<TDB>, ExtractDriverFromDB<TDB>>
  ```

  i.e. everything inferred from the `db` instance at the type level. The Prisma equivalent: `prismaAdapter(prismaClient)` inferring model names/shapes from the generated client type.
- The contract to implement: `TableAdapter<TData>` in `packages/core/src/types/adapter.ts` — required members `fetchData` (`:227`), `getFilterOptions` (`:241`), `getFacetedValues` (`:255`), `getMinMaxValues` (`:269`), `meta: AdapterMeta` (`:380`). All write methods are optional (`createRecord?` etc.) — the spike implements NONE of them (avoids re-litigating plan 002's routing problem before plan 006 settles the contract).
- Toolkit modules available after plan 007 (verify actual names/exports when you start): `FilterRouter`/`PredicateEmitter` (operator classification + dispatch), `primary-table-resolver`, `alias-generator`, `data-transformer`, `levenshtein` suggestions.
- Key structural difference to design around: the Drizzle adapter builds SQL (joins, aliases, flat rows re-nested by `data-transformer`); Prisma builds a **query object** (`where`/`orderBy`/`skip`/`take`/`include`) and returns already-nested objects. Expect to need: a `PredicateEmitter` producing Prisma `where` fragments (e.g. `contains`/`in`/`gte` — note Prisma's `mode: 'insensitive'` for case-insensitive text vs. Drizzle's `ilike`); relationship-path handling that emits nested `where: { profile: { location: ... } }` instead of JOIN clauses; NO alias/data-transformer usage on the read path. Record every toolkit module that turns out to be unusable for Prisma — that's a primary spike finding, not a failure.
- Filter semantics reference: the core `FilterOperator` union (`packages/core/src/types/filter.ts:10-57`) and the drizzle leaf behaviors in `packages/adapters/drizzle/src/drizzle-predicate-emitter.ts` (post-007 location) — match semantics (e.g. text `contains` is case-insensitive in the Drizzle adapter via ilike/lower — verify and mirror with Prisma's `mode: 'insensitive'`).
- Package scaffold conventions: mirror `packages/adapters/drizzle/package.json` (tsdown, exports map, catalog devDeps). Prisma packages: `@prisma/client` + `prisma` CLI as devDependencies; `@prisma/client` as a **peerDependency** (do NOT repeat the drizzle package's hard-dependency mistake — see plan 009 / DX-08). For tests, use SQLite via a `schema.prisma` with `provider = "sqlite"` — no external DB needed; `bunx prisma generate` + `bunx prisma db push` against a temp file DB in test setup.
- AdapterMeta: declare honestly — `features: { read: true, create: false, update: false, delete: false, bulkOperations: false, realTimeUpdates: false, export: false, transactions: false }`, and `supportedOperators` reflecting only what the spike implements.
- Use the Context7 MCP tool (if available in your environment) or Prisma's docs for current client API syntax — do not rely on memorized Prisma API shapes; nested `where`/`orderBy` syntax and `mode: 'insensitive'` support vary by version and database.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|----------------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                          | exit 0              |
| Generate client (in package) | `bunx prisma generate`             | exit 0              |
| Test DB   | `bunx prisma db push --schema tests/schema.prisma` | exit 0              |
| Typecheck | `cd packages/adapters/prisma && bun run typecheck` | exit 0              |
| Tests     | `cd packages/adapters/prisma && bun test`          | all pass            |
| Repo build| `bun run build` (root)                             | exit 0              |

## Scope

**In scope**:
- `packages/adapters/prisma/` (create everything: package.json, tsconfig, tsdown config, src/, tests/, README.md marked EXPERIMENTAL)
- Root `tsconfig.json` path mapping for `@better-tables/prisma` (note: a mapping for this name already exists pointing at `packages/adapters/rest`-style phantom paths — check and correct; see plan 009 which prunes phantom paths)
- `plans/design/prisma-adapter-findings.md` (create — the spike findings doc)

**Out of scope** (do NOT touch):
- Write operations (create/update/delete) — contract v2 (plan 006) settles their shape first.
- `packages/adapters/toolkit` and `packages/adapters/drizzle` source — if the toolkit interface doesn't fit, record the gap in the findings doc; do NOT reshape the toolkit mid-spike (that's the follow-up's job, done deliberately).
- Publishing — no changeset; the package stays `"private": true` until promoted.

## Git workflow

- Branch: `prisma-adapter-spike`
- Commit style: imperative sentence, e.g. "Add experimental Prisma adapter with read-path support"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Scaffold + test schema

Create the package (private). Test fixture: `tests/schema.prisma` with SQLite provider and the canonical two-table shape used across this repo's tests — `User` (id, name, email, status) 1-N `Post` (id, title, authorId) and 1-1 `Profile` (id, location, userId) — mirroring `packages/adapters/drizzle/tests/adapter-sqlite.test.ts`'s schema so behaviors are comparable. Test setup generates the client and pushes to a temp SQLite file; seed helpers insert deterministic rows.

**Verify**: `cd packages/adapters/prisma && bunx prisma generate && bun test tests/setup.test.ts` (a trivial connectivity test) → pass

### Step 2: Implement `PrismaPredicateEmitter`

Implement the toolkit's `PredicateEmitter` interface, emitting Prisma `where` fragments. Cover the operator families the spike targets: text (`contains`/`equals`/`startsWith`/`endsWith`/`isEmpty`/`isNotEmpty` — use `mode: 'insensitive'` where the DB supports it; NOTE SQLite's `contains` is already case-insensitive in Prisma and rejects `mode` — verify against current docs and normalize in the emitter), number (`equals`/`notEquals`/`gt(e)`/`lt(e)`/`between`/`notBetween`), option (`is`/`isNot`/`isAnyOf`/`isNoneOf` → `in`/`notIn`), boolean (`isTrue`/`isFalse`), universal (`isNull`/`isNotNull`). Skip: multi-option array operators, JSON operators, date relative-period operators beyond `is/before/after/between` (record as gaps).

**Verify**: `bun test tests/predicate-emitter.test.ts` → unit tests pass asserting emitted `where` object shapes for each operator

### Step 3: Implement `PrismaAdapter.fetchData`

Compose: resolve primary model (explicit `primaryTable` param, else toolkit `primary-table-resolver` against the client's model map — record fit/misfit); translate dotted column ids to nested `where`/`select`-`include` (e.g. `'profile.location'` → `{ profile: { location: predicate } }` for where; `include: { profile: true }` for selection); map sorting (including nested `orderBy: { profile: { location: 'asc' } }`); paginate with `skip`/`take`; compute `total` with `client.<model>.count({ where })` (Prisma counts distinct parents naturally — no join-inflation class of bug; note this in findings); assemble `FetchDataResult` (reuse the pagination-math helper if plan 007 exported one; else inline and record the gap).

**Verify**: `bun test tests/fetch-data.test.ts` → integration tests below pass

### Step 4: `getFilterOptions` / `getFacetedValues` / `getMinMaxValues`

`groupBy` with `_count` for facets; `aggregate` `_min`/`_max` for ranges; distinct values for options. Same known limitation as Drizzle (facets ignore active filters — ADAPTER-06 in `plans/README.md`): implement the same semantics for parity, note it in findings.

**Verify**: `bun test tests/facets.test.ts` → passes

### Step 5: Typed factory

`prismaAdapter(client)` inferring the model map from the generated client type (Prisma's client exposes model delegates as properties — derive `TModels` from `keyof` the client instance, excluding `$`-prefixed members). Match the drizzleAdapter factory's inference bar: zero manual generics at the call site.

Additionally, validate the config-level DX from plan 011 (read `plans/design/table-definition-dx.md` if it exists): (a) the factory must slot into `betterTables({ database: prisma(client) })` — check the naming decision in 011's doc (short `prisma()`/`drizzle()` vs `prismaAdapter()`) and match it; (b) attempt the `$types` schema-catalog protocol from 011 (per-model relation-aware row types via `Prisma.<Model>GetPayload` with depth-1 includes) and record in the findings doc whether Prisma can satisfy it without codegen. This is spike evidence for 011's riskiest assumption — treat failure as a finding, not a blocker.

**Verify**: type-level test — `prismaAdapter(new PrismaClient())` compiles with no explicit generics; `fetchData({ primaryTable: 'bogus' })` rejected at runtime with a helpful error listing model names (reuse toolkit levenshtein suggestions; record fit/misfit).

### Step 6: Findings document

Write `plans/design/prisma-adapter-findings.md`: (a) toolkit modules used as-is / used with friction / unusable (with the one-line reason each); (b) `PredicateEmitter` interface changes the production version needs; (c) operator coverage table (implemented / gap / impossible-in-Prisma); (d) how plan 006's `FilterNode` groups would map (`AND`/`OR`/`NOT` arrays — sketch the recursive translation); (e) estimated effort for production parity (writes, JSON columns, multi-option, export, relative date operators); (f) recommendation: promote toolkit changes first vs. iterate in place; (g) whether the plan-011 `$types` schema-catalog protocol is satisfiable from the generated Prisma client types (from Step 5) — with the exact type recipe or the exact blocker.

**Verify**: document exists with sections a–f (`grep -c "^## " plans/design/prisma-adapter-findings.md` ≥ 6)

## Test plan

Integration tests (`tests/fetch-data.test.ts`), seeded SQLite, mirroring `adapter-sqlite.test.ts` scenarios: basic fetch + pagination math (`total`, `totalPages`, `hasNext`); text `contains` filter (case-insensitivity asserted); option `isAnyOf`; number `between`; nested filter on `profile.location` (the relationship flagship — assert only matching users return); nested sort; combined filter+sort+page; `total` correctness when filtering across the 1-N `posts` relation (the plan-003 bug class — must be 2 not 4). Unit tests for the emitter per operator family.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/adapters/prisma` builds; `bun run typecheck` exits 0 in it
- [ ] `cd packages/adapters/prisma && bun test` → all pass (SQLite, no external services)
- [ ] The nested-relationship filter test (`profile.location`) passes
- [ ] `plans/design/prisma-adapter-findings.md` exists with sections a–f
- [ ] Package is `"private": true` and README says EXPERIMENTAL
- [ ] Nothing under `packages/adapters/toolkit` or `packages/adapters/drizzle` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 007's toolkit doesn't exist or exports no `PredicateEmitter`-shaped seam (dependency not met).
- The toolkit `FilterRouter` cannot be reused without modifying it — record the exact mismatch in the findings doc, implement the routing locally in the spike, and continue; but STOP if that local reimplementation exceeds ~200 lines (the seam design needs rework first).
- `@prisma/client` generation fails under Bun in this repo's setup — try the documented Bun workaround once; if still failing, report the incompatibility (this decides whether the production adapter needs a different test rig).
- Prisma's typed client makes the zero-generics factory (step 5) impossible without `any` — deliver the factory with an explicit-generic escape hatch instead, and flag it prominently in findings; do NOT ship hidden `any`.

## Maintenance notes

- This package must not be published until: write support lands (post-006), operator gaps from the findings table close or are documented as unsupported in `AdapterMeta.supportedOperators`, and the README quick-start is verified against a clean install.
- The findings doc is the input for the "production Prisma adapter" plan — whoever writes it should also read `plans/design/core-contract-v2.md` (plan 006) so both breaking changes ship together for adapters.
- Reviewers: check semantic parity assertions against Drizzle (case-insensitivity, null handling) — silent semantic drift between adapters is the worst failure mode for a "database-agnostic" library.
