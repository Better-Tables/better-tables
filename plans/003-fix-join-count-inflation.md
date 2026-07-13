# Plan 003: Fix inflated total counts under joins on MySQL and SQLite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/adapters/drizzle/src/query-builders/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (count-expression-only change, pattern already proven in the Postgres builder)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

When a query joins a one-to-many relationship (e.g. filtering users by `posts.title`), the joined result has one row per child. The Postgres query builder handles this by counting distinct primary keys; the MySQL and SQLite builders never got that fix and count raw joined rows. Result: on MySQL/SQLite, `total`, `totalPages`, and `hasNext` are wrong whenever a join is involved — pagination shows pages that don't exist. This is a copy-paste divergence between dialect builders (the deeper structural fix is plan 007; this is the surgical correctness fix that shouldn't wait for it).

## Current state

- The correct pattern, `packages/adapters/drizzle/src/query-builders/postgres-query-builder.ts:556-567`:

  ```typescript
  // If there are joins, count distinct primary keys to avoid inflated counts
  const primaryKeyInfo = this.primaryKeyMap[primaryTable];
  const hasJoins = joinOrder.length > 0;

  const baseQuery =
    hasJoins && primaryKeyInfo
      ? (() => {
          // Use count distinct on primary key to avoid counting duplicate rows from joins
          const pgPkColumn = this.asPgColumn(primaryKeyInfo.column);
          return this.db.select({ count: countDistinct(pgPkColumn) }).from(pgTable);
        })()
      : this.db.select({ count: count() }).from(pgTable);
  ```

- The broken MySQL version, `packages/adapters/drizzle/src/query-builders/mysql-query-builder.ts:215-218` (then joins are added at `:224-240`):

  ```typescript
  const mysqlTable = this.asMySqlTable(primaryTableSchema);
  const baseQuery = this.db.select({ count: count() }).from(mysqlTable);

  const joinOrder = this.relationshipManager.optimizeJoinOrder(context.joinPaths, primaryTable);
  ```

- The broken SQLite version, `packages/adapters/drizzle/src/query-builders/sqlite-query-builder.ts:213-215` (same shape; `joinOrder` computed at `:221`, joins added in the loop below it):

  ```typescript
  const sqliteTable = this.asSQLiteTable(primaryTableSchema);
  const baseQuery = this.db.select({ count: count() }).from(sqliteTable);
  ```

