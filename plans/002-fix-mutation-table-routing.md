# Plan 002: Stop record mutations from silently targeting the first schema table

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- packages/adapters/drizzle/src/drizzle-adapter.ts packages/adapters/drizzle/src/types.ts packages/adapters/drizzle/src/factory.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (changes mutation routing for existing consumers; mitigated by keeping single-table behavior identical)
- **Depends on**: none (001 recommended first so CI gates the change)
- **Category**: bug
- **Planned at**: commit `55dfd01`, 2026-07-12

## Why this matters

Every write operation in the Drizzle adapter — `createRecord`, `updateRecord`, `deleteRecord`, `bulkUpdate`, `bulkDelete` — resolves its target table via `determineTableFromData()`, which ignores its argument and returns whichever table happens to be first in `Object.keys(this.schema)`. In any multi-table schema (the adapter's core use case — its headline feature is cross-table relationships), deletes and updates by id go to the wrong table: silent data corruption or data loss on the most dangerous code path. The code comment admits it's a placeholder. This must become an explicit, validated routing decision.

## Current state

- `packages/adapters/drizzle/src/drizzle-adapter.ts:790-807` — the culprit:

  ```typescript
  /**
   * Determine table from data or use first table as fallback
   */
  private determineTableFromData(
    _data?: Partial<InferSelectModelFromFilteredSchema<TSchema>>
  ): string {
    // For now, use the first table as fallback
    // In a more sophisticated implementation, we could analyze the data structure
    const tableNames = Object.keys(this.schema);
    if (tableNames.length === 0) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }
    const firstTable = tableNames[0];
    if (!firstTable) {
      throw new SchemaError('No tables found in schema', { schema: this.schema });
    }
    return firstTable;
  }
  ```

- Callers (all in `drizzle-adapter.ts`): `createRecord` at `:812-819` (calls `determineTableFromData(data)` at `:816`), `updateRecord` at `:843`, `deleteRecord` at `:875`, `bulkUpdate` at `:902`, `bulkDelete` at `:934`.
- The read path already has the right pattern to copy: `fetchData` accepts an optional `primaryTable` param (`packages/core/src/types/adapter.ts:71`, `FetchDataParams.primaryTable?: string`) and validates it against the schema (`packages/adapters/drizzle/src/primary-table-resolver.ts:96-103` throws when the named table isn't in the schema).
- The core `TableAdapter` write signatures (`packages/core/src/types/adapter.ts:285-343`) carry no table hint: `createRecord?(data: Partial<TData>)`, `updateRecord?(id: string, data)`, `deleteRecord?(id: string)`, `bulkUpdate?(ids, data)`, `bulkDelete?(ids)`. **Do not change the core interface in this plan** — that's plan 006's contract redesign. Fix routing inside the Drizzle adapter via configuration.
- Adapter config types live in `packages/adapters/drizzle/src/types.ts` (`DrizzleAdapterConfig`, `DrizzleAdapterFactoryOptions`). The factory `drizzleAdapter(db, factoryOptions?)` is `packages/adapters/drizzle/src/factory.ts:89-92`.
- Error convention: the adapter throws typed errors from `types.ts` (`SchemaError`, `QueryError`) with a context object — match it (see `drizzle-adapter.ts:800`).
- Tests for the adapter live in `packages/adapters/drizzle/tests/*.test.ts`; `factory.test.ts` and `adapter-sqlite.test.ts` show the setup pattern (in-memory SQLite via `drizzle-orm/better-sqlite3`, multi-table schema with `users`/`profiles`).

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Install   | `bun install` (repo root)                      | exit 0              |
| Typecheck | `cd packages/adapters/drizzle && bun run typecheck` | exit 0        |
| Tests     | `cd packages/adapters/drizzle && bun test`     | all pass (Postgres/MySQL integration tests may skip/fail locally without `POSTGRES_TEST_URL`/`MYSQL_TEST_URL` — SQLite tests must pass) |
| Lint      | `cd packages/adapters/drizzle && bun run lint` | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `packages/adapters/drizzle/src/drizzle-adapter.ts`
- `packages/adapters/drizzle/src/types.ts`
- `packages/adapters/drizzle/src/factory.ts` (only if plumbing the new option requires it)
- `packages/adapters/drizzle/tests/mutation-routing.test.ts` (create)
- `.changeset/*.md` (create one; this is a published package)

**Out of scope** (do NOT touch, even though they look related):
- `packages/core/src/types/adapter.ts` — the core write signatures are redesigned in plan 006; changing them here creates a breaking core release for a bug fix.
- `packages/adapters/drizzle/src/primary-table-resolver.ts` — its separate heuristic bugs are recorded in `plans/README.md` (ADAPTER-05), not this plan.
- Read-path behavior (`fetchData`).

## Git workflow

- Branch: `fix-mutation-table-routing`
- Commit style: imperative sentence, e.g. "Route record mutations to an explicit table instead of the first schema key"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `mutationTable` resolution with explicit config

In `types.ts`, add to the adapter's config/factory options an optional `defaultMutationTable?: string`. In `drizzle-adapter.ts`, replace `determineTableFromData` with a `resolveMutationTable(data?)` that:

1. If `this.config.defaultMutationTable` is set: validate it exists in `this.schema` (throw `SchemaError` naming the table and the available tables if not) and return it.
2. Else if `Object.keys(this.schema).length === 1`: return that single table (preserves today's behavior for the only case where it was correct).
3. Else: throw a `SchemaError` with a message that tells the consumer exactly what to do, e.g. `"Multiple tables in schema — set 'defaultMutationTable' in drizzleAdapter options to enable create/update/delete"` with `{ availableTables }` context.

Do **not** attempt data-shape inference (matching `data` keys against table columns) — ambiguous shapes make it another silent-wrong-table generator. Explicit config only.

**Verify**: `cd packages/adapters/drizzle && bun run typecheck` → exit 0

### Step 2: Reflect capability in adapter meta

`drizzle-adapter.ts` builds `AdapterMeta.features` (search for `features:` near the meta construction, around `:1009-1013`) advertising `create/update/delete/bulkOperations: true` unconditionally. Make these `true` only when mutations are resolvable (single-table schema or `defaultMutationTable` set), so UI layers that check `adapter.meta.features` don't render actions that will throw.

**Verify**: `grep -n "bulkOperations" packages/adapters/drizzle/src/drizzle-adapter.ts` shows the conditional; typecheck passes.

### Step 3: Write the tests

Create `packages/adapters/drizzle/tests/mutation-routing.test.ts` modeled on `tests/adapter-sqlite.test.ts` (in-memory SQLite, schema with two tables, e.g. `users` and `profiles`, ordered so the WRONG table is first in the schema object). Cases:

1. Multi-table schema, no `defaultMutationTable`: `createRecord`/`updateRecord`/`deleteRecord`/`bulkUpdate`/`bulkDelete` each reject with `SchemaError` (assert the message mentions `defaultMutationTable`).
2. Multi-table schema with `defaultMutationTable: 'profiles'`: `createRecord` inserts into `profiles` (assert by querying both tables); `deleteRecord` removes from `profiles` and leaves an identically-id'd row in `users` untouched — this is the regression test for the original bug.
3. Single-table schema, no config: mutations still work (back-compat).
4. `defaultMutationTable: 'nonexistent'`: adapter construction or first mutation throws `SchemaError` listing available tables.
5. `meta.features.create` is `false` in case 1's setup and `true` in cases 2–3.

**Verify**: `cd packages/adapters/drizzle && bun test tests/mutation-routing.test.ts` → all pass

### Step 4: Full adapter suite + changeset

Run the whole package suite to catch regressions in existing mutation tests (some may have relied on first-table fallback with a single-table schema — those should still pass via step 1's rule 2; a multi-table test relying on the old behavior is a bug fix, adjust it and say so in the commit).

Add a changeset (`.changeset/fix-mutation-table-routing.md`) with a `minor` bump for `@better-tables/adapters-drizzle` describing the migration (`set defaultMutationTable`). Per the RELEASE POLICY in `plans/README.md` (2026-07-12), breaking is explicitly acceptable pre-1.0 — the new throw-on-ambiguity is the correct behavior and needs no compatibility shim; the changeset body is migration-guide input.

**Verify**: `cd packages/adapters/drizzle && bun test` → SQLite suites all pass; `ls .changeset/*.md` shows the new file.

## Test plan

Covered in Step 3 (5 named cases, wrong-table regression test is the core). Model file structure and helpers after `packages/adapters/drizzle/tests/adapter-sqlite.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "For now, use the first table as fallback" packages/adapters/drizzle/src/drizzle-adapter.ts` → no matches
- [ ] `cd packages/adapters/drizzle && bun run typecheck` exits 0
- [ ] `cd packages/adapters/drizzle && bun test` — SQLite-backed suites pass, including 5 new mutation-routing tests
- [ ] A `.changeset/*.md` exists describing the change and migration
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `drizzle-adapter.ts:790-807` no longer matches the excerpt (drift).
- You find call sites of `determineTableFromData` other than the five mutation methods — the blast radius is bigger than planned.
- Existing tests fail in a way that shows consumers *depend* on multi-table first-table routing (i.e., a test explicitly asserts a mutation lands in the first table of a multi-table schema) — that's a semantics decision for the maintainer.
- Changing `AdapterMeta.features` conditionally breaks UI-package type expectations (it shouldn't — the type is plain booleans).

## Maintenance notes

- Plan 006 (core contract v2) will likely add a per-call table/entity parameter to the write methods; this config-based routing then becomes the default when the per-call param is absent. Keep `resolveMutationTable` as the single funnel so that change lands in one place.
- Reviewers should scrutinize the back-compat rule (single-table schemas keep working with zero config) and that the error message names the exact option to set.
