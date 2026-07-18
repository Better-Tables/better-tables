# Plan 033: Restore verification-infrastructure truth (turbo test cache, orphan tests, broken lint:fix, skipped suites)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 787a816..HEAD -- turbo.json apps/marketing/package.json .github/workflows/test.yml packages/core/package.json packages/cli/package.json packages/ui/package.json packages/adapters/drizzle/package.json packages/adapters/toolkit/package.json packages/adapters/drizzle/tests/adapter-sqlite.test.ts .env.example package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / tests
- **Planned at**: commit `787a816`, 2026-07-17

## Why this matters

The repo's verification story has four silent holes. (1) Turbo's `test` task
hashes `test/**` as inputs but every package keeps its suite in `tests/**`
(plural), so a local `bun run test` after editing *only a test file* can
replay a stale cached pass without executing the change — a newly added
failing regression test can read green. (2) `apps/marketing` has one real test
(`src/lib/demo/support/fetch-tickets.test.ts`) but no `test` script, so
neither `turbo run test` nor CI ever runs it. (3) All five packages define
`"lint:fix": "biome check --apply ."`, but `--apply` was removed in Biome 2.x
(the repo pins Biome 2.3.11) — the one auto-fix entry point contributors reach
for errors out in every workspace. (4) The Drizzle adapter's error-handling
tests are permanently `describe.skip`/`it.skip` with no recorded reason, so
the throw-vs-fail-open input contract is asserted nowhere. This plan also
folds in three one-line hygiene fixes found in the same audit (stale
`.env.example` path, a floating `@types/bun: latest`, and a happy-dom bump
past a critical dev-only advisory), because they share the same "the tooling
tells the truth" theme and each is a one-file change.

## Current state

Files and the facts you need (verified against `787a816`):

- `turbo.json` — the `test` task:

  ```json
  "test": {
    "dependsOn": ["build"],
    "outputs": [],
    "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts", "test/**/*.tsx"]
  }
  ```

  Actual test locations: `packages/core/tests/`, `packages/cli/tests/`,
  `packages/ui/tests/`, `packages/adapters/toolkit/tests/`,
  `packages/adapters/drizzle/tests/`. None match `test/**`.

- `apps/marketing/package.json` — scripts are
  `dev/build/start/lint/format/typecheck/clean`; **no `test` script**. The
  package name is `@better-tables/site`. Its build is `next build` (slow),
  and turbo's `test` task has `dependsOn: ["build"]` — see Step 2 for the
  override that avoids dragging `next build` into every root test run.

- `.github/workflows/test.yml` — `on.pull_request.paths` and `on.push.paths`
  both list only `packages/core/**`, `packages/adapters/**`,
  `packages/ui/**`, `packages/cli/**`, `package.json`, `bun.lock`,
  `turbo.json`, `tsconfig.json`, `biome.json`,
  `.github/workflows/test.yml`. `apps/marketing/**` and `bunfig.toml` are
  absent. Jobs: `static-checks`, `test-core`, `test-cli`, `test-ui`,
  `test-adapters` (the last provisions `mysql:8.0` + `postgres:16-alpine`
  service containers and exports `MYSQL_TEST_URL`/`POSTGRES_TEST_URL`).

- `lint:fix` scripts, all five identical (`biome check --apply .`):
  - `packages/core/package.json:32`
  - `packages/cli/package.json:34`
  - `packages/ui/package.json:30`
  - `packages/adapters/drizzle/package.json:31`
  - `packages/adapters/toolkit/package.json:31`
  The pinned Biome (2.3.11) accepts `--write` / `--fix` / `--unsafe`;
  `--apply` errors as an unknown option.

