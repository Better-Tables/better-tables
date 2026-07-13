# Plan 007: Extract an ORM-agnostic adapter toolkit from the Drizzle package

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/adapters/drizzle/src/`
> If the adapter changed since this plan was written (plans 002/003 land here
> first — that is expected), re-verify the excerpts before proceeding; on a
> structural mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (large behavior-preserving refactor; strong existing adapter test suite mitigates)
- **Depends on**: 002, 003 (land the known adapter bugs first — don't move broken code), 006 (read the design doc; not a hard blocker)
- **Category**: tech-debt (enables direction: Prisma adapter)
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

The maintainer's next big goal is a Prisma adapter. Today that means re-implementing, from scratch: operator classification and routing, relationship-path parsing (`'profile.location'` → join plan), aliasing, flat→nested result transformation, primary-table resolution, and pagination/faceting math — because all of it lives inside the Drizzle package, interleaved with `drizzle-orm` calls. Meanwhile the per-dialect query builders are triplicated copy-paste that has **already** diverged once (the count bug fixed in plan 003 existed only because a Postgres fix was never propagated). This plan carves the ORM-agnostic layer into a shared package and dedupes the dialect builders, so plan 008's Prisma adapter becomes "implement a schema port + predicate emitter" instead of a rewrite.

## Current state

Verified import-graph facts (checked at commit `55dfd01` with `grep -c "drizzle-orm"`):

- **Already ORM-agnostic (zero `drizzle-orm` imports), movable nearly as-is:**
  - `packages/adapters/drizzle/src/utils/alias-generator.ts` — relationship-path → SQL alias strings
  - `packages/adapters/drizzle/src/utils/levenshtein.ts` — suggestion distances for error messages
  - `packages/adapters/drizzle/src/utils/sql-utils.ts` — identifier escaping (`escapeSqlIdentifier`, default quote char `"` at `:35`)
  - `packages/adapters/drizzle/src/utils/schema-introspection.ts`
  - `packages/adapters/drizzle/src/primary-table-resolver.ts` — match-counting algorithm over column ids
  - `packages/adapters/drizzle/src/data-transformer.ts` — flat joined rows → nested objects via `columnMapping`
- **Mixed (agnostic logic interleaved with Drizzle leaves):**
  - `packages/adapters/drizzle/src/filter-handler.ts` (2169 lines) — imports both `@better-tables/core` operator definitions (`:39-40`) and `drizzle-orm` (`:41-58`). The operator taxonomy (`isTextOperator` … around `:761-813`), dispatch (`mapOperatorToCondition`, `:698-758`), date-period math, and value validation are agnostic; every leaf handler then calls `eq/like/sql` etc. (e.g. text handlers at `:826-861`).
  - `packages/adapters/drizzle/src/relationship-manager.ts` — `resolveColumnPath` path parsing (`:109-280`) is pure; the file also imports `eq` and returns Drizzle column objects.
- **Triplicated dialect code:** `query-builders/{postgres,mysql,sqlite}-query-builder.ts` share the select/join/count skeletons (join loops nearly line-identical; see the MySQL loop at `mysql-query-builder.ts:224-240`), and `operations/{postgres,mysql,sqlite}-operations.ts` duplicate insert/update/delete/bulk bodies (e.g. `bulkDelete` at postgres `:170`, mysql `:209`, sqlite `:166`). Plans 002/003 leave `TODO(plan-007)` markers at the count sites.
- Defense-in-depth gap to fix during the move (ADAPTER-04): each dialect's `quoteIdentifier` does raw interpolation (`postgres-query-builder.ts:722-724`, `sqlite-query-builder.ts:412-414`, `mysql-query-builder.ts:372-374`) and relies on the *caller* pre-escaping with `escapeSqlIdentifier(alias)` using the default `"` quote char (`base-query-builder.ts:207-208`) — wrong for MySQL backticks. When `sql-utils.ts` moves into the toolkit, make `quoteIdentifier` do its own escaping with the dialect's quote char.
- Monorepo conventions for a new package: copy the shape of `packages/adapters/drizzle/package.json` (tsdown build, `"main"/"module"/"types"` + exports map with `types` first, `publishConfig.access: public`, catalog references for devDeps). Workspace globs in root `package.json` already cover `packages/adapters/*`; a `packages/adapter-toolkit` path needs adding to `workspaces.packages` ONLY if placed outside existing globs — place it at `packages/adapters/toolkit` to avoid touching root config. Root `tsconfig.json` `paths` should gain `@better-tables/adapters-toolkit`.
- Adapter test suite: 21 test files under `packages/adapters/drizzle/tests/` — the behavior lock for this refactor. SQLite suites run with no env; Postgres/MySQL need `POSTGRES_TEST_URL`/`MYSQL_TEST_URL` (CI provides services).

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                      | exit 0              |
| Typecheck | `bun run typecheck` (root)                     | exit 0              |
| Adapter tests | `cd packages/adapters/drizzle && bun test` | SQLite suites pass  |
| Toolkit tests | `cd packages/adapters/toolkit && bun test` | all pass            |
| Build     | `bun run build` (root)                         | exit 0              |

