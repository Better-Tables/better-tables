# Plan 012: Repair the verification baseline — lockfile sync, workable typecheck, lint sweep

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Keep the four commits SEPARATE as specified in
> the git workflow section — the lint sweep especially must not be mixed with
> behavioral changes. Skip updating `plans/README.md` if your dispatcher told
> you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 55dfd01..HEAD -- bun.lock packages/cli package.json turbo.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" facts against the live repo before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 (blocks plan 001, and CI is failing at install on HEAD today)
- **Effort**: M
- **Risk**: MED (lockfile regeneration moves resolved versions; contained by the test gates below)
- **Depends on**: none
- **Category**: bug / dx
- **Planned at**: commit `55dfd01`, 2026-07-12 (evidence from plan-001 execution attempt, same day)

## Why this matters

Plan 001's executor discovered — and the reviewer independently reproduced — that the repo cannot verify itself at HEAD:

1. **CI is red at install, today, for the jobs that already exist.** Every CI job runs `bun install --frozen-lockfile`, and that command fails on HEAD with "lockfile had changes, but lockfile is frozen": `packages/cli/package.json` requires `"commander": "^14.0.2"` while the committed `bun.lock` pins `commander@12.1.0`. The dependabot bumps (`ff79298` prod group of 8, `010aec9` dev group of 2, merged via `8258dcd`/`d0a86ea`) updated `package.json` ranges without a matching lockfile regeneration.
2. **Root typecheck cannot pass by construction.** The root script is `tsc --noEmit` over the whole tree, but per-app internal aliases (`@/*` in `apps/marketing`, `@/lib/utils` in `packages/ui`, etc.) are only resolvable from each package's own tsconfig — whole-tree tsc from root reports 314 errors in code that typechecks fine per-package.
3. **Lint baseline is deep red**: `bunx biome check .` reports 163 errors + 76 warnings + 3 infos (plus ~222 truncated by biome's display cap).

Until this lands, no other plan can honestly claim "typecheck passes / CI green" — this is the true verification-baseline plan; plan 001 (CI gating) is BLOCKED on it.

## Current state

All facts verified 2026-07-12 in a worktree at HEAD `55dfd01`:

- `git show HEAD:packages/cli/package.json | grep commander` → `"commander": "^14.0.2"`. `git show HEAD:bun.lock | grep -m1 '"commander@'` → `"commander": ["commander@12.1.0", ...]`. `bun install --frozen-lockfile` → "error: lockfile had changes, but lockfile is frozen".
- With a fresh (non-frozen) resolve, commander lands on `14.0.3` and exactly one CLI test file breaks: `packages/cli/tests/command-registry.test.ts` — lines 229 and 259 call `command.parse([...], { from: 'user' })` and commander v14 throws `error: too many arguments. Expected 0 arguments but got 1.` (thrown from `node_modules/commander/lib/command.js:2152`), which crashes the whole `bun test` process. The other 7 CLI test files pass on commander 14 (113 tests total across them).
- Root `package.json`: `"typecheck": "tsc --noEmit"`. Per-package `typecheck` scripts already exist in `packages/core`, `packages/ui`, `packages/cli`, `packages/adapters/drizzle` (each `tsc --noEmit` against its own tsconfig). `turbo.json` has tasks `build`, `test`, `lint`, `dev`, `clean` — **no `typecheck` task**.
- Apps: `apps/demo`, `apps/web`, `apps/marketing` — check each `package.json` for a `typecheck` script before assuming (unverified; the plan handles both cases in Step 3).
- The repo's own root `lint` script is the auto-fixer: `biome check --write --unsafe .` — sanctioned for a dedicated cleanup commit; `bunx biome check .` is the check-only form used for counting.
- Test suites that define "green" for this plan: `packages/core` (`bun test`, all pass), `packages/adapters/drizzle` SQLite-backed suites (`bun test` — Postgres/MySQL integration tests may fail locally without `POSTGRES_TEST_URL`/`MYSQL_TEST_URL`; that is expected and not a regression), `packages/cli` (all 8 test files, after Step 2).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install (regen) | `bun install` (repo root)          | exit 0, bun.lock updated |
| Install (verify) | `bun install --frozen-lockfile`   | exit 0              |
| Typecheck (after Step 3) | `bun run typecheck` (root) | exit 0             |
| Lint count | `bunx biome check . 2>&1 | tail -5`     | diagnostic summary  |
| Lint sweep | `bun run lint` (root — MUTATES, Step 4 only) | exit 0         |
| Core tests | `cd packages/core && bun test`          | all pass            |
| CLI tests | `cd packages/cli && bun test`            | all 8 files pass    |
| Adapter tests | `cd packages/adapters/drizzle && bun test` | SQLite suites pass |

## Scope

**In scope** (the only files you should modify):
- `bun.lock` (regenerated once, Step 1)
- `packages/cli/src/**` and/or `packages/cli/tests/**` (commander-14 compatibility ONLY, Step 2) — or `packages/cli/package.json` if the fallback pin is taken
- Root `package.json` (the `typecheck` script only) and `turbo.json` (add `typecheck` task), Step 3
- `apps/*/package.json` (adding a `typecheck` script where missing, Step 3 — only if apps are included in the strategy)
- Whatever files `bun run lint` auto-fixes (Step 4 — formatting/lint-fix ONLY, dedicated commit)
- `.changeset/*.md` if Step 2 changes published CLI behavior (patch)

**Out of scope** (do NOT touch, even though they look related):
- `.github/workflows/test.yml` — plan 001 owns it and re-runs after this lands.
- Fixing individual pre-existing type errors in packages/apps beyond what Step 3's strategy requires — if a package fails its OWN typecheck, that's a STOP condition, not a fix-it-here.
- Upgrading/downgrading any dependency other than the commander decision in Step 2 — the lockfile regen takes whatever the committed `package.json` ranges give; do not hand-edit ranges except commander's, and only under Step 2's fallback.
- Biome configuration (`biome.json`) — changing lint rules to make the count drop is exactly the silent-drift this plan exists to prevent.

## Git workflow

- Branch: `repair-verification-baseline`
- **Four separate commits, in this order** (reviewability is the point):
  1. "Regenerate bun.lock to match workspace package.json ranges"
  2. "Fix CLI for commander 14" (or "Pin commander to v12 pending v14 migration" under the fallback)
  3. "Run typecheck per package via turbo"
  4. "Apply biome auto-fixes across the repo" (lint sweep — NOTHING else in this commit)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Regenerate the lockfile

Run `bun install` at the repo root (non-frozen — this intentionally rewrites `bun.lock` to satisfy the committed `package.json` ranges). Commit `bun.lock` alone.

**Verify**: `bun install --frozen-lockfile` → exit 0. `git show HEAD:bun.lock | grep -m1 '"commander@'` (on your branch) → a `commander@14.x` entry.

### Step 2: Make the CLI green on commander 14

Run `cd packages/cli && bun test`. Expect only `tests/command-registry.test.ts` to fail (the `command.parse([...], { from: 'user' })` calls at lines 229 and 259). Investigate against the installed commander 14 source in `node_modules/commander` (its CHANGELOG.md documents breaking changes) — the error indicates the parse-call contract changed between 12 and 14. Fix the CLI source and/or test usage minimally so intent is preserved (the tests exercise registered commands parsing user-style argv). If the fix requires restructuring the CLI's command wiring beyond the parse-call sites — take the fallback: set `"commander": "^12.1.0"` in `packages/cli/package.json`, re-run Step 1's regen so the lock matches, and record in NOTES that a commander-14 migration is deferred (the reviewer will add it to the plan index).

If CLI runtime source (not just tests) changed, add `.changeset/fix-cli-commander-14.md` (patch bump `@better-tables/cli`).

**Verify**: `cd packages/cli && bun test` → all 8 test files pass, 0 crashes.

### Step 3: Make root typecheck mean "every package typechecks itself"

1. Add to `turbo.json` tasks: `"typecheck": { "outputs": [] }` (add `"dependsOn": ["^build"]` ONLY if verification proves cross-package d.ts resolution requires it — try without first; the workspace resolves `@better-tables/*` via source paths).
2. Change root `package.json` script: `"typecheck": "turbo run typecheck"`.
3. Run `bun run typecheck`. For each workspace member that fails or lacks a `typecheck` script: packages MUST pass (a failing package is a STOP condition); for `apps/*`, add a `typecheck` script (`tsc --noEmit`) where missing and include them if they pass — if an app fails its own typecheck on pre-existing errors, EXCLUDE it from the turbo task scope explicitly (e.g. leave it without a `typecheck` script) and record the app name + error count in NOTES rather than fixing app code.

**Verify**: `bun run typecheck` (root) → exit 0, with per-package tasks visible in turbo output; NOTES records any excluded app.

### Step 4: The lint sweep

Capture the before-count: `bunx biome check . 2>&1 | tail -5`. Run the repo's own auto-fixer: `bun run lint` (this is `biome check --write --unsafe .`). Re-run the tests that gate this plan (core, cli, drizzle-SQLite) — `--unsafe` fixes can alter behavior, that's what the gate is for. Commit the sweep as its own commit with NOTHING else in it. Capture the after-count.

If diagnostics remain after the sweep: do NOT hand-fix more than ~10 trivial ones; report the residual count grouped by rule (`bunx biome check . 2>&1 | grep -oE 'lint/[a-zA-Z/]+' | sort | uniq -c | sort -rn | head`) in NOTES — the reviewer decides whether CI lint starts blocking or `continue-on-error` (that decision belongs to plan 001's re-run).

**Verify**: `bunx biome check . 2>&1 | tail -5` → error count is 0, or the residual count + rule breakdown is in NOTES; core/cli/drizzle-SQLite tests still pass after the sweep.

### Step 5: Full baseline confirmation

From the repo root, in order: `bun install --frozen-lockfile` → exit 0; `bun run typecheck` → exit 0; `bunx biome check .` → exit 0 or documented residue; `(cd packages/core && bun test)` → pass; `(cd packages/cli && bun test)` → pass; `(cd packages/adapters/drizzle && bun test)` → SQLite suites pass. Record each result in the report.

**Verify**: all six commands' outputs captured; the four commits exist and are separated as specified (`git log --oneline -4`).

## Test plan

No new tests — this plan restores the existing suites to a runnable state. The gates: 8/8 CLI test files (including the commander-14 regression), core suite, drizzle SQLite suites, all passing after every mutating step (especially after Step 4's `--unsafe` sweep).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun install --frozen-lockfile` exits 0
- [ ] `bun run typecheck` exits 0 (turbo per-package)
- [ ] `cd packages/cli && bun test` → all 8 files pass
- [ ] `cd packages/core && bun test` passes; `cd packages/adapters/drizzle && bun test` SQLite suites pass
- [ ] `bunx biome check .` exits 0 OR residual diagnostics documented by rule in the report
- [ ] Exactly 4 commits, separated as specified; lint sweep commit contains no non-lint changes
- [ ] No files outside the in-scope list are modified (`git status` clean apart from them)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's regenerated lockfile breaks `packages/core` or drizzle-SQLite tests (a transitively-moved dependency changed behavior) — report which package moved (diff the lock) and which tests fail; do NOT pin things ad hoc.
- Step 2: the commander-14 fix requires touching more than the parse-call sites and their immediate helpers, AND the ^12 fallback also fails tests.
- Step 3: any `packages/*` member fails its own typecheck — report the package and the first ~10 errors; per-package failures are pre-existing bugs to plan separately, not to patch here.
- Step 4: the `--unsafe` sweep breaks any gating test and reverting the specific fix isn't obvious — revert the whole sweep commit and report the offending rule/files.
- The drift check shows `bun.lock`/`packages/cli`/`turbo.json` changed since `55dfd01`.

## Maintenance notes

- Plan 001 re-runs after this lands: its `static-checks` job calls `bun run typecheck` (now turbo-backed) and `bunx biome check .` (blocking vs `continue-on-error` per Step 4's residue). Plan 001's revision already reflects this.
- The lockfile/package.json drift came from dependabot merges without lockfile regeneration — plan 001's CI install gate (`--frozen-lockfile` on every job, including for dependabot PRs) is what prevents recurrence; a repo setting requiring dependabot to regenerate lockfiles (or grouping via a tool that does) is a follow-up for the maintainer.
- If Step 2 took the ^12 fallback, a "migrate CLI to commander 14" item must be added to `plans/README.md` unplanned-findings list by the reviewer.
- Any app excluded from typecheck in Step 3 is recorded debt — reviewers should resist quietly re-including it without fixing its errors.