- `packages/adapters/drizzle/tests/adapter-sqlite.test.ts:326` —
  `describe.skip('Error Handling', () => { ... })` containing three tests:
  invalid column ID (`columns: ['invalid.column']` → `rejects.toThrow()`),
  invalid operator (`operator: 'invalidOperator'` → `rejects.toThrow()`),
  invalid value (`values: [undefined]` with `contains` →
  `rejects.toThrow()`). Sibling skips: `adapter-postgres.test.ts:1203`
  (`describe.skip('Error Handling')`), `adapter-mysql.test.ts:856` and
  `:879` (`it.skip`). Context you must respect: plan 027 made null-only
  filters valid via `includeNull`, and ADAPTER-07 (ledger) made
  present-but-wrong-type values throw `QueryError` while *empty/missing*
  values intentionally emit `undefined` (fail-soft for partial UI input) —
  so the third test's `values: [undefined]` may legitimately NOT throw.
  Reconcile, don't force.

- `.env.example` (repo root) — line 3 says `apps/demo uses SQLite + a seed
  script — needs nothing.` There is no `apps/demo`; the demo lives in
  `apps/marketing`.

- `packages/cli/package.json:45` — `"@types/bun": "latest"`. Root
  `package.json` pins `"@types/bun": "1.3.5"` in devDependencies.

- Root `package.json` workspace catalog —
  `"@happy-dom/global-registrator": "^17.0.0"`. `bun audit` reports
  happy-dom <20 with 1 critical + 2 high advisories. It is dev-only (UI test
  harness, `packages/ui/tests/setup.ts` calls `GlobalRegistrator.register()`)
  in a private package — not a runtime risk, but it will red-flag every
  audit run once CI is live.