## Scope

**In scope**:
- `packages/adapters/toolkit/` (create: package.json, tsconfig, tsdown config, src/, tests/)
- Moves + import rewrites within `packages/adapters/drizzle/src/**`
- `packages/adapters/drizzle/package.json` (add toolkit workspace dep)
- Root `tsconfig.json` (add the toolkit path mapping)
- Moved tests: relocate the pure-logic test files with their modules
- `.changeset/*.md`

**Out of scope** (do NOT touch):
- `packages/core` — the toolkit depends on core types; core gains no dependency on the toolkit.
- Any behavior change beyond the ADAPTER-04 escaping fix — this is a behavior-preserving refactor; new features (filter groups, Prisma) come later.
- The `relationship-detector.ts` heuristics (ADAPTER-05 in `plans/README.md`) — move nothing from it in phase 1; its logic is under separate scrutiny.

## Git workflow

- Branch: `extract-adapter-toolkit`
- Commit per step (moves land reviewably); style: imperative sentence, e.g. "Move ORM-agnostic adapter utilities into @better-tables/adapters-toolkit"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Scaffold `@better-tables/adapters-toolkit`

Create `packages/adapters/toolkit` mirroring the drizzle package's build setup (tsdown, exports map, scripts: build/dev/test/typecheck/lint). Dependencies: `@better-tables/core` (workspace). Add the root tsconfig path `"@better-tables/adapters-toolkit": ["./packages/adapters/toolkit/src"]`.

**Verify**: `bun install && bun run build` at root → exit 0 (empty package builds)

### Step 2: Move the six agnostic modules

Move `alias-generator.ts`, `levenshtein.ts`, `sql-utils.ts`, `schema-introspection.ts`, `primary-table-resolver.ts`, `data-transformer.ts` (and their tests: `sql-utils.test.ts`, `primary-table-resolver.test.ts`, `data-transformer.test.ts`, `levenshtein` if tested) into the toolkit. In the drizzle package, replace each moved file with an import-and-re-export from the toolkit **or** rewrite the internal imports directly (prefer direct rewrites; keep a re-export only in `src/index.ts` if the symbol was publicly exported — check `packages/adapters/drizzle/src/index.ts`). Define in the toolkit the minimal structural types these modules need (they currently import some Drizzle-flavored types from `../types` — extract the structural parts, e.g. `hasColumn`-style ports for `primary-table-resolver`).

**Verify**: `bun run typecheck` (root) → exit 0; `cd packages/adapters/drizzle && bun test` → same pass set as before the move; `cd packages/adapters/toolkit && bun test` → moved tests pass

### Step 3: Fix identifier escaping while it moves (ADAPTER-04)

In the toolkit's `sql-utils.ts`, make `quoteIdentifier(identifier, quoteChar)` a single function that BOTH escapes (doubling the quote char inside the identifier) and wraps — parameterized by dialect quote char (`"` for postgres/sqlite, `` ` `` for mysql). In the drizzle package, replace the three per-dialect raw-interpolation `quoteIdentifier`s (`postgres-query-builder.ts:722-724`, `sqlite-query-builder.ts:412-414`, `mysql-query-builder.ts:372-374`) with calls to it, and delete the caller-side pre-escaping at `base-query-builder.ts:207-208` so escaping cannot be forgotten or done with the wrong quote char. Add toolkit unit tests: embedded `"` doubled for postgres, embedded backtick doubled for mysql.

**Verify**: `cd packages/adapters/toolkit && bun test` → escaping tests pass; `cd packages/adapters/drizzle && bun test` → suite unchanged

### Step 4: Extract the predicate-router seam from `filter-handler.ts`