- `primaryKeyMap` is available to all dialects — it's initialized in the shared base class, `packages/adapters/drizzle/src/query-builders/base-query-builder.ts:51` and `:63` (`this.primaryKeyMap = getPrimaryKeyMap(schema)`).
- Dialect column-cast helpers exist per builder (`asPgColumn` in postgres; the MySQL/SQLite builders have equivalent `asMySqlTable`/`asSQLiteTable` table casts — check each file for the column-level cast helper; if a column cast helper doesn't exist in a dialect builder, add a private one mirroring `asPgColumn`).
- `count`/`countDistinct` are imported from `drizzle-orm` — check each builder's import list and extend it.
- The count result is consumed at `packages/adapters/drizzle/src/drizzle-adapter.ts:646` (feeds `total`, then `totalPages`/`hasNext` at `:670-671`).
- Existing tests: `packages/adapters/drizzle/tests/mysql-query-builder.test.ts`, `tests/sqlite-query-builder.test.ts`, `tests/postgres-query-builder.test.ts`, plus integration suites `tests/adapter-sqlite.test.ts`, `tests/adapter-mysql.test.ts`, `tests/adapter-postgres.test.ts`. SQLite tests run against in-memory DBs (no env needed); MySQL/Postgres integration tests need `MYSQL_TEST_URL`/`POSTGRES_TEST_URL` (see `.env.example`) and run with real services in CI.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                      | exit 0              |
| Typecheck | `cd packages/adapters/drizzle && bun run typecheck` | exit 0        |
| Tests     | `cd packages/adapters/drizzle && bun test tests/sqlite-query-builder.test.ts tests/adapter-sqlite.test.ts` | all pass |
| Full suite| `cd packages/adapters/drizzle && bun test`     | SQLite suites pass; MySQL/Postgres need DB URLs |

## Scope

**In scope** (the only files you should modify):
- `packages/adapters/drizzle/src/query-builders/mysql-query-builder.ts`
- `packages/adapters/drizzle/src/query-builders/sqlite-query-builder.ts`
- `packages/adapters/drizzle/tests/sqlite-query-builder.test.ts` (extend) or a new `tests/count-under-joins.test.ts`
- `packages/adapters/drizzle/tests/mysql-query-builder.test.ts` (extend, SQL-shape assertion only if no DB available)
- `.changeset/*.md` (create; patch bump)

**Out of scope** (do NOT touch, even though they look related):
- `postgres-query-builder.ts` — already correct; don't refactor it here.
- Hoisting the shared count logic into `base-query-builder.ts` — that consolidation belongs to plan 007 (toolkit/dedup); keeping this fix local makes it safe and small. Leave a `// TODO(plan-007): hoist shared count logic into BaseQueryBuilder` marker at both fixed sites.
- The data-query row-multiplication issue under manual joins (ADAPTER-03 in `plans/README.md`) — a separate, larger fix; do not attempt it here.

## Git workflow

- Branch: `fix-join-count-inflation`
- Commit style: imperative sentence, e.g. "Count distinct primary keys under joins in MySQL and SQLite builders"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Port the Postgres count guard to MySQL

In `mysql-query-builder.ts`, replicate the Postgres pattern around the `baseQuery` construction (excerpt above): compute `primaryKeyInfo = this.primaryKeyMap[primaryTable]` and `hasJoins = joinOrder.length > 0` **before** building `baseQuery` (note: in the current MySQL code `joinOrder` is computed *after* `baseQuery` — move that line up), then use `countDistinct(<mysql column cast>(primaryKeyInfo.column))` when `hasJoins && primaryKeyInfo`, else `count()`. Add `countDistinct` to the drizzle-orm import.

**Verify**: `cd packages/adapters/drizzle && bun run typecheck` → exit 0

### Step 2: Port the same guard to SQLite

Same change in `sqlite-query-builder.ts` (`joinOrder` is computed at `:221` — move it above `baseQuery` at `:214`).

**Verify**: `cd packages/adapters/drizzle && bun run typecheck` → exit 0

### Step 3: Regression tests

Extend the SQLite suite (in-memory, runs everywhere) with the canonical case, modeled on existing tests in `tests/adapter-sqlite.test.ts`:

- Schema: `users` (2 rows) one-to-many `posts` (user 1 has 3 posts, user 2 has 1).
- Query: fetch users with a filter or column that forces the `posts` join.
- Assert `result.total === 2` (before this fix it returns 4) and `pagination.totalPages` computed from 2.
- Control case: same fetch without the join → `total === 2` still.

For MySQL, if the query-builder unit tests assert generated SQL shape (check `tests/mysql-query-builder.test.ts` for the existing assertion style), add an assertion that the count query uses `count(distinct …)` when joins are present. If those tests require a live DB and none is configured locally, write the test so CI's MySQL service exercises it.

**Verify**: `cd packages/adapters/drizzle && bun test tests/adapter-sqlite.test.ts` (or your new test file) → passes, including the new `total === 2` assertion

### Step 4: Full suite + changeset

Run the package suite; add `.changeset/fix-join-count-inflation.md` (patch bump for `@better-tables/adapters-drizzle`, describing the wrong-total symptom).

**Verify**: `cd packages/adapters/drizzle && bun test` → SQLite suites pass; `ls .changeset/` shows the file.

## Test plan

Covered in Step 3: one-to-many join count regression (SQLite in-memory, asserting `total`), no-join control, MySQL SQL-shape assertion. Pattern: `tests/adapter-sqlite.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "countDistinct" packages/adapters/drizzle/src/query-builders/mysql-query-builder.ts packages/adapters/drizzle/src/query-builders/sqlite-query-builder.ts` → ≥1 match in each
- [ ] `cd packages/adapters/drizzle && bun run typecheck` exits 0
- [ ] New join-count regression test exists and passes (`bun test`)
- [ ] `.changeset/*.md` exists
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpted code at the three cited locations doesn't match (drift).
- `primaryKeyMap` is empty/unpopulated for SQLite or MySQL schemas in tests (would make the guard a silent no-op — the fix then needs `getPrimaryKeyMap` work, which is out of scope; report it).
- The new SQLite regression test still returns `total === 4` after the change — the count query construction differs from the excerpt's assumption; report what the generated SQL looks like.

## Maintenance notes

- Plan 007 should delete this triplicated logic by hoisting a `buildCountExpression()` hook into `BaseQueryBuilder` — the `TODO(plan-007)` markers left in step 1–2 point there.
- Related-but-deferred: the *data* query under manual one-to-many joins still paginates over multiplied rows (ADAPTER-03 in `plans/README.md`); `total` will be right after this fix but page contents can still under-fill. Reviewers should not mistake that for a regression of this change.