Repo conventions: commits are imperative sentences; plan-driven work uses the
`Plan NNN Step X: <what>` style visible in `git log` (e.g.
`Plan 031 Step 2: filterHasValue utility (finding 17)`). Match it. Lint
check-only is `bunx biome check .` — NEVER run the root `bun run lint`
script (it rewrites files with `--unsafe` across the whole repo).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` (repo root) | exit 0 |
| Typecheck | `bun run typecheck` (root) | exit 0, all tasks green |
| Test one package | `cd packages/<name> && bun test` | all pass |
| Drizzle SQLite suite | `cd packages/adapters/drizzle && bun test` | SQLite suites pass; `adapter-postgres`/`adapter-mysql` FAIL without env DBs — expected, ignore those two files locally |
| Root test via turbo | `bun run test --filter=<pkg>` | runs (or replays cache) |
| Lint check (never fix) | `bunx biome check <dir>` | reports without writing |

Note: drizzle tests require built deps: `bun run build --filter=@better-tables/core --filter=@better-tables/adapters-toolkit` first if `dist/` is missing.

## Scope

**In scope** (the only files you should modify):
- `turbo.json`
- `apps/marketing/package.json`
- `.github/workflows/test.yml`
- `packages/core/package.json`, `packages/cli/package.json`,
  `packages/ui/package.json`, `packages/adapters/drizzle/package.json`,
  `packages/adapters/toolkit/package.json` (one line each: `lint:fix`;
  plus the `@types/bun` line in `packages/cli/package.json`)
- `packages/adapters/drizzle/tests/adapter-sqlite.test.ts`
- `packages/adapters/drizzle/tests/adapter-postgres.test.ts`,
  `packages/adapters/drizzle/tests/adapter-mysql.test.ts` (comment/unskip
  edits only)
- `.env.example`
- root `package.json` (catalog: happy-dom entry only)
- `bun.lock` (regenerated by `bun install` — expected)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- CI dependency caching (recorded separately in the ledger backlog — do not
  add `actions/cache` here).
- The `continue-on-error` lint step in CI (intentional carry-forward until
  Biome residue is zero).
- Any production source under `packages/*/src` — this plan touches config
  and tests only.
- postcss/turbo version bumps (backlog).

## Git workflow

- Branch: `verification-infra-truth` (repo convention: short kebab-case, no prefix)
- One commit per step: `Plan 033 Step N: <imperative summary>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the turbo `test` inputs glob

In `turbo.json`, change the `test` task inputs from `test/**/*.ts` /
`test/**/*.tsx` to `tests/**/*.ts` / `tests/**/*.tsx` (keep the two `src/**`
globs).

**Verify**:
1. `grep -n '"test/' turbo.json` → no matches.
2. Behavior: run `bun run test --filter=@better-tables/adapters-toolkit`
   twice (second run should say cache hit / FULL TURBO). Then append a
   newline to `packages/adapters/toolkit/tests/filter-router.test.ts`, run
   again → the task must be a **cache miss** (it re-executes). Revert the
   newline (`git checkout -- packages/adapters/toolkit/tests/filter-router.test.ts`).

### Step 2: Wire the marketing test into `turbo run test` without dragging in `next build`

1. In `apps/marketing/package.json`, add `"test": "bun test"` to scripts.
2. In `turbo.json`, add a package-scoped override so the site's test task
   does not depend on `next build`:

   ```json
   "@better-tables/site#test": {
     "dependsOn": [],
     "outputs": [],
     "inputs": ["src/**/*.tsx", "src/**/*.ts", "tests/**/*.ts", "tests/**/*.tsx"]
   }
   ```

3. In `.github/workflows/test.yml`, add `apps/marketing/**` and
   `bunfig.toml` to BOTH `paths:` lists (pull_request and push), and add a
   step to the `static-checks` job (after the Typecheck step):

   ```yaml
   - name: Test marketing data layer
     run: bun test
     working-directory: apps/marketing
   ```

**Verify**:
1. `cd apps/marketing && bun test` → the fetch-tickets suite passes (it uses
   `bun:sqlite`, no env needed).
2. `bun run test --filter=@better-tables/site` → runs the same suite via
   turbo **without** executing `next build` (watch the task list — no
   `@better-tables/site:build`).
3. `bunx yaml-lint .github/workflows/test.yml` if available; otherwise
   `bun -e "const y=require('js-yaml')"` is NOT available — a plain
   visual check plus `git diff` review of indentation is acceptable.

### Step 3: Repair `lint:fix` in all five packages

Change `"lint:fix": "biome check --apply ."` to
`"lint:fix": "biome check --write ."` in the five package.json files listed
in Current state. (Deliberately `--write` without `--unsafe` — safe fixes
only; the root script remains the unsafe bulk tool.)

**Verify**:
1. `grep -rn "biome check --apply" packages/` → no matches.
2. `cd packages/toolkit-does-not-exist` — n/a; instead:
   `cd packages/adapters/toolkit && bun run lint:fix` → exits 0 (no unknown
   option error). If it applied incidental fixes, inspect `git status`; if
   any file under `src/` changed, revert those churn-only edits
   (`git checkout -- src`) — this plan ships config changes, not lint fixes.

### Step 4: Unskip and reconcile the SQLite error-handling suite

In `packages/adapters/drizzle/tests/adapter-sqlite.test.ts:326`, remove
`.skip` from `describe.skip('Error Handling', ...)` and run the file. For
each of the three tests, reconcile with actual behavior:

- If it passes: keep as-is.
- If it fails because the adapter is intentionally lenient (see Current
  state: empty/missing values fail-soft by design), rewrite the assertion to
  pin the REAL contract (e.g. resolves with unfiltered data) and add a
  one-line comment citing the ADAPTER-07 fail-soft rule for empty values.
  Do not change adapter source to make a test pass.

For `adapter-postgres.test.ts:1203`, `adapter-mysql.test.ts:856`/`:879`:
do NOT unskip (they only run with env DBs and CI would be the first place
they execute — too risky to flip blind). Instead replace the bare `.skip`
with a skip that documents itself, e.g. change the string/comment to:
`describe.skip('Error Handling (mirror of the reconciled SQLite suite — unskip after verifying against a live DB; see plan 033)', ...)`.

**Verify**: `cd packages/adapters/drizzle && bun test tests/adapter-sqlite.test.ts`
→ all pass, zero skips remaining in that file's Error Handling block
(`grep -n "describe.skip('Error Handling'" tests/adapter-sqlite.test.ts` →
no match).

### Step 5: Fix the `.env.example` phantom path

In root `.env.example`, change `apps/demo uses SQLite + a seed script` to
`apps/marketing uses SQLite + a seed script`.

**Verify**: `grep -n "apps/demo" .env.example` → no matches.

### Step 6: Pin `@types/bun` in the CLI package

In `packages/cli/package.json`, change `"@types/bun": "latest"` to
`"@types/bun": "1.3.5"` (matching the root pin). Run `bun install`.

**Verify**: `grep -n '"@types/bun"' packages/cli/package.json` → shows
`1.3.5`; `cd packages/cli && bun run typecheck` → exit 0.

### Step 7: Bump happy-dom past the advisory

In root `package.json`, change the catalog entry
`"@happy-dom/global-registrator": "^17.0.0"` to `"^20.0.0"`. Run
`bun install`, then the UI suite.

**Verify**:
1. `bun install` → exit 0, lockfile updated.
2. `cd packages/ui && bun test` → all tests pass (49+ as of `787a816`).
3. `bun audit 2>&1 | grep -i happy-dom` → no critical/high advisory lines
   for happy-dom.

### Step 8: Full gates + ledger

Run root `bun run typecheck`, then per-package `bun test` for core, cli, ui,
toolkit, and the drizzle SQLite path. Update the plan 033 row in
`plans/README.md` to DONE with a one-line outcome.

**Verify**: all listed commands exit 0 (drizzle pg/mysql files still fail
locally without env DBs — expected and out of scope).

## Test plan

- No new test files. The changed/unskipped tests are:
  - the turbo cache-miss behavior check (Step 1, procedural),
  - the marketing suite now running under `bun run test` (Step 2),
  - the three reconciled Error Handling tests in `adapter-sqlite.test.ts`
    (Step 4) — these are the durable additions; model any rewritten
    assertions on the row-set style used elsewhere in the same file.
- Verification: commands in each step, plus Step 8's full sweep.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n '"test/' turbo.json` → no matches; `tests/**` globs present
- [ ] `grep -rn "biome check --apply" packages/` → no matches
- [ ] `grep -n "apps/demo" .env.example` → no matches
- [ ] `grep -n '"@types/bun": "latest"' packages/cli/package.json` → no matches
- [ ] `grep -n 'happy-dom/global-registrator": "\^20' package.json` → 1 match
- [ ] `grep -c "describe.skip('Error Handling'" packages/adapters/drizzle/tests/adapter-sqlite.test.ts` → 0
- [ ] `cd apps/marketing && bun test` → pass; `grep -n '"test"' apps/marketing/package.json` → 1 match
- [ ] `.github/workflows/test.yml` contains `apps/marketing/**` in both paths lists and a marketing test step
- [ ] Root `bun run typecheck` exit 0; core/cli/ui/toolkit `bun test` all pass; drizzle SQLite suites pass
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The turbo override syntax (`"@better-tables/site#test"`) is rejected by
  the pinned turbo (2.6.1) — report the error rather than upgrading turbo.
- Step 4's unskipped tests fail in a way that suggests a REAL bug (e.g.
  `invalid.column` silently returns unfiltered data typed as valid rows)
  rather than documented lenience — that's a correctness finding, not a
  test-reconciliation call. Report it; do not change `src/`.
- Step 7's happy-dom 20 breaks the UI harness in a way not fixed by a
  trivial import/registration adjustment — revert the bump, report, and
  complete the rest of the plan.
- Any step requires editing files under `packages/*/src`.

## Maintenance notes

- The `@better-tables/site#test` override must be revisited if the
  marketing app ever gains tests that require a build artifact.
- When the pg/mysql Error Handling blocks are eventually unskipped, run
  them against live DBs first (CI has service containers; locally use
  `packages/adapters/drizzle/.env.example` → `.env.local`).
- CI dependency caching and the lint `continue-on-error` flip are recorded
  in the ledger backlog — natural follow-ups touching the same workflow file.
- Reviewer scrutiny: the Step 4 reconciliations — each rewritten assertion
  is a contract statement; check it matches ADAPTER-07's documented
  fail-soft-for-empty / throw-for-wrong-type boundary.