Split `filter-handler.ts` into: (a) toolkit `filter-router.ts` — operator classification (`isTextOperator` etc.), the `mapOperatorToCondition` dispatch restructured to call a `PredicateEmitter` interface, date-period computation, and value-shape validation; (b) drizzle-package `drizzle-predicate-emitter.ts` — the interface implementation whose methods contain the existing `eq/like/ilike/sql` leaf logic, moved verbatim. The emitter interface returns an opaque generic (`TPredicate`), so the router is `class FilterRouter<TPredicate>`. Keep JSONB and array-column handling drizzle-side in phase 1 (they're dialect-specific; give the emitter optional capability methods, `emitJsonPath?`, and route around them when absent). Preserve the public `FilterHandler` API of the drizzle package (its constructor and `buildConditions` signatures) as a thin composition of router + emitter so `base-query-builder.ts` call sites do not change.

This is the largest step. The behavior lock is the existing suite: `tests/filter-handler.test.ts`, `filter-handler-array.test.ts`, `filter-handler-jsonb.test.ts`, `filter-handler-large-array.test.ts`, `computed-field-sql-condition.test.ts` must pass unmodified (test-file edits limited to import paths).

**Verify**: `cd packages/adapters/drizzle && bun test tests/filter-handler.test.ts tests/filter-handler-array.test.ts tests/filter-handler-jsonb.test.ts tests/filter-handler-large-array.test.ts` → all pass unmodified

### Step 5: Dedupe the dialect builders (template-method)

Hoist into `base-query-builder.ts`: the join-application loop, the count-query construction (including plan 003's `countDistinct` guard — delete the `TODO(plan-007)` markers), and pagination application, parameterized by small dialect hooks (`asTable`, `asColumn`, `quoteChar`, optional `buildRelationalQuery`). Do the same for `operations/*` (shared insert/update/delete/bulk skeletons with dialect casts as hooks). Target: the three dialect query-builders shrink to dialect-specific overrides only (JSONB/ILIKE/array handling, relational query support). Measure before/after with `wc -l packages/adapters/drizzle/src/query-builders/*.ts packages/adapters/drizzle/src/operations/*.ts`.

**Verify**: `cd packages/adapters/drizzle && bun test` → full SQLite pass set unchanged; per-dialect query-builder tests (`postgres-query-builder.test.ts`, `mysql-query-builder.test.ts`, `sqlite-query-builder.test.ts`) pass unmodified

### Step 6: Publish plumbing + changeset

Toolkit package.json gets `publishConfig.access: public`, version `0.1.0`. Changeset: minor for `@better-tables/adapters-drizzle` (internal restructure, no API change), adds `@better-tables/adapters-toolkit`.

**Verify**: `bun run build` at root → exit 0; `ls .changeset/*.md`

## Test plan

The existing 21-file adapter suite is the primary lock — the done criterion is that it passes with edits limited to import paths. New toolkit tests: moved suites (step 2), escaping matrix (step 3), plus router-level tests exercising `FilterRouter` with a stub emitter (assert: operator → correct emitter method + validated values; unknown operator → error; empty values → no-op). Model on `tests/filter-handler.test.ts` structure.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/adapters/toolkit` exists, builds, and its tests pass
- [ ] `grep -c "drizzle-orm" packages/adapters/toolkit/src -r` → 0
- [ ] `grep -rn "TODO(plan-007)" packages/adapters/drizzle/src/` → 0 matches
- [ ] `cd packages/adapters/drizzle && bun test` → pass set identical to pre-refactor (SQLite suites; CI validates pg/mysql)
- [ ] `bun run typecheck && bun run build` (root) → exit 0
- [ ] `.changeset/*.md` exists
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plans 002/003 have not landed (check `plans/README.md` status) — moving code with known bugs forks the fix; wait or coordinate.
- Step 4's split forces changes to the *assertions* (not just imports) of any filter-handler test — that means behavior drifted; stop and diff the generated conditions.
- The toolkit needs to import from `drizzle-orm` to type something — the seam is wrong; report which type forced it.
- Step 5 uncovers real behavioral differences between dialects hidden in the "identical" code (beyond the known count divergence) — enumerate them and stop; each needs a decision (bug vs. intentional).

## Maintenance notes

- Plan 008 (Prisma spike) consumes this package: `SchemaPort` + `PredicateEmitter` are exactly what the Prisma adapter implements. Keep both interfaces small — every method added is Prisma-implementation work.
- Reviewers: the diff will be large but should be move-dominated; scrutinize any hunk that isn't a move, especially in filter-handler leaf logic.
- After this lands, a lint rule (biome `noRestrictedImports` or a CI grep) keeping `drizzle-orm` out of the toolkit prevents regression to entanglement.
